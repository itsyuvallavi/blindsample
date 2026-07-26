export type Json =
  | boolean
  | number
  | string
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      evaluations: {
        Row: {
          approved_at: string;
          buyer_token_hash: string;
          completed_at: string | null;
          contract_set_hash: string;
          contracts: Json;
          created_at: string;
          environment: string;
          error_code: string | null;
          expires_at: string;
          id: string;
          results: Json | null;
          sample_column_count: number | null;
          sample_row_count: number | null;
          seller_token_hash: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          approved_at: string;
          buyer_token_hash: string;
          completed_at?: string | null;
          contract_set_hash: string;
          contracts: Json;
          created_at?: string;
          environment: string;
          error_code?: string | null;
          expires_at: string;
          id?: string;
          results?: Json | null;
          sample_column_count?: number | null;
          sample_row_count?: number | null;
          seller_token_hash: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string;
          buyer_token_hash?: string;
          completed_at?: string | null;
          contract_set_hash?: string;
          contracts?: Json;
          created_at?: string;
          environment?: string;
          error_code?: string | null;
          expires_at?: string;
          id?: string;
          results?: Json | null;
          sample_column_count?: number | null;
          sample_row_count?: number | null;
          seller_token_hash?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type EvaluationInsert =
  Database["public"]["Tables"]["evaluations"]["Insert"];
export type EvaluationRow =
  Database["public"]["Tables"]["evaluations"]["Row"];
