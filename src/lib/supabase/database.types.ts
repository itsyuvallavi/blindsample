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
          buyer_token_hash: string;
          completed_at: string | null;
          created_at: string;
          environment: string;
          error_code: string | null;
          expires_at: string;
          id: string;
          questions: Json;
          sample_column_count: number | null;
          sample_row_count: number | null;
          scores: Json | null;
          seller_token_hash: string;
          status: string;
          tee_verified: boolean;
          title: string;
          updated_at: string;
          zero_g_model: string | null;
          zero_g_provider: string | null;
          zero_g_request_id: string | null;
        };
        Insert: {
          buyer_token_hash: string;
          completed_at?: string | null;
          created_at?: string;
          environment: string;
          error_code?: string | null;
          expires_at: string;
          id?: string;
          questions: Json;
          sample_column_count?: number | null;
          sample_row_count?: number | null;
          scores?: Json | null;
          seller_token_hash: string;
          status?: string;
          tee_verified?: boolean;
          title: string;
          updated_at?: string;
          zero_g_model?: string | null;
          zero_g_provider?: string | null;
          zero_g_request_id?: string | null;
        };
        Update: {
          buyer_token_hash?: string;
          completed_at?: string | null;
          created_at?: string;
          environment?: string;
          error_code?: string | null;
          expires_at?: string;
          id?: string;
          questions?: Json;
          sample_column_count?: number | null;
          sample_row_count?: number | null;
          scores?: Json | null;
          seller_token_hash?: string;
          status?: string;
          tee_verified?: boolean;
          title?: string;
          updated_at?: string;
          zero_g_model?: string | null;
          zero_g_provider?: string | null;
          zero_g_request_id?: string | null;
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
