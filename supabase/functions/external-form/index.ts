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

      // Get ONLY external fields
      const { data: allExtFields } = await supabase
        .from('form_fields')
        .select('*')
        .eq('template_id', request.template_id)
        .eq('is_external', true)
        .order('field_order')

      // Also get table fields that have external columns
      const { data: tableFields } = await supabase
        .from('form_fields')
        .select('*')
        .eq('template_id', request.template_id)
        .eq('field_type', 'table')
        .eq('is_external', false)
        .order('field_order')

      // Filter table fields to only include those with at least one external column
      const filteredTableFields = (tableFields || []).filter(f => {
        let schema = f.table_schema_json
        if (typeof schema === 'string') schema = JSON.parse(schema)
        return Array.isArray(schema) && schema.some((col: any) => col.is_external)
      }).map(f => {
        let schema = f.table_schema_json
        if (typeof schema === 'string') schema = JSON.parse(schema)
        return {
          ...f,
          // Only keep external columns, strip their rules (may reference internal fields)
          table_schema_json: (schema as any[])
            .filter((col: any) => col.is_external)
            .map((col: any) => ({ ...col, rules: undefined }))
        }
      })

      // Combine and strip dependency_json so external fields always show
      // (dependencies reference internal fields the guest doesn't have)
      const fields = [...(allExtFields || []), ...filteredTableFields].map(f => ({
        ...f,
        dependency_json: null, // always show external fields
      }))
      console.log('External fields count:', (allExtFields || []).length, 'Table fields with ext cols:', filteredTableFields.length, 'Total:', fields.length)

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
        .select('field_key, field_type, table_schema_json, is_external')
        .eq('template_id', request.template_id)

      // Build allowed keys: fully external fields + table fields with external columns
      const allowedKeys = new Set<string>()
      for (const f of (externalFields || [])) {
        if (f.is_external) {
          allowedKeys.add(f.field_key)
        } else if (f.field_type === 'table') {
          let schema = f.table_schema_json
          if (typeof schema === 'string') schema = JSON.parse(schema)
          if (Array.isArray(schema) && schema.some((col: any) => col.is_external)) {
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

      // Create notification for the creator
      await supabase.from('notifications').insert({
        user_id: invitation.created_by,
        title: `Datos externos recibidos`,
        message: `${invitation.guest_name || 'Un tercero'} completó los datos externos de la solicitud #${String(request.request_number).padStart(6, '0')} "${request.title}".`,
        type: 'external_data',
        request_id: request.id,
      })

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
