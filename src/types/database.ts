// ============================================================
// Database Types — matches the Supabase PostgreSQL schema
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          currency?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          icon: string;
          color: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          icon: string;
          color: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          icon?: string;
          color?: string;
          is_default?: boolean;
        };
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          month: string;
          amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          month: string;
          amount: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          month?: string;
          amount?: number;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          title: string;
          amount: number;
          type: 'income' | 'expense';
          date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          title: string;
          amount: number;
          type: 'income' | 'expense';
          date: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          title?: string;
          amount?: number;
          type?: 'income' | 'expense';
          date?: string;
          notes?: string | null;
          updated_at?: string;
        };
      };
      receipt_attachments: {
        Row: {
          id: string;
          transaction_id: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          file_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          file_size: number;
          created_at?: string;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      transaction_type: 'income' | 'expense';
    };
  };
}

// ── Convenience aliases ──────────────────────────────────────
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Budget = Database['public']['Tables']['budgets']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type ReceiptAttachment = Database['public']['Tables']['receipt_attachments']['Row'];

export type NewTransaction = Database['public']['Tables']['transactions']['Insert'];
export type NewBudget = Database['public']['Tables']['budgets']['Insert'];
export type NewCategory = Database['public']['Tables']['categories']['Insert'];

// Extended types with joins
export interface TransactionWithCategory extends Transaction {
  category: Category;
}

export interface BudgetWithCategory extends Budget {
  category: Category;
  spent: number;
}
