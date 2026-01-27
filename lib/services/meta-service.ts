/**
 * Meta Service
 * 
 * Handles OAuth authentication and API interactions with Facebook and Instagram
 * via Meta Graph API.
 */

import { supabase } from '../supabaseClient';
import type {
  MetaIntegration,
  MetaConnectedAccount,
  MetaTokenResponse,
  MetaLongLivedTokenResponse,
  MetaPagesResponse,
  MetaPageData,
  MetaInstagramData,
  MetaInstagramAccountsResponse,
  MetaConnectionStatus,
  MetaDisconnectResult,
} from '../types/meta-integration';
import { META_GRAPH_API_BASE_URL, META_SCOPES } from '../types/meta-integration';

const META_OAUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';
const META_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';

export class MetaService {
  /**
   * Get Meta App ID from environment
   */
  private static getAppId(): string {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId) {
      throw new Error('META_APP_ID is not configured');
    }
    return appId;
  }

  /**
   * Get Meta App Secret from environment (server-side only)
   */
  private static getAppSecret(): string {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      throw new Error('META_APP_SECRET is not configured');
    }
    return appSecret;
  }

  /**
   * Get OAuth redirect URI from environment
   */
  private static getRedirectUri(): string {
    const redirectUri = process.env.NEXT_PUBLIC_META_REDIRECT_URI;
    if (!redirectUri) {
      throw new Error('META_REDIRECT_URI is not configured');
    }
    return redirectUri;
  }

  /**
   * Generate OAuth authorization URL
   */
  static getAuthorizationUrl(userId: string): string {
    const appId = this.getAppId();
    const redirectUri = this.getRedirectUri();
    const scopes = META_SCOPES.join(',');
    
    // State includes userId for verification in callback
    const state = `${userId}_${Date.now()}`;
    
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
      response_type: 'code',
    });

    return `${META_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for short-lived access token
   */
  static async exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
    const appId = this.getAppId();
    const appSecret = this.getAppSecret();
    const redirectUri = this.getRedirectUri();

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(`${META_TOKEN_URL}?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to exchange code: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  static async exchangeForLongLivedToken(
    shortLivedToken: string
  ): Promise<MetaLongLivedTokenResponse> {
    const appId = this.getAppId();
    const appSecret = this.getAppSecret();

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(`${META_TOKEN_URL}?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to exchange for long-lived token: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Fetch user's Facebook Pages
   */
  static async getConnectedPages(accessToken: string): Promise<MetaPageData[]> {
    const url = `${META_GRAPH_API_BASE_URL}/me/accounts?fields=id,name,access_token,category,tasks,fan_count,picture`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch pages: ${JSON.stringify(error)}`);
    }

    const data: MetaPagesResponse = await response.json();
    return data.data || [];
  }

  /**
   * Fetch Instagram Business Account linked to a Facebook Page
   */
  static async getInstagramAccount(
    pageId: string,
    pageAccessToken: string
  ): Promise<MetaInstagramData | null> {
    // First get the Instagram Business Account ID
    const igAccountUrl = `${META_GRAPH_API_BASE_URL}/${pageId}?fields=instagram_business_account`;
    
    const accountResponse = await fetch(igAccountUrl, {
      headers: {
        Authorization: `Bearer ${pageAccessToken}`,
      },
    });

    if (!accountResponse.ok) {
      console.error('Failed to fetch Instagram account for page:', pageId);
      return null;
    }

    const accountData: MetaInstagramAccountsResponse = await accountResponse.json();
    
    if (!accountData.instagram_business_account) {
      return null; // No Instagram account linked to this page
    }

    const igAccountId = accountData.instagram_business_account.id;

    // Fetch Instagram account details
    const detailsUrl = `${META_GRAPH_API_BASE_URL}/${igAccountId}?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website`;

    const detailsResponse = await fetch(detailsUrl, {
      headers: {
        Authorization: `Bearer ${pageAccessToken}`,
      },
    });

    if (!detailsResponse.ok) {
      console.error('Failed to fetch Instagram account details');
      return null;
    }

    return detailsResponse.json();
  }

  /**
   * Fetch all Instagram accounts linked to user's Pages
   */
  static async getAllInstagramAccounts(
    pages: MetaPageData[]
  ): Promise<MetaInstagramData[]> {
    const instagramAccounts: MetaInstagramData[] = [];

    for (const page of pages) {
      try {
        const igAccount = await this.getInstagramAccount(page.id, page.access_token);
        if (igAccount) {
          instagramAccounts.push(igAccount);
        }
      } catch (error) {
        console.error(`Error fetching Instagram account for page ${page.id}:`, error);
        // Continue with other pages
      }
    }

    return instagramAccounts;
  }

  /**
   * Save or update integration in database
   */
  static async upsertIntegration(
    userId: string,
    accessToken: string,
    expiresIn: number,
    scopes: string[]
  ): Promise<MetaIntegration> {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

    const integrationData = {
      user_id: userId,
      access_token: accessToken,
      token_type: 'bearer',
      expires_at: expiresAt.toISOString(),
      scopes,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('meta_integrations')
      .upsert(integrationData, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save integration: ${error.message}`);
    }

    return data;
  }

  /**
   * Save connected accounts (Pages and Instagram) to database
   */
  static async saveConnectedAccounts(
    integrationId: string,
    pages: MetaPageData[],
    instagramAccounts: MetaInstagramData[]
  ): Promise<void> {
    const accountsToInsert: any[] = [];

    // Add Facebook Pages
    for (const page of pages) {
      accountsToInsert.push({
        integration_id: integrationId,
        platform: 'facebook',
        account_id: page.id,
        account_name: page.name,
        account_username: null,
        profile_picture_url: page.picture?.data?.url,
        access_token: page.access_token, // Page-specific token
        follower_count: page.fan_count,
        is_active: true,
        metadata: {
          category: page.category,
          tasks: page.tasks,
        },
      });
    }

    // Add Instagram accounts
    for (const igAccount of instagramAccounts) {
      accountsToInsert.push({
        integration_id: integrationId,
        platform: 'instagram',
        account_id: igAccount.id,
        account_name: igAccount.name || igAccount.username,
        account_username: igAccount.username,
        profile_picture_url: igAccount.profile_picture_url,
        access_token: null,
        follower_count: igAccount.followers_count,
        is_active: true,
        metadata: {
          follows_count: igAccount.follows_count,
          media_count: igAccount.media_count,
          biography: igAccount.biography,
          website: igAccount.website,
        },
      });
    }

    if (accountsToInsert.length > 0) {
      const { error } = await supabase
        .from('meta_connected_accounts')
        .upsert(accountsToInsert, {
          onConflict: 'integration_id,platform,account_id',
        });

      if (error) {
        throw new Error(`Failed to save connected accounts: ${error.message}`);
      }
    }
  }

  /**
   * Get integration by user ID
   */
  static async getIntegrationByUserId(
    userId: string
  ): Promise<MetaConnectionStatus> {
    const { data: integration, error: integrationError } = await supabase
      .from('meta_integrations')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (integrationError && integrationError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is ok
      throw new Error(`Failed to fetch integration: ${integrationError.message}`);
    }

    if (!integration) {
      return {
        isConnected: false,
        accounts: [],
        facebookPages: [],
        instagramAccounts: [],
      };
    }

    // Fetch connected accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('meta_connected_accounts')
      .select('*')
      .eq('integration_id', integration.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (accountsError) {
      throw new Error(`Failed to fetch connected accounts: ${accountsError.message}`);
    }

    const allAccounts = accounts || [];
    const facebookPages = allAccounts.filter((acc) => acc.platform === 'facebook');
    const instagramAccounts = allAccounts.filter((acc) => acc.platform === 'instagram');

    return {
      isConnected: true,
      integration,
      accounts: allAccounts,
      facebookPages,
      instagramAccounts,
    };
  }

  /**
   * Disconnect and delete integration
   */
  static async deleteIntegration(userId: string): Promise<MetaDisconnectResult> {
    const { error } = await supabase
      .from('meta_integrations')
      .delete()
      .eq('user_id', userId);

    if (error) {
      return {
        success: false,
        message: `Failed to disconnect: ${error.message}`,
      };
    }

    return {
      success: true,
      message: 'Successfully disconnected from Meta',
    };
  }

  /**
   * Disconnect a specific account (make inactive)
   */
  static async disconnectAccount(accountId: string): Promise<void> {
    const { error } = await supabase
      .from('meta_connected_accounts')
      .update({ is_active: false })
      .eq('id', accountId);

    if (error) {
      throw new Error(`Failed to disconnect account: ${error.message}`);
    }
  }

  /**
   * Check if token is expired or expiring soon (within 7 days)
   */
  static isTokenExpiringSoon(expiresAt: string): boolean {
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiration = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysUntilExpiration < 7;
  }

  /**
   * Refresh token if expiring soon
   * Meta tokens are long-lived (60 days) and can be refreshed
   */
  static async refreshTokenIfNeeded(
    integration: MetaIntegration
  ): Promise<MetaIntegration> {
    if (!this.isTokenExpiringSoon(integration.expires_at)) {
      return integration; // Token still valid
    }

    // Exchange current token for a new long-lived token
    const newToken = await this.exchangeForLongLivedToken(integration.access_token);

    // Update integration with new token
    const updatedIntegration = await this.upsertIntegration(
      integration.user_id,
      newToken.access_token,
      newToken.expires_in,
      integration.scopes
    );

    return updatedIntegration;
  }
}
