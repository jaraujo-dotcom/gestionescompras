import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

  try {
    const body = await req.json();
    const { requestId, eventType, title, message, triggeredBy, newStatus, baseUrl } = body;

    if (!requestId || typeof requestId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid requestId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Get request info
    const { data: requestData, error: requestError } = await supabase
      .from("requests")
      .select("request_number, status, template_id, title, created_by, group_id, form_templates(name, executor_group_id)")
      .eq("id", requestId)
      .single();

    if (requestError) throw requestError;

    const requestNumber = String(requestData.request_number).padStart(6, "0");
    const templateName = (requestData as any).form_templates?.name || "General";
    const requestStatus = (requestData as any).status || "";
    const appUrl = baseUrl || Deno.env.get("APP_URL") || "https://gestiones-compras.vercel.app";
    const requestLink = `${appUrl}/requests/${requestId}`;

    // Get triggeredBy user name
    let userName = "";
    if (triggeredBy) {
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", triggeredBy).single();
      userName = profile?.name || "";
    }

    // ── Build recipients using smart filtering ──
    const requestGroupId: string | null = (requestData as any).group_id;
    const executorGroupId: string | null = (requestData as any).form_templates?.executor_group_id || null;

    const { data: workflowSteps } = await supabase
      .from("request_workflow_steps").select("role_name").eq("request_id", requestId);
    const workflowRoles = new Set((workflowSteps || []).map((s: any) => s.role_name));

    const userIds = new Set<string>();

    // Admin: always
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "administrador");
    (admins || []).forEach((r: any) => userIds.add(r.user_id));

    // Gerencia/Revisor: only if in request's group
    if (requestGroupId) {
      const { data: groupMembers } = await supabase.from("user_groups").select("user_id").eq("group_id", requestGroupId);
      const groupUserIds = new Set((groupMembers || []).map((m: any) => m.user_id));

      for (const role of ["gerencia", "revisor"]) {
        const { data: roleUsers } = await supabase.from("user_roles").select("user_id").eq("role", role);
        (roleUsers || []).forEach((r: any) => { if (groupUserIds.has(r.user_id)) userIds.add(r.user_id); });
      }
    }

    // Ejecutor: only if in executor group AND request is aprobada or later
    const executorStatuses = new Set(["aprobada", "en_ejecucion", "en_espera", "completada", "anulada"]);
    if (executorGroupId && executorStatuses.has(newStatus || requestStatus)) {
      const { data: execMembers } = await supabase.from("user_groups").select("user_id").eq("group_id", executorGroupId);
      const execUserIds = new Set((execMembers || []).map((m: any) => m.user_id));

      const { data: ejecutores } = await supabase.from("user_roles").select("user_id").eq("role", "ejecutor");
      (ejecutores || []).forEach((r: any) => { if (execUserIds.has(r.user_id)) userIds.add(r.user_id); });
    }

    // Procesos/Integridad: if approver in workflow OR in executor group
    for (const role of ["procesos", "integridad_datos"]) {
      if (workflowRoles.has(role)) {
        const { data: roleUsers } = await supabase.from("user_roles").select("user_id").eq("role", role);
        (roleUsers || []).forEach((r: any) => userIds.add(r.user_id));
      }
      if (executorGroupId) {
        const { data: execMembers } = await supabase.from("user_groups").select("user_id").eq("group_id", executorGroupId);
        const execUserIds = new Set((execMembers || []).map((m: any) => m.user_id));
        const { data: roleUsers } = await supabase.from("user_roles").select("user_id").eq("role", role);
        (roleUsers || []).forEach((r: any) => { if (execUserIds.has(r.user_id)) userIds.add(r.user_id); });
      }
    }

    // Exclude the person who triggered the notification
    if (triggeredBy) userIds.delete(triggeredBy);

    // Always re-add creator so they're informed of every event on their request
    if (requestData.created_by) userIds.add(requestData.created_by);
    if (triggeredBy) userIds.delete(triggeredBy);

    const { data: profiles } = await supabase.from("profiles").select("id, name, email").in("id", Array.from(userIds));
    const recipients = profiles || [];

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, info: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── In-app notifications ──
    await supabase.from("notifications").insert(
      recipients.map((u: any) => ({
        user_id: u.id,
        request_id: requestId,
        type: eventType,
        title,
        message,
      }))
    );

    // ── Email via n8n ──
    const n8nWebhookUrl = Deno.env.get("N8N_EMAIL_WEBHOOK_URL");
    if (n8nWebhookUrl) {
      const safeTitle = htmlEscape(title);
      const safeTemplateName = htmlEscape(templateName);
      const safeRequestNumber = htmlEscape(requestNumber);
      const safeRequestLink = htmlEscape(requestLink);
      const safeMessage = htmlEscape(message);

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
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;font-weight:600;">${safeTitle}</h2>
              <div style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">${safeMessage}</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;color:#64748b;font-size:13px;width:140px;">Tipo</td>
                        <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${safeTemplateName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#64748b;font-size:13px;">Nº Solicitud</td>
                        <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">#${safeRequestNumber}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="background-color:#2563eb;border-radius:8px;">
                    <a href="${safeRequestLink}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
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
                Este es un mensaje automático del Sistema de Solicitudes.
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
          requestId, requestNumber, requestLink, eventType,
          title, message, htmlBody,
          recipients: recipients.map((u: any) => ({ email: u.email, name: u.name })),
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-notification error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
