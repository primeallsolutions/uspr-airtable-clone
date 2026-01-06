// Webhook Types for Incoming Webhooks Feature

export interface Webhook {
  id: string;
  base_id: string;
  name: string;
  secret_token: string;
  is_enabled: boolean;
  default_table_id: string | null;
  field_mapping: Record<string, string>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_triggered_at: string | null;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  status: 'success' | 'error';
  request_payload: any;
  response_status: number;
  error_message: string | null;
  record_id: string | null;
  table_id: string | null;
  created_at: string;
}

