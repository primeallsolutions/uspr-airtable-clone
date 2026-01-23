import { supabase } from '../supabaseClient';
import type {
  GHLIntegration,
  GHLContact,
  GHLTokenResponse,
  GHLWebhookPayload,
  GHLFieldMapping,
  GHLSyncLog
} from '../types/ghl-integration';

const GHL_API_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_OAUTH_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';

export class GHLService {
  private static getClientId(): string {
    const clientId = process.env.NEXT_PUBLIC_GHL_CLIENT_ID;
    if (!clientId) {
      throw new Error('GHL_CLIENT_ID is not configured');
    }
    return clientId;
  }

  private static getClientSecret(): string {
    const clientSecret = process.env.GHL_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('GHL_CLIENT_SECRET is not configured');
    }
    return clientSecret;
  }

  private static getRedirectUri(): string {
    const redirectUri = process.env.NEXT_PUBLIC_GHL_REDIRECT_URI;
    if (!redirectUri) {
      throw new Error('GHL_REDIRECT_URI is not configured');
    }
    return redirectUri;
  }

  /**
   * Generate OAuth authorization URL
   */
  static getAuthorizationUrl(baseId: string, state: string): string {
    const clientId = this.getClientId();
    const redirectUri = this.getRedirectUri();
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'contacts.readonly contacts.write locations/customFields.readonly'
    });

    return `${GHL_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(code: string): Promise<GHLTokenResponse> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri();

    const response = await fetch(`${GHL_API_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(
    refreshToken: string,
    locationId: string
  ): Promise<GHLTokenResponse> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const response = await fetch(`${GHL_API_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        locationId
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    return response.json();
  }

  /**
   * Get valid access token, refreshing if necessary
   * For Private Integration Tokens, just return the token (they don't expire)
   */
  static async getValidAccessToken(integration: GHLIntegration): Promise<string> {
    // Private Integration Tokens don't expire
    if (integration.is_private_integration || !integration.token_expires_at || !integration.refresh_token) {
      return integration.access_token;
    }

    const expiresAt = new Date(integration.token_expires_at);
    const now = new Date();
    
    // Refresh if token expires in less than 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      const tokenResponse = await this.refreshAccessToken(
        integration.refresh_token,
        integration.location_id
      );

      // Update integration with new tokens
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenResponse.expires_in);

      await supabase
        .from('ghl_integrations')
        .update({
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
          token_expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', integration.id);

      return tokenResponse.access_token;
    }

    return integration.access_token;
  }

  /**
   * Create integration using Private Integration Token
   * This is simpler than OAuth - just need the token and location ID
   */
  static async createPrivateIntegration(
    baseId: string,
    locationId: string,
    accessToken: string
  ): Promise<GHLIntegration> {
    const { data, error } = await supabase
      .from('ghl_integrations')
      .upsert({
        base_id: baseId,
        location_id: locationId,
        access_token: accessToken,
        refresh_token: null,
        token_expires_at: null,
        is_private_integration: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'base_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as GHLIntegration;
  }

  /**
   * Fetch a contact by ID from GHL
   */
  static async getContact(
    integration: GHLIntegration,
    contactId: string
  ): Promise<GHLContact> {
    const accessToken = await this.getValidAccessToken(integration);

    const response = await fetch(
      `${GHL_API_BASE_URL}/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch contact: ${error}`);
    }

    const data = await response.json();
    return data.contact || data;
  }

  /**
   * Register a webhook for contact events
   */
  static async registerWebhook(
    integration: GHLIntegration,
    webhookUrl: string
  ): Promise<string> {
    const accessToken = await this.getValidAccessToken(integration);

    // First, delete existing webhook if any
    if (integration.webhook_id) {
      try {
        await this.deleteWebhook(integration);
      } catch (error) {
        console.warn('Failed to delete existing webhook:', error);
      }
    }

    // Register new webhook
    const response = await fetch(
      `${GHL_API_BASE_URL}/webhooks/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locationId: integration.location_id,
          event: 'contact.added',
          url: webhookUrl,
          headers: {},
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to register webhook: ${error}`);
    }

    const data = await response.json();
    return data.webhook?.id || data.id;
  }

  /**
   * Delete a webhook
   */
  static async deleteWebhook(integration: GHLIntegration): Promise<void> {
    if (!integration.webhook_id) {
      return;
    }

    const accessToken = await this.getValidAccessToken(integration);

    const response = await fetch(
      `${GHL_API_BASE_URL}/webhooks/${integration.webhook_id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete webhook: ${error}`);
    }
  }

  /**
   * Get integration by base_id
   */
  static async getIntegrationByBaseId(baseId: string): Promise<GHLIntegration | null> {
    const { data, error } = await supabase
      .from('ghl_integrations')
      .select('*')
      .eq('base_id', baseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    return data as GHLIntegration;
  }

  /**
   * Get integration by location_id (for webhook lookups)
   * This method can be used with an admin client if passed in
   */
  static async getIntegrationByLocationId(
    locationId: string,
    adminClient?: any
  ): Promise<GHLIntegration | null> {
    const client = adminClient || supabase;
    
    const { data, error } = await client
      .from('ghl_integrations')
      .select('*')
      .eq('location_id', locationId)
      .eq('sync_enabled', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as GHLIntegration;
  }

  /**
   * Create or update integration
   */
  static async upsertIntegration(
    baseId: string,
    locationId: string,
    tokens: GHLTokenResponse,
    webhookId?: string
  ): Promise<GHLIntegration> {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    const { data, error } = await supabase
      .from('ghl_integrations')
      .upsert({
        base_id: baseId,
        location_id: locationId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        webhook_id: webhookId || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'base_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as GHLIntegration;
  }

  /**
   * Update field mapping
   */
  static async updateFieldMapping(
    integrationId: string,
    fieldMapping: GHLFieldMapping
  ): Promise<void> {
    const { error } = await supabase
      .from('ghl_integrations')
      .update({
        field_mapping: fieldMapping,
        updated_at: new Date().toISOString()
      })
      .eq('id', integrationId);

    if (error) {
      throw error;
    }
  }

  /**
   * Update last sync timestamp
   */
  static async updateLastSync(integrationId: string): Promise<void> {
    const { error } = await supabase
      .from('ghl_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', integrationId);

    if (error) {
      throw error;
    }
  }

  /**
   * Delete integration
   */
  static async deleteIntegration(integrationId: string): Promise<void> {
    const integration = await supabase
      .from('ghl_integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (integration.data) {
      // Delete webhook before deleting integration
      try {
        await this.deleteWebhook(integration.data as GHLIntegration);
      } catch (error) {
        console.warn('Failed to delete webhook during integration deletion:', error);
      }
    }

    const { error } = await supabase
      .from('ghl_integrations')
      .delete()
      .eq('id', integrationId);

    if (error) {
      throw error;
    }
  }

  /**
   * Log sync operation
   */
  static async logSync(
    integrationId: string,
    contactId: string,
    action: 'created' | 'updated' | 'deleted',
    status: 'success' | 'failed',
    errorMessage?: string,
    syncedData?: Record<string, unknown>
  ): Promise<void> {
    const { error } = await supabase
      .from('ghl_sync_logs')
      .insert({
        integration_id: integrationId,
        contact_id: contactId,
        action,
        status,
        error_message: errorMessage || null,
        synced_data: syncedData || null,
      });

    if (error) {
      console.error('Failed to log sync:', error);
      // Don't throw - logging failures shouldn't break the sync
    }
  }

  /**
   * Get sync logs for an integration
   */
  static async getSyncLogs(
    integrationId: string,
    limit: number = 50
  ): Promise<GHLSyncLog[]> {
    const { data, error } = await supabase
      .from('ghl_sync_logs')
      .select('*')
      .eq('integration_id', integrationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []) as GHLSyncLog[];
  }

  /**
   * Update auto-sync settings for a GHL integration
   */
  static async updateAutoSyncSettings(
    baseId: string,
    settings: {
      auto_sync_enabled: boolean;
      auto_sync_interval_minutes: number;
    }
  ): Promise<void> {
    const response = await fetch('/api/ghl/autosync-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseId, ...settings })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to update auto-sync settings');
    }
  }
}

