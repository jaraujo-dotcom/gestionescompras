export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      external_invitations: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          expires_at: string
          guest_email: string | null
          guest_name: string | null
          id: string
          request_id: string
          status: string
          token: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          request_id: string
          status?: string
          token: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          request_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_invitations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          dependency_json: Json | null
          external_mode: string
          field_key: string
          field_order: number
          field_type: Database["public"]["Enums"]["field_type"]
          id: string
          is_external: boolean
          is_required: boolean
          label: string
          options_json: Json | null
          placeholder: string | null
          section_id: string | null
          table_schema_json: Json | null
          template_id: string
          updated_at: string
          validation_json: Json | null
        }
        Insert: {
          created_at?: string
          dependency_json?: Json | null
          external_mode?: string
          field_key: string
          field_order?: number
          field_type: Database["public"]["Enums"]["field_type"]
          id?: string
          is_external?: boolean
          is_required?: boolean
          label: string
          options_json?: Json | null
          placeholder?: string | null
          section_id?: string | null
          table_schema_json?: Json | null
          template_id: string
          updated_at?: string
          validation_json?: Json | null
        }
        Update: {
          created_at?: string
          dependency_json?: Json | null
          external_mode?: string
          field_key?: string
          field_order?: number
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          is_external?: boolean
          is_required?: boolean
          label?: string
          options_json?: Json | null
          placeholder?: string | null
          section_id?: string | null
          table_schema_json?: Json | null
          template_id?: string
          updated_at?: string
          validation_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "form_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_collapsible: boolean
          name: string
          section_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_collapsible?: boolean
          name: string
          section_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_collapsible?: boolean
          name?: string
          section_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_workflow_id: string | null
          description: string | null
          executor_group_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_workflow_id?: string | null
          description?: string | null
          executor_group_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_workflow_id?: string | null
          description?: string | null
          executor_group_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_default_workflow_id_fkey"
            columns: ["default_workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_templates_executor_group_id_fkey"
            columns: ["executor_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          request_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          request_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          request_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      request_approvals: {
        Row: {
          approved_by: string
          comment: string | null
          created_at: string
          id: string
          request_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by: string
          comment?: string | null
          created_at?: string
          id?: string
          request_id: string
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string
          comment?: string | null
          created_at?: string
          id?: string
          request_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_items: {
        Row: {
          cantidad: number
          categoria: string
          codigo_interno: string | null
          created_at: string
          id: string
          item_order: number
          nombre_articulo: string
          observaciones: string | null
          precio_estimado: number | null
          request_id: string
          unidad_medida: string
        }
        Insert: {
          cantidad?: number
          categoria: string
          codigo_interno?: string | null
          created_at?: string
          id?: string
          item_order?: number
          nombre_articulo: string
          observaciones?: string | null
          precio_estimado?: number | null
          request_id: string
          unidad_medida: string
        }
        Update: {
          cantidad?: number
          categoria?: string
          codigo_interno?: string | null
          created_at?: string
          id?: string
          item_order?: number
          nombre_articulo?: string
          observaciones?: string | null
          precio_estimado?: number | null
          request_id?: string
          unidad_medida?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          changed_by: string
          comment: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["request_status"] | null
          id: string
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          changed_by: string
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          changed_by?: string
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_workflow_steps: {
        Row: {
          approved_by: string | null
          comment: string | null
          created_at: string | null
          id: string
          label: string
          request_id: string | null
          role_name: string
          status: string
          step_order: number
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          label: string
          request_id?: string | null
          role_name: string
          status?: string
          step_order: number
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          label?: string
          request_id?: string | null
          role_name?: string
          status?: string
          step_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_workflow_steps_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_workflow_steps_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          created_at: string
          created_by: string
          data_json: Json
          group_id: string | null
          id: string
          request_number: number
          status: Database["public"]["Enums"]["request_status"]
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data_json?: Json
          group_id?: string | null
          id?: string
          request_number?: number
          status?: Database["public"]["Enums"]["request_status"]
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data_json?: Json
          group_id?: string | null
          id?: string
          request_number?: number
          status?: Database["public"]["Enums"]["request_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      role_definitions: {
        Row: {
          can_approve: boolean | null
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_system: boolean | null
          role_key: string
        }
        Insert: {
          can_approve?: boolean | null
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean | null
          role_key: string
        }
        Update: {
          can_approve?: boolean | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean | null
          role_key?: string
        }
        Relationships: []
      }
      user_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_steps: {
        Row: {
          created_at: string | null
          id: string
          label: string
          role_name: string
          step_order: number
          workflow_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          role_name: string
          step_order: number
          workflow_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          role_name?: string
          step_order?: number
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_request: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      get_notifiable_users: {
        Args: { _exclude_user_id?: string; _request_id: string }
        Returns: {
          user_email: string
          user_id: string
          user_name: string
          user_role: string
        }[]
      }
      get_profiles_by_ids: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_user_group_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_in_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "solicitante"
        | "revisor"
        | "ejecutor"
        | "administrador"
        | "gerencia"
        | "procesos"
        | "integridad_datos"
      field_type:
        | "text"
        | "number"
        | "date"
        | "select"
        | "boolean"
        | "table"
        | "file"
      request_status:
        | "borrador"
        | "en_revision"
        | "devuelta"
        | "aprobada"
        | "en_ejecucion"
        | "completada"
        | "rechazada"
        | "anulada"
        | "en_espera"
        | "esperando_tercero"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "solicitante",
        "revisor",
        "ejecutor",
        "administrador",
        "gerencia",
        "procesos",
        "integridad_datos",
      ],
      field_type: [
        "text",
        "number",
        "date",
        "select",
        "boolean",
        "table",
        "file",
      ],
      request_status: [
        "borrador",
        "en_revision",
        "devuelta",
        "aprobada",
        "en_ejecucion",
        "completada",
        "rechazada",
        "anulada",
        "en_espera",
        "esperando_tercero",
      ],
    },
  },
} as const
