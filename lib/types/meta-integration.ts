/**
 * Meta (Facebook/Instagram) Integration Types
 * 
 * These types define the structure for Meta OAuth integration,
 * connected accounts, and API responses.
 */

// Database table types

export interface MetaIntegration {
  id: string;
  user_id: string;
  access_token: string;
  token_type: string;
  expires_at: string; // ISO 8601 timestamp
  refresh_token?: string;
  scopes: string[];
  created_at: string;
  updated_at: string;
}

export interface MetaConnectedAccount {
  id: string;
  integration_id: string;
  platform: 'facebook' | 'instagram';
  account_id: string;
  account_name: string;
  account_username?: string;
  profile_picture_url?: string;
  access_token?: string; // Page-specific token for Facebook Pages
  follower_count?: number;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// OAuth response types

export interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Seconds until expiration
}

export interface MetaLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Usually 5184000 (60 days)
}

// Meta Graph API response types

export interface MetaPageData {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[]; // Page permissions/tasks
  fan_count?: number; // Follower count
  picture?: {
    data: {
      url: string;
    };
  };
}

export interface MetaPagesResponse {
  data: MetaPageData[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

export interface MetaInstagramData {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  biography?: string;
  website?: string;
}

export interface MetaInstagramAccountsResponse {
  instagram_business_account?: {
    id: string;
  };
}

export interface MetaUserData {
  id: string;
  name: string;
  email?: string;
}

export interface MetaErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// Service layer types

export interface MetaAuthUrlParams {
  userId: string;
  redirectUri: string;
}

export interface MetaConnectionStatus {
  isConnected: boolean;
  integration?: MetaIntegration;
  accounts: MetaConnectedAccount[];
  facebookPages: MetaConnectedAccount[];
  instagramAccounts: MetaConnectedAccount[];
}

export interface MetaDisconnectResult {
  success: boolean;
  message: string;
}

// Meta API Configuration

export const META_SCOPES = [
  'pages_show_list',           // View list of Pages
  'pages_read_engagement',     // Read Page engagement data
  'pages_manage_posts',        // Create and manage posts
  'pages_manage_metadata',     // Manage Page settings
  'instagram_basic',           // Basic Instagram account info
  'instagram_manage_insights', // View Instagram insights
  'instagram_content_publish', // Publish content to Instagram
  'ads_management',            // Manage ads
  'ads_read',                  // Read ads data
] as const;

export type MetaScope = typeof META_SCOPES[number];

export const META_GRAPH_API_VERSION = 'v18.0';
export const META_GRAPH_API_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

// Hook types

export interface UseMetaIntegrationReturn {
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  integration: MetaIntegration | null;
  accounts: MetaConnectedAccount[];
  facebookPages: MetaConnectedAccount[];
  instagramAccounts: MetaConnectedAccount[];
  connectMeta: () => void;
  disconnectMeta: () => Promise<void>;
  refreshIntegration: () => Promise<void>;
}
