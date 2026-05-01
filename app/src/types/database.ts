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
  pgbouncer: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth: {
        Args: { p_usename: string }
        Returns: {
          password: string
          username: string
        }[]
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
      app_settings: {
        Row: {
          id: boolean
          registration_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          registration_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          registration_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      kb_articles: {
        Row: {
          author_id: string | null
          body_md: string | null
          category_id: number | null
          created_at: string
          id: number
          is_published: boolean
          related_task_id: number | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_md?: string | null
          category_id?: number | null
          created_at?: string
          id?: number
          is_published?: boolean
          related_task_id?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_md?: string | null
          category_id?: number | null
          created_at?: string
          id?: number
          is_published?: boolean
          related_task_id?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "problem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_related_task_id_fkey"
            columns: ["related_task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_related_task_id_fkey"
            columns: ["related_task_id"]
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: number
          is_read: boolean
          task_id: number | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: number
          is_read?: boolean
          task_id?: number | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: number
          is_read?: boolean
          task_id?: number | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outgoing_webhooks: {
        Row: {
          created_at: string
          event_types: Database["public"]["Enums"]["notification_type"][]
          id: number
          is_active: boolean
          name: string
          secret: string | null
          url: string
        }
        Insert: {
          created_at?: string
          event_types: Database["public"]["Enums"]["notification_type"][]
          id?: number
          is_active?: boolean
          name: string
          secret?: string | null
          url: string
        }
        Update: {
          created_at?: string
          event_types?: Database["public"]["Enums"]["notification_type"][]
          id?: number
          is_active?: boolean
          name?: string
          secret?: string | null
          url?: string
        }
        Relationships: []
      }
      priorities: {
        Row: {
          code: string
          id: number
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          code: string
          id?: number
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          code?: string
          id?: number
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      problem_categories: {
        Row: {
          created_at: string
          default_priority_id: number | null
          description: string | null
          id: number
          is_active: boolean
          name: string
          severity: Database["public"]["Enums"]["category_severity"]
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_priority_id?: number | null
          description?: string | null
          id?: number
          is_active?: boolean
          name: string
          severity?: Database["public"]["Enums"]["category_severity"]
          sort_order?: number
        }
        Update: {
          created_at?: string
          default_priority_id?: number | null
          description?: string | null
          id?: number
          is_active?: boolean
          name?: string
          severity?: Database["public"]["Enums"]["category_severity"]
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "problem_categories_default_priority_id_fkey"
            columns: ["default_priority_id"]
            referencedRelation: "priorities"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          code: string
          id: number
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          code: string
          id?: number
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          code?: string
          id?: number
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: number
          is_active: boolean
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          is_active?: boolean
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment_text: string
          created_at: string
          id: number
          mentions: string[]
          task_id: number
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          id?: number
          mentions?: string[]
          task_id: number
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          id?: number
          mentions?: string[]
          task_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_files: {
        Row: {
          content_type: string | null
          file_name: string
          id: number
          size_bytes: number | null
          storage_path: string
          task_id: number
          uploaded_at: string
          uploaded_by_user_id: string
        }
        Insert: {
          content_type?: string | null
          file_name: string
          id?: number
          size_bytes?: number | null
          storage_path: string
          task_id: number
          uploaded_at?: string
          uploaded_by_user_id: string
        }
        Update: {
          content_type?: string | null
          file_name?: string
          id?: number
          size_bytes?: number | null
          storage_path?: string
          task_id?: number
          uploaded_at?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_files_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_files_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_files_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_helpers: {
        Row: {
          added_by_user_id: string
          created_at: string
          helper_comment: string | null
          id: number
          is_active: boolean
          task_id: number
          user_id: string
        }
        Insert: {
          added_by_user_id: string
          created_at?: string
          helper_comment?: string | null
          id?: number
          is_active?: boolean
          task_id: number
          user_id: string
        }
        Update: {
          added_by_user_id?: string
          created_at?: string
          helper_comment?: string | null
          id?: number
          is_active?: boolean
          task_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_helpers_added_by_user_id_fkey"
            columns: ["added_by_user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_helpers_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_helpers_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_helpers_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          changed_at: string
          field_name: string
          id: number
          new_value: Json | null
          old_value: Json | null
          task_id: number
          user_id: string | null
        }
        Insert: {
          changed_at?: string
          field_name: string
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          task_id: number
          user_id?: string | null
        }
        Update: {
          changed_at?: string
          field_name?: string
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          task_id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          tag_id: number
          task_id: number
        }
        Insert: {
          tag_id: number
          task_id: number
        }
        Update: {
          tag_id?: number
          task_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          category_id: number | null
          complexity: number | null
          created_at: string
          created_by: string
          default_tags: string[]
          description_template: string | null
          id: number
          is_public: boolean
          name: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          task_type_id: number | null
          title_template: string | null
          updated_at: string
        }
        Insert: {
          category_id?: number | null
          complexity?: number | null
          created_at?: string
          created_by: string
          default_tags?: string[]
          description_template?: string | null
          id?: number
          is_public?: boolean
          name: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          task_type_id?: number | null
          title_template?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: number | null
          complexity?: number | null
          created_at?: string
          created_by?: string
          default_tags?: string[]
          description_template?: string | null
          id?: number
          is_public?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          task_type_id?: number | null
          title_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "problem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_task_type_id_fkey"
            columns: ["task_type_id"]
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
      task_types: {
        Row: {
          code: string
          id: number
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          code: string
          id?: number
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          code?: string
          id?: number
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          category_id: number
          completed_at: string | null
          complexity: number
          created_at: string
          creator_id: string
          description: string | null
          due_date: string | null
          help_comment: string | null
          help_requested_at: string | null
          id: number
          parent_task_id: number | null
          priority: Database["public"]["Enums"]["task_priority"]
          rejected_at: string | null
          rejected_by_id: string | null
          rejection_reason: string | null
          search_tsv: unknown
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type_id: number
          ticket_number: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category_id: number
          completed_at?: string | null
          complexity: number
          created_at?: string
          creator_id: string
          description?: string | null
          due_date?: string | null
          help_comment?: string | null
          help_requested_at?: string | null
          id?: number
          parent_task_id?: number | null
          priority?: Database["public"]["Enums"]["task_priority"]
          rejected_at?: string | null
          rejected_by_id?: string | null
          rejection_reason?: string | null
          search_tsv?: unknown
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type_id: number
          ticket_number?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category_id?: number
          completed_at?: string | null
          complexity?: number
          created_at?: string
          creator_id?: string
          description?: string | null
          due_date?: string | null
          help_comment?: string | null
          help_requested_at?: string | null
          id?: number
          parent_task_id?: number | null
          priority?: Database["public"]["Enums"]["task_priority"]
          rejected_at?: string | null
          rejected_by_id?: string | null
          rejection_reason?: string | null
          search_tsv?: unknown
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type_id?: number
          ticket_number?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "problem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_creator_id_fkey"
            columns: ["creator_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_rejected_by_id_fkey"
            columns: ["rejected_by_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_task_type_id_fkey"
            columns: ["task_type_id"]
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          last_seen_at: string | null
          login: string
          notification_prefs: Json
          phone: string | null
          preferred_view: Database["public"]["Enums"]["user_task_view"]
          role: Database["public"]["Enums"]["user_role"]
          telegram_chat_id: string | null
          timezone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_seen_at?: string | null
          login: string
          notification_prefs?: Json
          phone?: string | null
          preferred_view?: Database["public"]["Enums"]["user_task_view"]
          role: Database["public"]["Enums"]["user_role"]
          telegram_chat_id?: string | null
          timezone?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_seen_at?: string | null
          login?: string
          notification_prefs?: Json
          phone?: string | null
          preferred_view?: Database["public"]["Enums"]["user_task_view"]
          role?: Database["public"]["Enums"]["user_role"]
          telegram_chat_id?: string | null
          timezone?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_tasks: {
        Row: {
          assignee_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          category_id: number | null
          completed_at: string | null
          complexity: number | null
          created_at: string | null
          creator_id: string | null
          description: string | null
          due_date: string | null
          help_comment: string | null
          help_requested_at: string | null
          id: number | null
          is_overdue: boolean | null
          parent_task_id: number | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          rejected_at: string | null
          rejected_by_id: string | null
          rejection_reason: string | null
          search_tsv: unknown
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type_id: number | null
          ticket_number: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category_id?: number | null
          completed_at?: string | null
          complexity?: number | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          due_date?: string | null
          help_comment?: string | null
          help_requested_at?: string | null
          id?: number | null
          is_overdue?: never
          parent_task_id?: number | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          rejected_at?: string | null
          rejected_by_id?: string | null
          rejection_reason?: string | null
          search_tsv?: unknown
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type_id?: number | null
          ticket_number?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category_id?: number | null
          completed_at?: string | null
          complexity?: number | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          due_date?: string | null
          help_comment?: string | null
          help_requested_at?: string | null
          id?: number | null
          is_overdue?: never
          parent_task_id?: number | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          rejected_at?: string | null
          rejected_by_id?: string | null
          rejection_reason?: string | null
          search_tsv?: unknown
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type_id?: number | null
          ticket_number?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "problem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_creator_id_fkey"
            columns: ["creator_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_rejected_by_id_fkey"
            columns: ["rejected_by_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_task_type_id_fkey"
            columns: ["task_type_id"]
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_task: { Args: { p_task_id: number }; Returns: boolean }
      current_user_role: { Args: never; Returns: string }
      is_active_helper_on_task: {
        Args: { p_task_id: number; p_user_id: string }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      is_task_stakeholder: {
        Args: { p_task_id: number; p_user_id: string }
        Returns: boolean
      }
      join_task_as_helper: {
        Args: { p_helper_comment: string; p_task_id: number }
        Returns: undefined
      }
      notify_due_soon: { Args: never; Returns: undefined }
      notify_overdue: { Args: never; Returns: undefined }
      reject_task: {
        Args: { p_reason: string; p_task_id: number }
        Returns: undefined
      }
      report_avg_resolution: {
        Args: { p_from: string; p_to: string }
        Returns: {
          assignee_id: string
          assignee_name: string
          avg_resolution_hours: number
          category_id: number
          category_name: string
          tasks_done: number
        }[]
      }
      report_help_stats: {
        Args: { p_from: string; p_to: string }
        Returns: {
          active_helpers: number
          assignee_name: string
          help_requested_at: string
          hours_in_needs_help: number
          task_id: number
          ticket_number: string
          title: string
        }[]
      }
      report_open_by_assignee: {
        Args: { p_from: string; p_to: string }
        Returns: {
          assignee_id: string
          full_name: string
          login: string
          open_count: number
        }[]
      }
      report_overdue: {
        Args: { p_from: string; p_to: string }
        Returns: {
          assignee_name: string
          category_name: string
          due_date: string
          task_id: number
          ticket_number: string
          title: string
        }[]
      }
      report_top_categories: {
        Args: { p_from: string; p_to: string }
        Returns: {
          category_id: number
          category_name: string
          task_count: number
        }[]
      }
      request_task_help: {
        Args: {
          p_help_comment: string
          p_helper_ids: string[]
          p_task_id: number
        }
        Returns: undefined
      }
      task_status_label_ru: {
        Args: { st: Database["public"]["Enums"]["task_status"] }
        Returns: string
      }
    }
    Enums: {
      category_severity: "normal" | "important" | "critical"
      notification_type:
        | "assigned"
        | "status_changed"
        | "help_requested"
        | "help_added"
        | "comment_added"
        | "mention"
        | "task_rejected"
        | "due_soon"
        | "overdue"
        | "developer_task_created"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status:
        | "new"
        | "in_progress"
        | "needs_help"
        | "on_review"
        | "done"
        | "cancelled"
      user_role:
        | "specialist"
        | "duty_officer"
        | "developer"
        | "accountant"
        | "manager"
        | "admin"
      user_task_view: "list" | "kanban"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  pgbouncer: {
    Enums: {},
  },
  public: {
    Enums: {
      category_severity: ["normal", "important", "critical"],
      notification_type: [
        "assigned",
        "status_changed",
        "help_requested",
        "help_added",
        "comment_added",
        "mention",
        "task_rejected",
        "due_soon",
        "overdue",
        "developer_task_created",
      ],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: [
        "new",
        "in_progress",
        "needs_help",
        "on_review",
        "done",
        "cancelled",
      ],
      user_role: [
        "specialist",
        "duty_officer",
        "developer",
        "accountant",
        "manager",
        "admin",
      ],
      user_task_view: ["list", "kanban"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
