import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (req.method === 'GET') {
      if (!token) {
        return new Response(JSON.stringify({ error: 'Token requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Validate token
      const { data: invitation, error: invError } = await supabase
        .from('external_invitations')
        .select('*')
        .eq('token', token)
        .single()

      if (invError || !invitation) {
        return new Response(JSON.stringify({ error: 'Enlace no válido' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (invitation.status === 'completed') {
        return new Response(JSON.stringify({ error: 'Este enlace ya fue utilizado', code: 'completed' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (new Date(invitation.expires_at) < new Date()) {
        // Mark as expired
        await supabase.from('external_invitations').update({ status: 'expired' }).eq('id', invitation.id)
        return new Response(JSON.stringify({ error: 'Este enlace ha expirado', code: 'expired' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get request
      const { data: request, error: reqError } = await supabase
        .from('requests')
        .select('id, title, request_number, template_id, data_json')
        .eq('id', invitation.request_id)
        .single()

      if (reqError || !request) {
        return new Response(JSON.stringify({ error: 'Solicitud no encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get fields that are external (editable or readonly)
      const { data: allFields } = await supabase
        .from('form_fields')
        .select('*')
        .eq('template_id', request.template_id)
        .order('field_order')

      // Separate: fully external fields (is_external=true) and check external_mode
      const allExtFields = (allFields || []).filter(f => {
        const mode = (f as any).external_mode || (f.is_external ? 'editable' : 'none')
        return mode !== 'none' && f.field_type !== 'table'
      }).map(f => {
        const mode = (f as any).external_mode || (f.is_external ? 'editable' : 'none')
        return { ...f, _readonly: mode === 'readonly' }
      })

      // Also get table fields that have external columns
      const tableFields = (allFields || []).filter(f => {
        if (f.field_type !== 'table') return false
        // Check if the field itself is not already in allExtFields
        const fieldMode = (f as any).external_mode || (f.is_external ? 'editable' : 'none')
        if (fieldMode !== 'none') return false // already handled above (though tables shouldn't be)
        // Check columns
        let schema = f.table_schema_json
        if (typeof schema === 'string') schema = JSON.parse(schema)
        return Array.isArray(schema) && schema.some((col: any) => {
          const colMode = col.external_mode || (col.is_external ? 'editable' : 'none')
          return colMode !== 'none'
        })
      })

      // Process table fields to mark readonly columns
      const filteredTableFields = tableFields.map(f => {
        let schema = f.table_schema_json
        if (typeof schema === 'string') schema = JSON.parse(schema)
        return {
          ...f,
          // Send columns that have any external visibility; mark readonly ones
          table_schema_json: (schema as any[])
            .filter((col: any) => {
              const mode = col.external_mode || (col.is_external ? 'editable' : 'none')
              return mode !== 'none'
            })
            .map((col: any) => {
              const mode = col.external_mode || (col.is_external ? 'editable' : 'none')
              return {
                ...col,
                rules: undefined, // strip rules (may reference internal fields)
                _readonly: mode === 'readonly',
              }
            })
        }
      })

      // Combine and strip dependency_json so external fields always show
      // (dependencies reference internal fields the guest doesn't have)
      const fields = [...(allExtFields || []), ...filteredTableFields].map(f => ({
        ...f,
        dependency_json: null, // always show external fields
      }))
      console.log('External fields:', fields.map(f => ({ key: f.field_key, _readonly: (f as any)._readonly, mode: (f as any).external_mode })))

      // Get sections for external fields
      const sectionIds = [...new Set((fields || []).filter(f => f.section_id).map(f => f.section_id))]
      let sections: any[] = []
      if (sectionIds.length > 0) {
        const { data: sData } = await supabase
          .from('form_sections')
          .select('*')
          .in('id', sectionIds)
          .order('section_order')
        sections = sData || []
      }

      // Filter data_json to only include external field keys
      // For table fields, send existing row data so guest sees context
      const externalKeys = (fields || []).map(f => f.field_key)
      const filteredData: Record<string, any> = {}
      const dataJson = request.data_json as Record<string, any>
      for (const key of externalKeys) {
        if (dataJson[key] !== undefined) {
          filteredData[key] = dataJson[key]
        }
      }

      return new Response(JSON.stringify({
        request: {
          id: request.id,
          title: request.title,
          request_number: request.request_number,
        },
        fields: fields || [],
        sections,
        data: filteredData,
        guest_name: invitation.guest_name,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const postToken = body.token
      const values = body.values as Record<string, any>

      if (!postToken || !values) {
        return new Response(JSON.stringify({ error: 'Token y valores requeridos' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Validate token
      const { data: invitation, error: invError } = await supabase
        .from('external_invitations')
        .select('*')
        .eq('token', postToken)
        .single()

      if (invError || !invitation) {
        return new Response(JSON.stringify({ error: 'Enlace no válido' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (invitation.status !== 'pending') {
        return new Response(JSON.stringify({ error: 'Este enlace ya no es válido' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (new Date(invitation.expires_at) < new Date()) {
        await supabase.from('external_invitations').update({ status: 'expired' }).eq('id', invitation.id)
        return new Response(JSON.stringify({ error: 'Este enlace ha expirado' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get request
      const { data: request } = await supabase
        .from('requests')
        .select('id, data_json, template_id, status, request_number, title')
        .eq('id', invitation.request_id)
        .single()

      if (!request) {
        return new Response(JSON.stringify({ error: 'Solicitud no encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get external field keys to validate
      const { data: externalFields } = await supabase
        .from('form_fields')
        .select('field_key, field_type, table_schema_json, is_external, external_mode')
        .eq('template_id', request.template_id)

      // Build allowed keys: only editable external fields (not readonly)
      const allowedKeys = new Set<string>()
      for (const f of (externalFields || [])) {
        const mode = (f as any).external_mode || (f.is_external ? 'editable' : 'none')
        if (mode === 'editable') {
          allowedKeys.add(f.field_key)
        } else if (f.field_type === 'table') {
          let schema = f.table_schema_json
          if (typeof schema === 'string') schema = JSON.parse(schema)
          if (Array.isArray(schema) && schema.some((col: any) => {
            const colMode = col.external_mode || (col.is_external ? 'editable' : 'none')
            return colMode === 'editable'
          })) {
            allowedKeys.add(f.field_key)
          }
        }
      }

      // Filter values to only allowed keys
      const sanitizedValues: Record<string, any> = {}
      for (const [key, value] of Object.entries(values)) {
        if (allowedKeys.has(key)) {
          sanitizedValues[key] = value
        }
      }

      // Merge with existing data
      const existingData = request.data_json as Record<string, any>
      const mergedData = { ...existingData, ...sanitizedValues }

      // Mark external fields in metadata
      const externalMeta = existingData._external_fields || []
      const updatedExternalMeta = [...new Set([...externalMeta, ...Object.keys(sanitizedValues)])]
      mergedData._external_fields = updatedExternalMeta

      // Update request
      const newStatus = request.status === 'esperando_tercero' ? 'borrador' : request.status
      await supabase
        .from('requests')
        .update({ data_json: mergedData, status: newStatus })
        .eq('id', request.id)

      // Mark invitation as completed
      await supabase
        .from('external_invitations')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', invitation.id)

      // Create in-app notification for the creator
      const reqNum = String(request.request_number).padStart(6, '0')
      const guestLabel = invitation.guest_name || 'Un tercero'
      const notifTitle = `Datos externos recibidos`
      const notifMessage = `${guestLabel} completó los datos externos de la solicitud #${reqNum} "${request.title}".`

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: invitation.created_by,
        title: notifTitle,
        message: notifMessage,
        type: 'external_data',
        request_id: request.id,
      })
      if (notifError) {
        console.error('Error inserting notification:', notifError)
      }

      // Send email notification via n8n webhook
      const n8nWebhookUrl = Deno.env.get('N8N_EMAIL_WEBHOOK_URL')
      if (n8nWebhookUrl) {
        try {
          // Get creator profile for email
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', invitation.created_by)
            .single()

          if (creatorProfile?.email) {
            const appUrl = 'https://gestiones-compras.vercel.app'
            const requestLink = `${appUrl}/requests/${request.id}`

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
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;font-weight:600;">${notifTitle}</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">${notifMessage}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;color:#64748b;font-size:13px;width:140px;">Nº Solicitud</td>
                        <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">#${reqNum}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#64748b;font-size:13px;">Completado por</td>
                        <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${guestLabel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="background-color:#2563eb;border-radius:8px;">
                    <a href="${requestLink}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
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
</html>`

            await fetch(n8nWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requestId: request.id,
                requestNumber: reqNum,
                requestLink,
                eventType: 'external_data',
                title: notifTitle,
                message: notifMessage,
                htmlBody,
                recipients: [{ email: creatorProfile.email, name: creatorProfile.name }],
              }),
            })
          }
        } catch (emailErr) {
          console.error('Error sending email notification:', emailErr)
        }
      }

      // Add status history if status changed
      if (request.status === 'esperando_tercero') {
        await supabase.from('request_status_history').insert({
          request_id: request.id,
          from_status: 'esperando_tercero',
          to_status: 'borrador',
          changed_by: invitation.created_by,
          comment: `Datos externos recibidos de ${invitation.guest_name || 'invitado externo'}`,
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
