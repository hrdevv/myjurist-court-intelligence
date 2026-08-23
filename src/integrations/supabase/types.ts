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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          case_id: string | null
          created_at: string
          detail: Json | null
          id: string
          session_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          session_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          session_id?: string | null
        }
        Relationships: []
      }
      case_members: {
        Row: {
          case_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_members_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          court: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          reference: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          court?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          reference: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          court?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          reference?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      claim_anchors: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          match_score: number | null
          quote: string | null
          segment_id: string | null
          status: string
          verified_at: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          match_score?: number | null
          quote?: string | null
          segment_id?: string | null
          status?: string
          verified_at?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          match_score?: number | null
          quote?: string | null
          segment_id?: string | null
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_anchors_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_anchors_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "transcript_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          id: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          session_id: string
          source_model: string | null
          support: string
          text: string
          type: string
          updated_at: string
          warning: string | null
        }
        Insert: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          session_id: string
          source_model?: string | null
          support?: string
          text: string
          type?: string
          updated_at?: string
          warning?: string | null
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          session_id?: string
          source_model?: string | null
          support?: string
          text?: string
          type?: string
          updated_at?: string
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          checksum: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          session_id: string
          size_bytes: number | null
          status: string
          storage_path: string | null
          type: string
          updated_at: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          session_id: string
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          session_id?: string
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          checksum: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          id: string
          mime: string | null
          session_id: string
          size_bytes: number | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          mime?: string | null
          session_id: string
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          mime?: string | null
          session_id?: string
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          case_id: string
          created_at: string
          date: string | null
          id: string
          is_demo: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          date?: string | null
          id?: string
          is_demo?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          date?: string | null
          id?: string
          is_demo?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_segments: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          end_ms: number | null
          id: string
          session_id: string
          speaker: string
          start_ms: number | null
          text: string
          timestamp_label: string | null
          updated_at: string
          version: number
        }
        Insert: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          end_ms?: number | null
          id?: string
          session_id: string
          speaker?: string
          start_ms?: number | null
          text?: string
          timestamp_label?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          end_ms?: number | null
          id?: string
          session_id?: string
          speaker?: string
          start_ms?: number | null
          text?: string
          timestamp_label?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_versions: {
        Row: {
          created_at: string
          edited_by: string | null
          id: string
          segment_id: string
          text: string
          version: number
        }
        Insert: {
          created_at?: string
          edited_by?: string | null
          id?: string
          segment_id: string
          text: string
          version: number
        }
        Update: {
          created_at?: string
          edited_by?: string | null
          id?: string
          segment_id?: string
          text?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "transcript_versions_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "transcript_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_session: { Args: { _session_id: string }; Returns: boolean }
      has_review_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_case_member: { Args: { _case_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "lawyer" | "paralegal" | "reviewer" | "viewer"
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
      app_role: ["lawyer", "paralegal", "reviewer", "viewer"],
    },
  },
} as const
