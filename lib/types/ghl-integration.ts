// Go High Level Integration Types

export type GHLIntegration = {
  id: string;
  base_id: string;
  location_id: string;
  access_token: string;
  refresh_token: string | null; // Null for Private Integration Tokens
  token_expires_at: string | null; // Null for Private Integration Tokens (they don't expire)
  webhook_id: string | null;
  field_mapping: GHLFieldMapping;
  ghl_field_names: Record<string, string>; // Maps GHL field keys to their display names
  sync_enabled: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
  is_private_integration: boolean; // True if using Private Integration Token
};

export type GHLFieldMapping = {
  // Maps GHL contact fields to app field IDs
  name?: string; // Field ID for "Name" (firstName + lastName)
  email?: string; // Field ID for "Email"
  phone?: string; // Field ID for "Phone"
  address?: string; // Field ID for "Address"
  company?: string; // Field ID for "Company"
  tags?: string; // Field ID for "Tags"
  [key: string]: string | undefined; // Allow custom field mappings
};

export type GHLContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  companyName?: string;
  website?: string;
  tags?: string[];
  source?: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown; // Allow other custom fields
};

export type GHLWebhookPayload = {
  type: string; // 'ContactCreated', 'ContactUpdated', 'ContactDeleted'
  locationId: string;
  contact: GHLContact;
  timestamp?: string;
};

export type GHLTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds until expiration
  token_type: string;
  scope?: string;
};

export type GHLOAuthResponse = {
  code: string;
  locationId: string;
  userId?: string;
};

export type GHLSyncLog = {
  id: string;
  integration_id: string;
  contact_id: string;
  action: 'created' | 'updated' | 'deleted';
  status: 'success' | 'failed';
  error_message: string | null;
  synced_data: Record<string, unknown> | null;
  created_at: string;
};

export type GHLIntegrationStatus = {
  connected: boolean;
  location_id: string | null;
  last_sync_at: string | null;
  sync_enabled: boolean;
};

