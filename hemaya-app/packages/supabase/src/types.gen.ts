export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          scopes: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          scopes?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          scopes?: string[]
        }
        Relationships: []
      }
      approval_chains: {
        Row: {
          active: boolean | null
          approver: string
          entity: Database["public"]["Enums"]["competent_entity"]
          id: string
          sla: string | null
          step_no: number
        }
        Insert: {
          active?: boolean | null
          approver: string
          entity: Database["public"]["Enums"]["competent_entity"]
          id?: string
          sla?: string | null
          step_no: number
        }
        Update: {
          active?: boolean | null
          approver?: string
          entity?: Database["public"]["Enums"]["competent_entity"]
          id?: string
          sla?: string | null
          step_no?: number
        }
        Relationships: []
      }
      assessments: {
        Row: {
          case_id: string
          created_at: string | null
          evaluator_id: string
          id: string
          notes: string | null
          partial_reason: string | null
          proposed_duration: string | null
          proposed_type: Json | null
          recommendation: string | null
          reject_reasons: Json | null
          submitted_at: string | null
        }
        Insert: {
          case_id: string
          created_at?: string | null
          evaluator_id: string
          id?: string
          notes?: string | null
          partial_reason?: string | null
          proposed_duration?: string | null
          proposed_type?: Json | null
          recommendation?: string | null
          reject_reasons?: Json | null
          submitted_at?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string | null
          evaluator_id?: string
          id?: string
          notes?: string | null
          partial_reason?: string | null
          proposed_duration?: string | null
          proposed_type?: Json | null
          recommendation?: string | null
          reject_reasons?: Json | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          device: string | null
          hash: string | null
          id: number
          ip: unknown
          prev_hash: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          device?: string | null
          hash?: string | null
          id?: never
          ip?: unknown
          prev_hash?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          device?: string | null
          hash?: string | null
          id?: never
          ip?: unknown
          prev_hash?: string | null
          target?: string | null
        }
        Relationships: []
      }
      board_decisions: {
        Row: {
          case_id: string
          decided_at: string | null
          duration: string | null
          id: string
          justification: string
          tie_break: boolean | null
          type: Database["public"]["Enums"]["decision_type"]
          votes: Json | null
        }
        Insert: {
          case_id: string
          decided_at?: string | null
          duration?: string | null
          id?: string
          justification: string
          tie_break?: boolean | null
          type: Database["public"]["Enums"]["decision_type"]
          votes?: Json | null
        }
        Update: {
          case_id?: string
          decided_at?: string | null
          duration?: string | null
          id?: string
          justification?: string
          tie_break?: boolean | null
          type?: Database["public"]["Enums"]["decision_type"]
          votes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "board_decisions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          active: boolean | null
          created_at: string | null
          entity: Database["public"]["Enums"]["competent_entity"]
          id: string
          is_hq: boolean | null
          liaison_officer: string | null
          name: string
          region: Database["public"]["Enums"]["region_code"]
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          entity: Database["public"]["Enums"]["competent_entity"]
          id?: string
          is_hq?: boolean | null
          liaison_officer?: string | null
          name: string
          region: Database["public"]["Enums"]["region_code"]
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          entity?: Database["public"]["Enums"]["competent_entity"]
          id?: string
          is_hq?: boolean | null
          liaison_officer?: string | null
          name?: string
          region?: Database["public"]["Enums"]["region_code"]
        }
        Relationships: []
      }
      challenges: {
        Row: {
          authored_by: string | null
          challenge: string
          created_at: string | null
          evidence_metric: string | null
          id: string
          period: string
          solution: string | null
        }
        Insert: {
          authored_by?: string | null
          challenge: string
          created_at?: string | null
          evidence_metric?: string | null
          id?: string
          period: string
          solution?: string | null
        }
        Update: {
          authored_by?: string | null
          challenge?: string
          created_at?: string | null
          evidence_metric?: string | null
          id?: string
          period?: string
          solution?: string | null
        }
        Relationships: []
      }
      consultation_sessions: {
        Row: {
          id: string
          kind: string | null
          notes: string | null
          referral_id: string | null
          scheduled_at: string | null
        }
        Insert: {
          id?: string
          kind?: string | null
          notes?: string | null
          referral_id?: string | null
          scheduled_at?: string | null
        }
        Update: {
          id?: string
          kind?: string | null
          notes?: string | null
          referral_id?: string | null
          scheduled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_sessions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_logs: {
        Row: {
          case_id: string
          channel: string
          created_at: string | null
          id: string
          officer_id: string | null
          result: string
          summary: string
        }
        Insert: {
          case_id: string
          channel?: string
          created_at?: string | null
          id?: string
          officer_id?: string | null
          result?: string
          summary: string
        }
        Update: {
          case_id?: string
          channel?: string
          created_at?: string | null
          id?: string
          officer_id?: string | null
          result?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      coord_messages: {
        Row: {
          body: string
          created_at: string
          from_authority: string
          id: string
          sender_label: string | null
          to_authority: string
        }
        Insert: {
          body: string
          created_at?: string
          from_authority: string
          id?: string
          sender_label?: string | null
          to_authority: string
        }
        Update: {
          body?: string
          created_at?: string
          from_authority?: string
          id?: string
          sender_label?: string | null
          to_authority?: string
        }
        Relationships: []
      }
      council_attachments: {
        Row: {
          case_id: string
          doc_group: string
          doc_id: string
          file_name: string | null
          id: string
          label: string
          storage_path: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          doc_group?: string
          doc_id: string
          file_name?: string | null
          id?: string
          label: string
          storage_path?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          doc_group?: string
          doc_id?: string
          file_name?: string | null
          id?: string
          label?: string
          storage_path?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_attachments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      council_decisions: {
        Row: {
          case_id: string
          created_at: string | null
          deadline_closed: boolean
          deputy_approved_at: string | null
          duration: string | null
          id: string
          issued_at: string | null
          issued_reason: string | null
          issued_type: string | null
          preparer_id: string | null
          reasoning: string | null
          ref: string | null
          rejections: Json
          status: string
          submitted_at: string | null
          types: Json
          updated_at: string | null
          voting_started_at: string | null
        }
        Insert: {
          case_id: string
          created_at?: string | null
          deadline_closed?: boolean
          deputy_approved_at?: string | null
          duration?: string | null
          id?: string
          issued_at?: string | null
          issued_reason?: string | null
          issued_type?: string | null
          preparer_id?: string | null
          reasoning?: string | null
          ref?: string | null
          rejections?: Json
          status?: string
          submitted_at?: string | null
          types?: Json
          updated_at?: string | null
          voting_started_at?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string | null
          deadline_closed?: boolean
          deputy_approved_at?: string | null
          duration?: string | null
          id?: string
          issued_at?: string | null
          issued_reason?: string | null
          issued_type?: string | null
          preparer_id?: string | null
          reasoning?: string | null
          ref?: string | null
          rejections?: Json
          status?: string
          submitted_at?: string | null
          types?: Json
          updated_at?: string | null
          voting_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_decisions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      council_messages: {
        Row: {
          body: string
          case_id: string
          created_at: string
          id: string
          party: string
          party_uid: string
          sender_uid: string
          with_seat: string
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          id?: string
          party: string
          party_uid: string
          sender_uid: string
          with_seat: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          party?: string
          party_uid?: string
          sender_uid?: string
          with_seat?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      council_votes: {
        Row: {
          case_id: string
          choice: string
          id: string
          note: string | null
          voted_at: string | null
          voter_id: string
        }
        Insert: {
          case_id: string
          choice: string
          id?: string
          note?: string | null
          voted_at?: string | null
          voter_id: string
        }
        Update: {
          case_id?: string
          choice?: string
          id?: string
          note?: string | null
          voted_at?: string | null
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_votes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      disclosure_events: {
        Row: {
          actor_id: string | null
          basis: string
          case_id: string
          created_at: string | null
          id: string
          scope: string | null
          subject_notified: boolean | null
        }
        Insert: {
          actor_id?: string | null
          basis: string
          case_id: string
          created_at?: string | null
          id?: string
          scope?: string | null
          subject_notified?: boolean | null
        }
        Update: {
          actor_id?: string | null
          basis?: string
          case_id?: string
          created_at?: string | null
          id?: string
          scope?: string | null
          subject_notified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "disclosure_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_reports: {
        Row: {
          case_id: string | null
          escalation: Json | null
          id: string
          reported_at: string | null
          status: string | null
        }
        Insert: {
          case_id?: string | null
          escalation?: Json | null
          id?: string
          reported_at?: string | null
          status?: string | null
        }
        Update: {
          case_id?: string | null
          escalation?: Json | null
          id?: string
          reported_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_reports_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_handoffs: {
        Row: {
          board_review_due: string | null
          case_id: string
          created_at: string | null
          decided_by: string | null
          id: string
          status: string
          track: string
          types: string[] | null
        }
        Insert: {
          board_review_due?: string | null
          case_id: string
          created_at?: string | null
          decided_by?: string | null
          id?: string
          status?: string
          track: string
          types?: string[] | null
        }
        Update: {
          board_review_due?: string | null
          case_id?: string
          created_at?: string | null
          decided_by?: string | null
          id?: string
          status?: string
          track?: string
          types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_handoffs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      foreign_requests: {
        Row: {
          auth_kind: string | null
          authority: string | null
          basis: string | null
          case_id: string | null
          category: string | null
          city: string | null
          country: string | null
          created_at: string | null
          foreign_ref: string | null
          id: string
          pg_decision: string | null
          reciprocity: boolean | null
          ref: string | null
          secret: string | null
          status: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          auth_kind?: string | null
          authority?: string | null
          basis?: string | null
          case_id?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          foreign_ref?: string | null
          id?: string
          pg_decision?: string | null
          reciprocity?: boolean | null
          ref?: string | null
          secret?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_kind?: string | null
          authority?: string | null
          basis?: string | null
          case_id?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          foreign_ref?: string | null
          id?: string
          pg_decision?: string | null
          reciprocity?: boolean | null
          ref?: string | null
          secret?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foreign_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      grievances: {
        Row: {
          advisor_decision: Json | null
          against: string | null
          applicant_reason: string | null
          assigned_at: string | null
          assigned_to: string | null
          case_id: string
          decision_due: string | null
          decision_ref: string | null
          filed_at: string | null
          id: string
          office_decision: Json | null
          outcome: string | null
          ref: string | null
          return_log: Json
          scope: string | null
          status: Database["public"]["Enums"]["grievance_status"] | null
          tech_opinion: string | null
        }
        Insert: {
          advisor_decision?: Json | null
          against?: string | null
          applicant_reason?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          case_id: string
          decision_due?: string | null
          decision_ref?: string | null
          filed_at?: string | null
          id?: string
          office_decision?: Json | null
          outcome?: string | null
          ref?: string | null
          return_log?: Json
          scope?: string | null
          status?: Database["public"]["Enums"]["grievance_status"] | null
          tech_opinion?: string | null
        }
        Update: {
          advisor_decision?: Json | null
          against?: string | null
          applicant_reason?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          case_id?: string
          decision_due?: string | null
          decision_ref?: string | null
          filed_at?: string | null
          id?: string
          office_decision?: Json | null
          outcome?: string | null
          ref?: string | null
          return_log?: Json
          scope?: string | null
          status?: Database["public"]["Enums"]["grievance_status"] | null
          tech_opinion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grievances_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      imminent_protections: {
        Row: {
          approver_id: string | null
          case_id: string
          created_at: string | null
          extended: boolean | null
          id: string
          max_duration: string | null
        }
        Insert: {
          approver_id?: string | null
          case_id: string
          created_at?: string | null
          extended?: boolean | null
          id?: string
          max_duration?: string | null
        }
        Update: {
          approver_id?: string | null
          case_id?: string
          created_at?: string | null
          extended?: boolean | null
          id?: string
          max_duration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imminent_protections_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      leadership_messages: {
        Row: {
          author_id: string
          author_role: Database["public"]["Enums"]["app_role"]
          body: string
          case_id: string
          created_at: string
          direction: string
          id: string
          leader: string
          read_at: string | null
        }
        Insert: {
          author_id: string
          author_role: Database["public"]["Enums"]["app_role"]
          body: string
          case_id: string
          created_at?: string
          direction: string
          id?: string
          leader: string
          read_at?: string | null
        }
        Update: {
          author_id?: string
          author_role?: Database["public"]["Enums"]["app_role"]
          body?: string
          case_id?: string
          created_at?: string
          direction?: string
          id?: string
          leader?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leadership_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_reviews: {
        Row: {
          case_id: string
          created_at: string | null
          decided_at: string | null
          decision: Json | null
          id: string
          officer_id: string | null
          proposal: Database["public"]["Enums"]["review_outcome"] | null
          rationale: string | null
          status: Database["public"]["Enums"]["review_status"] | null
        }
        Insert: {
          case_id: string
          created_at?: string | null
          decided_at?: string | null
          decision?: Json | null
          id?: string
          officer_id?: string | null
          proposal?: Database["public"]["Enums"]["review_outcome"] | null
          rationale?: string | null
          status?: Database["public"]["Enums"]["review_status"] | null
        }
        Update: {
          case_id?: string
          created_at?: string | null
          decided_at?: string | null
          decision?: Json | null
          id?: string
          officer_id?: string | null
          proposal?: Database["public"]["Enums"]["review_outcome"] | null
          rationale?: string | null
          status?: Database["public"]["Enums"]["review_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      measures: {
        Row: {
          assignee_org: string | null
          case_id: string
          id: string
          status: string | null
          temp_id_controls: Json | null
          type_ref: string | null
          written_consent: boolean | null
        }
        Insert: {
          assignee_org?: string | null
          case_id: string
          id?: string
          status?: string | null
          temp_id_controls?: Json | null
          type_ref?: string | null
          written_consent?: boolean | null
        }
        Update: {
          assignee_org?: string | null
          case_id?: string
          id?: string
          status?: string | null
          temp_id_controls?: Json | null
          type_ref?: string | null
          written_consent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "measures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          case_id: string
          created_at: string | null
          direction: Database["public"]["Enums"]["msg_dir"]
          id: string
          sender_label: string | null
          thread: Database["public"]["Enums"]["msg_thread"]
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string | null
          direction: Database["public"]["Enums"]["msg_dir"]
          id?: string
          sender_label?: string | null
          thread?: Database["public"]["Enums"]["msg_thread"]
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string | null
          direction?: Database["public"]["Enums"]["msg_dir"]
          id?: string
          sender_label?: string | null
          thread?: Database["public"]["Enums"]["msg_thread"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notif_key: string
          read_at: string
          user_id: string
        }
        Insert: {
          notif_key: string
          read_at?: string
          user_id: string
        }
        Update: {
          notif_key?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          authority: Database["public"]["Enums"]["referral_authority"] | null
          body: string | null
          case_id: string | null
          channel: string | null
          created_at: string | null
          crit: boolean
          due_at: string | null
          id: string
          read: boolean | null
          recipient_id: string | null
          sent_at: string | null
          target_tab: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          authority?: Database["public"]["Enums"]["referral_authority"] | null
          body?: string | null
          case_id?: string | null
          channel?: string | null
          created_at?: string | null
          crit?: boolean
          due_at?: string | null
          id?: string
          read?: boolean | null
          recipient_id?: string | null
          sent_at?: string | null
          target_tab?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          authority?: Database["public"]["Enums"]["referral_authority"] | null
          body?: string | null
          case_id?: string | null
          channel?: string | null
          created_at?: string | null
          crit?: boolean
          due_at?: string | null
          id?: string
          read?: boolean | null
          recipient_id?: string | null
          sent_at?: string | null
          target_tab?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          acknowledged: boolean | null
          case_id: string
          id: string
          text: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          case_id: string
          id?: string
          text?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          case_id?: string
          id?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obligations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      office_messages: {
        Row: {
          author_id: string
          author_label: string
          body: string
          channel: string
          created_at: string
          grievance_id: string
          id: string
        }
        Insert: {
          author_id: string
          author_label: string
          body: string
          channel: string
          created_at?: string
          grievance_id: string
          id?: string
        }
        Update: {
          author_id?: string
          author_label?: string
          body?: string
          channel?: string
          created_at?: string
          grievance_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_messages_grievance_id_fkey"
            columns: ["grievance_id"]
            isOneToOne: false
            referencedRelation: "grievances"
            referencedColumns: ["id"]
          },
        ]
      }
      periodic_reviews: {
        Row: {
          case_id: string
          due_date: string | null
          id: string
          outcome: string | null
        }
        Insert: {
          case_id: string
          due_date?: string | null
          id?: string
          outcome?: string | null
        }
        Update: {
          case_id?: string
          due_date?: string | null
          id?: string
          outcome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "periodic_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      protection_cases: {
        Row: {
          branch_id: string | null
          case_region: Database["public"]["Enums"]["region_code"] | null
          category: Database["public"]["Enums"]["app_category"]
          classification: Database["public"]["Enums"]["risk_level"] | null
          created_at: string | null
          id: string
          officer_id: string | null
          ref_no: string
          secret_code: string
          source: Database["public"]["Enums"]["case_source"]
          status: Database["public"]["Enums"]["case_status"]
          submitted_by: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          case_region?: Database["public"]["Enums"]["region_code"] | null
          category: Database["public"]["Enums"]["app_category"]
          classification?: Database["public"]["Enums"]["risk_level"] | null
          created_at?: string | null
          id?: string
          officer_id?: string | null
          ref_no: string
          secret_code: string
          source?: Database["public"]["Enums"]["case_source"]
          status?: Database["public"]["Enums"]["case_status"]
          submitted_by?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          case_region?: Database["public"]["Enums"]["region_code"] | null
          category?: Database["public"]["Enums"]["app_category"]
          classification?: Database["public"]["Enums"]["risk_level"] | null
          created_at?: string | null
          id?: string
          officer_id?: string | null
          ref_no?: string
          secret_code?: string
          source?: Database["public"]["Enums"]["case_source"]
          status?: Database["public"]["Enums"]["case_status"]
          submitted_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protection_cases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      protection_documents: {
        Row: {
          case_id: string
          id: string
          rights: Json | null
          signature: string | null
          signed_at: string | null
          terms: Json | null
        }
        Insert: {
          case_id: string
          id?: string
          rights?: Json | null
          signature?: string | null
          signed_at?: string | null
          terms?: Json | null
        }
        Update: {
          case_id?: string
          id?: string
          rights?: Json | null
          signature?: string | null
          signed_at?: string | null
          terms?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "protection_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      protection_requests: {
        Row: {
          applicant_role: string | null
          case_id: string
          channel: string | null
          details: Json | null
          id: string
          submitted_at: string | null
        }
        Insert: {
          applicant_role?: string | null
          case_id: string
          channel?: string | null
          details?: Json | null
          id?: string
          submitted_at?: string | null
        }
        Update: {
          applicant_role?: string | null
          case_id?: string
          channel?: string | null
          details?: Json | null
          id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protection_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_approvals: {
        Row: {
          approver: string
          approver_id: string | null
          branch_id: string | null
          created_at: string | null
          decided_at: string | null
          decision: string | null
          due_at: string | null
          id: string
          note: string | null
          recommendation_id: string
          step_no: number
        }
        Insert: {
          approver?: string
          approver_id?: string | null
          branch_id?: string | null
          created_at?: string | null
          decided_at?: string | null
          decision?: string | null
          due_at?: string | null
          id?: string
          note?: string | null
          recommendation_id: string
          step_no?: number
        }
        Update: {
          approver?: string
          approver_id?: string | null
          branch_id?: string | null
          created_at?: string | null
          decided_at?: string | null
          decision?: string | null
          due_at?: string | null
          id?: string
          note?: string | null
          recommendation_id?: string
          step_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_approvals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_approvals_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          approval_status: string | null
          branch_id: string | null
          case_id: string
          channel: string | null
          created_at: string | null
          decision: string | null
          due_at: string | null
          factors9: Json | null
          id: string
          notes: string | null
          proposed_duration: string | null
          proposed_type: Json | null
          raised_at: string | null
          received_at: string | null
          recorded_by: string | null
          source_body: string | null
        }
        Insert: {
          approval_status?: string | null
          branch_id?: string | null
          case_id: string
          channel?: string | null
          created_at?: string | null
          decision?: string | null
          due_at?: string | null
          factors9?: Json | null
          id?: string
          notes?: string | null
          proposed_duration?: string | null
          proposed_type?: Json | null
          raised_at?: string | null
          received_at?: string | null
          recorded_by?: string | null
          source_body?: string | null
        }
        Update: {
          approval_status?: string | null
          branch_id?: string | null
          case_id?: string
          channel?: string | null
          created_at?: string | null
          decision?: string | null
          due_at?: string | null
          factors9?: Json | null
          id?: string
          notes?: string | null
          proposed_duration?: string | null
          proposed_type?: Json | null
          raised_at?: string | null
          received_at?: string | null
          recorded_by?: string | null
          source_body?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          assignee: string | null
          authority: Database["public"]["Enums"]["referral_authority"]
          case_id: string
          created_at: string | null
          history: Json | null
          id: string
          ref: string | null
          result: Json | null
          sched: string | null
          service: string
          status: Database["public"]["Enums"]["referral_status"]
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          assignee?: string | null
          authority: Database["public"]["Enums"]["referral_authority"]
          case_id: string
          created_at?: string | null
          history?: Json | null
          id?: string
          ref?: string | null
          result?: Json | null
          sched?: string | null
          service: string
          status?: Database["public"]["Enums"]["referral_status"]
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          assignee?: string | null
          authority?: Database["public"]["Enums"]["referral_authority"]
          case_id?: string
          created_at?: string | null
          history?: Json | null
          id?: string
          ref?: string | null
          result?: Json | null
          sched?: string | null
          service?: string
          status?: Database["public"]["Enums"]["referral_status"]
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      related_persons: {
        Row: {
          case_id: string
          continued_protection: boolean | null
          id: string
          relationship: string | null
          risk_flag: boolean | null
        }
        Insert: {
          case_id: string
          continued_protection?: boolean | null
          id?: string
          relationship?: string | null
          risk_flag?: boolean | null
        }
        Update: {
          case_id?: string
          continued_protection?: boolean | null
          id?: string
          relationship?: string | null
          risk_flag?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "related_persons_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_classifications: {
        Row: {
          assessor_id: string | null
          case_id: string
          created_at: string | null
          factors: Json
          id: string
          level: Database["public"]["Enums"]["risk_level"]
          rationale: string | null
        }
        Insert: {
          assessor_id?: string | null
          case_id: string
          created_at?: string | null
          factors: Json
          id?: string
          level: Database["public"]["Enums"]["risk_level"]
          rationale?: string | null
        }
        Update: {
          assessor_id?: string | null
          case_id?: string
          created_at?: string | null
          factors?: Json
          id?: string
          level?: Database["public"]["Enums"]["risk_level"]
          rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_classifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      studies: {
        Row: {
          case_id: string
          created_at: string | null
          id: string
          notes: string | null
          partial_reason: string | null
          proposed_duration: string | null
          proposed_type: Json | null
          recommendation: string | null
          reject_reasons: Json | null
          studier_id: string
          submitted_at: string | null
        }
        Insert: {
          case_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          partial_reason?: string | null
          proposed_duration?: string | null
          proposed_type?: Json | null
          recommendation?: string | null
          reject_reasons?: Json | null
          studier_id: string
          submitted_at?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          partial_reason?: string | null
          proposed_duration?: string | null
          proposed_type?: Json | null
          recommendation?: string | null
          reject_reasons?: Json | null
          studier_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studies_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          case_id: string
          contact_enc: string | null
          created_at: string | null
          full_name_enc: string | null
          id: string
          national_id_enc: string | null
          subject_type: string | null
        }
        Insert: {
          case_id: string
          contact_enc?: string | null
          created_at?: string | null
          full_name_enc?: string | null
          id?: string
          national_id_enc?: string | null
          subject_type?: string | null
        }
        Update: {
          case_id?: string
          contact_enc?: string | null
          created_at?: string | null
          full_name_enc?: string | null
          id?: string
          national_id_enc?: string | null
          subject_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      triage_reviews: {
        Row: {
          authority: string | null
          case_id: string
          created_at: string | null
          decision: string
          formal_check: Json
          id: string
          officer_id: string | null
          reason: string | null
        }
        Insert: {
          authority?: string | null
          case_id: string
          created_at?: string | null
          decision: string
          formal_check?: Json
          id?: string
          officer_id?: string | null
          reason?: string | null
        }
        Update: {
          authority?: string | null
          case_id?: string
          created_at?: string | null
          decision?: string
          formal_check?: Json
          id?: string
          officer_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "triage_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "protection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_prefs: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          attributes: Json | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
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
      _actor_name: { Args: { _uid: string }; Returns: string }
      _next_decision_ref: { Args: never; Returns: string }
      _next_grv_ref: { Args: never; Returns: string }
      _scope_ar: { Args: { _scope: string }; Returns: string }
      advisor_decide_grievance: {
        Args: {
          _decision: string
          _grievance_id: string
          _reason: string
          _types: Json
        }
        Returns: undefined
      }
      approve_urgent: {
        Args: {
          _approve: boolean
          _days: number
          _emergency_id: string
          _reason: string
          _types: string[]
        }
        Returns: undefined
      }
      assign_study_eval: {
        Args: { _case_id: string; _per_role?: number }
        Returns: undefined
      }
      case_has_grievance: { Args: { _case_id: string }; Returns: boolean }
      case_in_decision: { Args: { _case_id: string }; Returns: boolean }
      case_triage_active: { Args: { _case_id: string }; Returns: boolean }
      case_triage_register: { Args: { _case_id: string }; Returns: boolean }
      category_ar: {
        Args: { _c: Database["public"]["Enums"]["app_category"] }
        Returns: string
      }
      cb_branch: { Args: never; Returns: string }
      cb_entity: {
        Args: never
        Returns: Database["public"]["Enums"]["competent_entity"]
      }
      cb_entity_branches: { Args: never; Returns: string[] }
      cb_level: { Args: never; Returns: string }
      council_approve: {
        Args: { _case_id: string }
        Returns: {
          status: string
        }[]
      }
      council_close: { Args: { _case_id: string }; Returns: undefined }
      council_issue: {
        Args: { _case_id: string; _reason: string }
        Returns: {
          outcome: string
        }[]
      }
      council_open_voting: {
        Args: { _case_id: string }
        Returns: {
          status: string
        }[]
      }
      council_remove_attachment: {
        Args: { _case_id: string; _doc_id: string }
        Returns: undefined
      }
      council_return: {
        Args: { _case_id: string; _note: string }
        Returns: undefined
      }
      council_save: {
        Args: {
          _case_id: string
          _duration: string
          _reasoning: string
          _types: Json
        }
        Returns: undefined
      }
      council_send_message: {
        Args: {
          _body: string
          _case_id: string
          _party: string
          _party_uid: string
          _with_seat: string
        }
        Returns: undefined
      }
      council_set_attachment: {
        Args: {
          _case_id: string
          _doc_id: string
          _file_name: string
          _group: string
          _label: string
          _storage_path: string
        }
        Returns: undefined
      }
      council_submit: {
        Args: {
          _case_id: string
          _duration: string
          _reasoning: string
          _types: Json
        }
        Returns: {
          status: string
        }[]
      }
      council_tally: {
        Args: { _case_id: string }
        Returns: {
          accept: number
          cast_n: number
          closed: boolean
          outcome: string
          reject: number
        }[]
      }
      council_vote: {
        Args: { _case_id: string; _choice: string; _note: string }
        Returns: undefined
      }
      council_vote_open: { Args: { _case_id: string }; Returns: boolean }
      current_officer_caseids: { Args: never; Returns: string[] }
      has_authority: {
        Args: { _authority: Database["public"]["Enums"]["referral_authority"] }
        Returns: boolean
      }
      has_coord: { Args: { _key: string }; Returns: boolean }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string }
        Returns: boolean
      }
      is_assigned_assessment: { Args: { _case_id: string }; Returns: boolean }
      is_assigned_grievance: { Args: { _case_id: string }; Returns: boolean }
      is_assigned_study: { Args: { _case_id: string }; Returns: boolean }
      is_center_leader: { Args: never; Returns: boolean }
      is_council: { Args: { _uid: string }; Returns: boolean }
      mark_leader_thread_read: {
        Args: { _case_id: string; _leader: string }
        Returns: undefined
      }
      my_assessment_tasks: {
        Args: never
        Returns: {
          assigned_at: string
          case_id: string
          category: Database["public"]["Enums"]["app_category"]
          foreign_info: Json
          peers: number
          ref_no: string
          secret_code: string
          source: Database["public"]["Enums"]["case_source"]
          submitted_at: string
        }[]
      }
      my_study_tasks: {
        Args: never
        Returns: {
          assigned_at: string
          case_id: string
          category: Database["public"]["Enums"]["app_category"]
          foreign_info: Json
          peers: number
          ref_no: string
          secret_code: string
          source: Database["public"]["Enums"]["case_source"]
          submitted_at: string
        }[]
      }
      notify_foreign: {
        Args: { _decision: string; _id: string }
        Returns: {
          auth_kind: string | null
          authority: string | null
          basis: string | null
          case_id: string | null
          category: string | null
          city: string | null
          country: string | null
          created_at: string | null
          foreign_ref: string | null
          id: string
          pg_decision: string | null
          reciprocity: boolean | null
          ref: string | null
          secret: string | null
          status: string | null
          summary: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "foreign_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      office_adopt_grievance: {
        Args: {
          _grievance_id: string
          _outcome: string
          _reason: string
          _types: Json
        }
        Returns: undefined
      }
      office_return_grievance: {
        Args: { _grievance_id: string; _note: string }
        Returns: undefined
      }
      owns_case: { Args: { _case_id: string }; Returns: boolean }
      owns_grievance: { Args: { _grievance_id: string }; Returns: boolean }
      pick_grievance_advisor: { Args: never; Returns: string }
      raise_lifecycle_review: {
        Args: {
          _case_id: string
          _proposal: Database["public"]["Enums"]["review_outcome"]
          _rationale: string
        }
        Returns: {
          case_id: string
          created_at: string | null
          decided_at: string | null
          decision: Json | null
          id: string
          officer_id: string | null
          proposal: Database["public"]["Enums"]["review_outcome"] | null
          rationale: string | null
          status: Database["public"]["Enums"]["review_status"] | null
        }
        SetofOptions: {
          from: "*"
          to: "lifecycle_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      raise_urgent: {
        Args: { _case_id: string; _escalation: Json }
        Returns: string
      }
      record_recommendation: {
        Args: {
          _case_id: string
          _channel: string
          _decision: string
          _factors9?: Json
          _notes?: string
          _proposed_duration?: string
          _proposed_type?: Json
        }
        Returns: {
          status: Database["public"]["Enums"]["case_status"]
        }[]
      }
      record_secret_reveal: { Args: { _case_id: string }; Returns: undefined }
      referral_update: {
        Args: {
          _assignee: string
          _id: string
          _note: string
          _result: Json
          _status: Database["public"]["Enums"]["referral_status"]
        }
        Returns: {
          assignee: string | null
          authority: Database["public"]["Enums"]["referral_authority"]
          case_id: string
          created_at: string | null
          history: Json | null
          id: string
          ref: string | null
          result: Json | null
          sched: string | null
          service: string
          status: Database["public"]["Enums"]["referral_status"]
          summary: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "referrals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_foreign: {
        Args: { _basis: string; _id: string }
        Returns: {
          auth_kind: string | null
          authority: string | null
          basis: string | null
          case_id: string | null
          category: string | null
          city: string | null
          country: string | null
          created_at: string | null
          foreign_ref: string | null
          id: string
          pg_decision: string | null
          reciprocity: boolean | null
          ref: string | null
          secret: string | null
          status: string | null
          summary: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "foreign_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seeker_case_view: { Args: { _ref: string }; Returns: Json }
      seeker_sign_agreement: {
        Args: { _case_id: string }
        Returns: {
          status: Database["public"]["Enums"]["case_status"]
        }[]
      }
      send_leader_message: {
        Args: { _body: string; _case_id: string; _leader: string }
        Returns: string
      }
      send_office_message: {
        Args: { _body: string; _channel: string; _grievance_id: string }
        Returns: string
      }
      send_to_decision: {
        Args: { _case_id: string }
        Returns: {
          status: Database["public"]["Enums"]["case_status"]
        }[]
      }
      sign_agreement: {
        Args: { _case_id: string }
        Returns: {
          status: Database["public"]["Enums"]["case_status"]
        }[]
      }
      source_ar: {
        Args: { _s: Database["public"]["Enums"]["case_source"] }
        Returns: string
      }
      submit_assessment: {
        Args: {
          _case_id: string
          _notes: string
          _partial_reason?: string
          _proposed_duration: string
          _proposed_type: Json
          _recommendation: string
          _reject_reasons: Json
        }
        Returns: {
          id: string
        }[]
      }
      submit_entity_recommendation: {
        Args: {
          _applicant_role: string
          _case_no: string
          _category: Database["public"]["Enums"]["app_category"]
          _crime: string
          _details?: Json
          _entity: string
          _provide: boolean
          _reason: string
        }
        Returns: {
          case_id: string
          ref_no: string
          secret_code: string
        }[]
      }
      submit_paper_intake: {
        Args: {
          _applicant_role: string
          _case_no: string
          _category: Database["public"]["Enums"]["app_category"]
          _crime: string
          _details?: Json
          _entity: string
          _prior_submit: boolean
          _reason: string
          _source: string
        }
        Returns: {
          case_id: string
          ref_no: string
          secret_code: string
        }[]
      }
      submit_protection_request: {
        Args: {
          _applicant_role: string
          _case_no: string
          _category: Database["public"]["Enums"]["app_category"]
          _crime: string
          _details?: Json
          _entity: string
          _prior_submit: boolean
          _reason: string
        }
        Returns: {
          case_id: string
          ref_no: string
          secret_code: string
        }[]
      }
      submit_study: {
        Args: {
          _case_id: string
          _notes: string
          _partial_reason?: string
          _proposed_duration: string
          _proposed_type: Json
          _recommendation: string
          _reject_reasons: Json
        }
        Returns: {
          id: string
        }[]
      }
      tech_office_advisors: {
        Args: never
        Returns: {
          decided: number
          name: string
          open_load: number
          spec: string
          user_id: string
        }[]
      }
      triage_decide: {
        Args: {
          _authority?: string
          _case_id: string
          _decision: string
          _formal_check?: Json
          _reason: string
        }
        Returns: {
          status: Database["public"]["Enums"]["case_status"]
        }[]
      }
    }
    Enums: {
      app_category: "reporter" | "witness" | "expert" | "victim" | "related"
      app_role:
        | "prosecutor_general"
        | "board_chair"
        | "deputy_chair"
        | "board_member"
        | "case_officer"
        | "security_officer"
        | "security_manager"
        | "studier"
        | "evaluator"
        | "advisor"
        | "tech_manager"
        | "hotline_operator"
        | "ciso"
        | "sysadmin"
        | "competent_body"
        | "moi_officer"
        | "moh_specialist"
        | "moh_manager"
        | "hr_specialist"
        | "hr_manager"
        | "subject"
      case_source: "local" | "foreign" | "urgent"
      case_status:
        | "submitted"
        | "triage"
        | "referred"
        | "under_study"
        | "classified"
        | "in_decision"
        | "accepted"
        | "rejected"
        | "signed"
        | "active"
        | "under_review"
        | "terminating"
        | "closed"
      competent_entity:
        | "prosecution"
        | "state_security"
        | "moi"
        | "nazaha"
        | "moj"
      decision_type: "accept" | "reject" | "continue" | "modify" | "terminate"
      grievance_status:
        | "filed"
        | "tech_review"
        | "pg_decision"
        | "upheld"
        | "dismissed"
      msg_dir: "in" | "out" | "note"
      msg_thread: "center" | "body" | "coord"
      referral_authority:
        | "hr"
        | "health"
        | "legal"
        | "security"
        | "moi"
        | "competent"
        | "ag"
        | "technical"
      referral_status: "new" | "assigned" | "progress" | "review" | "done"
      region_code:
        | "RUH"
        | "MAK"
        | "MED"
        | "QAS"
        | "EAS"
        | "ASR"
        | "TAB"
        | "HAI"
        | "NOR"
        | "JAZ"
        | "NAJ"
        | "BAH"
        | "JOF"
      review_outcome: "continue" | "modify" | "close"
      review_status: "raised" | "decided"
      risk_level: "low" | "medium" | "high" | "critical"
      sensitivity: "top_secret" | "secret" | "secret_financial" | "internal"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_category: ["reporter", "witness", "expert", "victim", "related"],
      app_role: [
        "prosecutor_general",
        "board_chair",
        "deputy_chair",
        "board_member",
        "case_officer",
        "security_officer",
        "security_manager",
        "studier",
        "evaluator",
        "advisor",
        "tech_manager",
        "hotline_operator",
        "ciso",
        "sysadmin",
        "competent_body",
        "moi_officer",
        "moh_specialist",
        "moh_manager",
        "hr_specialist",
        "hr_manager",
        "subject",
      ],
      case_source: ["local", "foreign", "urgent"],
      case_status: [
        "submitted",
        "triage",
        "referred",
        "under_study",
        "classified",
        "in_decision",
        "accepted",
        "rejected",
        "signed",
        "active",
        "under_review",
        "terminating",
        "closed",
      ],
      competent_entity: [
        "prosecution",
        "state_security",
        "moi",
        "nazaha",
        "moj",
      ],
      decision_type: ["accept", "reject", "continue", "modify", "terminate"],
      grievance_status: [
        "filed",
        "tech_review",
        "pg_decision",
        "upheld",
        "dismissed",
      ],
      msg_dir: ["in", "out", "note"],
      msg_thread: ["center", "body", "coord"],
      referral_authority: [
        "hr",
        "health",
        "legal",
        "security",
        "moi",
        "competent",
        "ag",
        "technical",
      ],
      referral_status: ["new", "assigned", "progress", "review", "done"],
      region_code: [
        "RUH",
        "MAK",
        "MED",
        "QAS",
        "EAS",
        "ASR",
        "TAB",
        "HAI",
        "NOR",
        "JAZ",
        "NAJ",
        "BAH",
        "JOF",
      ],
      review_outcome: ["continue", "modify", "close"],
      review_status: ["raised", "decided"],
      risk_level: ["low", "medium", "high", "critical"],
      sensitivity: ["top_secret", "secret", "secret_financial", "internal"],
    },
  },
} as const

