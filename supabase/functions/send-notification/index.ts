import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/** Escapes user-supplied values before injecting into HTML email bodies. */
function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Renders a template and escapes every interpolated value for safe HTML output. */
function renderTemplateHtml(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => htmlEscape(vars[key] ?? ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Authentication ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callerId = claimsData.claims.sub as string;
  // ────────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json();
    const { requestId, eventType, title, message, triggeredBy, newStatus, baseUrl } = body;

    // Basic input validation
    if (!requestId || typeof requestId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid requestId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the event key: for status_change, use per-status event
    const resolvedEventType = eventType === "status_change" && newStatus
      ? `status_to_${newStatus}`
      : eventType;

    // Use service-role client for privileged DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller can access this request
    const { data: canView } = await supabase.rpc("can_view_request", {
      _user_id: callerId,
      _request_id: requestId,
    });
    if (!canView) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1️⃣ Load event config - try resolved key first, fallback to original
    let { data: eventData } = await supabase
      .from("notification_events")
      .select("id, is_active, notification_configs(*)")
      .eq("event_key", resolvedEventType)
      .single();

    if (!eventData) {
      const { data: fallback } = await supabase
        .from("notification_events")
        .select("id, is_active, notification_configs(*)")
        .eq("event_key", eventType)
        .single();
      eventData = fallback;
    }

    // Fallback: if no config found or event inactive, use legacy behavior
    const config = (eventData as any)?.notification_configs?.[0] || null;
    const isActive = eventData?.is_active ?? true;

    if (!isActive) {
      return new Response(JSON.stringify({ success: true, info: "Event disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2️⃣ Get request info (including group_id and executor_group_id)
    const { data: requestData, error: requestError } = await supabase
      .from("requests")
      .select("request_number, template_id, title, created_by, group_id, form_templates(name, executor_group_id)")
      .eq("id", requestId)
      .single();

    if (requestError) throw requestError;

    const requestNumber = String(requestData.request_number).padStart(6, "0");
    const templateName = (requestData as any).form_templates?.name || "General";

    // Priority: 1. Passed baseUrl, 2. Env APP_URL, 3. Hardcoded new default
    const appUrl = baseUrl || Deno.env.get("APP_URL") || "https://gestiones-compras.vercel.app";
    const requestLink = `${appUrl}/requests/${requestId}`;

    // Template variables — user-supplied values will be HTML-escaped on render
    const vars: Record<string, string> = {
      user_name: "",
      request_title: requestData.title,
      request_number: requestNumber,
      template_name: templateName,
      new_status: title.includes(":") ? (title.split(":").pop()?.trim() || "") : title,
      comment: message,
      request_url: requestLink,
    };

    // Get triggered by user name
    if (triggeredBy) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", triggeredBy)
        .single();
      vars.user_name = profile?.name || "";
    }

    // 3️⃣ Build notification content from templates or fallback
    // In-app: plain text rendered (React auto-escapes on display)
    // Email: HTML-escaped values to prevent injection
    let finalTitle: string;
    let finalMessage: string;
    let emailSubject: string;
    let emailBodyContent: string;

    if (config?.inapp_title_template) {
      finalTitle = renderTemplate(config.inapp_title_template, vars);
    } else {
      finalTitle = `[${templateName}] Solicitud #${requestNumber}: ${vars.new_status}`;
    }

    if (config?.inapp_body_template) {
      finalMessage = renderTemplate(config.inapp_body_template, vars);
    } else {
      finalMessage = `${message}<br><br>Tipo: ${templateName}<br>Solicitud #${requestNumber}<br>Ver solicitud: <a href="${requestLink}">${requestLink}</a>`;
    }

    if (config?.email_subject_template) {
      emailSubject = renderTemplateHtml(config.email_subject_template, vars);
    } else {
      emailSubject = htmlEscape(finalTitle);
    }

    if (config?.email_body_template) {
      emailBodyContent = renderTemplateHtml(config.email_body_template, vars);
    } else {
      emailBodyContent = `<p>${htmlEscape(message)}</p>`;
    }

    // 4️⃣ Get recipients based on config — smart filtering by group & role
    const targetRoles: string[] = config?.target_roles || ["revisor", "ejecutor", "administrador"];
    const includeCreator: boolean = config?.include_creator ?? true;

    const requestGroupId: string | null = (requestData as any).group_id;
    const executorGroupId: string | null = (requestData as any).form_templates?.executor_group_id || null;

    // Get workflow step roles for this request (to know which roles are approvers)
    const { data: workflowSteps } = await supabase
      .from("request_workflow_steps")
      .select("role_name")
      .eq("request_id", requestId);
    const workflowRoles = new Set((workflowSteps || []).map((s: any) => s.role_name));

    const userIds = new Set<string>();

    for (const role of targetRoles) {
      if (role === "administrador") {
        // Admin: always notified
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "administrador");
        (admins || []).forEach((r: any) => userIds.add(r.user_id));

      } else if (role === "gerencia" || role === "revisor") {
        // Gerencia/Revisor: only if they belong to the request's group
        if (requestGroupId) {
          const { data: groupMembers } = await supabase
            .from("user_groups")
            .select("user_id")
            .eq("group_id", requestGroupId);
          const groupUserIds = new Set((groupMembers || []).map((m: any) => m.user_id));

          const { data: roleUsers } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", role);
          (roleUsers || []).forEach((r: any) => {
            if (groupUserIds.has(r.user_id)) userIds.add(r.user_id);
          });
        }

      } else if (role === "ejecutor") {
        // Ejecutor: only if they belong to the template's executor_group
        if (executorGroupId) {
          const { data: execGroupMembers } = await supabase
            .from("user_groups")
            .select("user_id")
            .eq("group_id", executorGroupId);
          const execGroupUserIds = new Set((execGroupMembers || []).map((m: any) => m.user_id));

          const { data: roleUsers } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "ejecutor");
          (roleUsers || []).forEach((r: any) => {
            if (execGroupUserIds.has(r.user_id)) userIds.add(r.user_id);
          });
        }

      } else if (role === "procesos" || role === "integridad_datos") {
        // Procesos/Integridad: if they are approvers in the workflow, OR belong to executor group
        if (workflowRoles.has(role)) {
          const { data: roleUsers } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", role);
          (roleUsers || []).forEach((r: any) => userIds.add(r.user_id));
        }
        // Also include if they belong to executor group
        if (executorGroupId) {
          const { data: execGroupMembers } = await supabase
            .from("user_groups")
            .select("user_id")
            .eq("group_id", executorGroupId);
          const execGroupUserIds = new Set((execGroupMembers || []).map((m: any) => m.user_id));

          const { data: roleUsers } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", role);
          (roleUsers || []).forEach((r: any) => {
            if (execGroupUserIds.has(r.user_id)) userIds.add(r.user_id);
          });
        }

      } else {
        // Any other role: include all users with that role (fallback)
        const { data: roleUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", role);
        (roleUsers || []).forEach((r: any) => userIds.add(r.user_id));
      }
    }

    // Include creator if configured
    if (includeCreator && requestData.created_by) {
      userIds.add(requestData.created_by);
    }

    // Get profiles for all user IDs
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", Array.from(userIds));

    const uniqueUsers = profiles || [];

    if (uniqueUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, info: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5️⃣ Save in-app notifications (if channel enabled)
    const channelInapp = config?.channel_inapp ?? true;
    const channelEmail = config?.channel_email ?? true;

    if (channelInapp) {
      await supabase.from("notifications").insert(
        uniqueUsers.map((u: any) => ({
          user_id: u.id,
          request_id: requestId,
          type: eventType,
          title: finalTitle,
          message: finalMessage,
        }))
      );
    }

    // 6️⃣ Send to n8n for email (if channel enabled)
    const n8nWebhookUrl = Deno.env.get("N8N_EMAIL_WEBHOOK_URL");

    if (channelEmail && n8nWebhookUrl) {
      const safeTemplateNameHtml = htmlEscape(templateName);
      const safeRequestNumberHtml = htmlEscape(requestNumber);
      const safeRequestLinkHtml = htmlEscape(requestLink);

      const htmlBody = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">📋 Sistema de Solicitudes</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;font-weight:600;">${emailSubject}</h2>
              <div style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">${emailBodyContent}</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;color:#64748b;font-size:13px;width:140px;">Tipo</td>
                        <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${safeTemplateNameHtml}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#64748b;font-size:13px;">Nº Solicitud</td>
                        <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">#${safeRequestNumberHtml}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="background-color:#2563eb;border-radius:8px;">
                    <a href="${safeRequestLinkHtml}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      Ver Solicitud →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                Este es un mensaje automático del Sistema de Solicitudes de Compras.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          requestNumber,
          requestLink,
          eventType,
          title: emailSubject,
          message: finalMessage,
          htmlBody,
          recipients: uniqueUsers.map((u: any) => ({
            email: u.email,
            name: u.name,
          })),
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
