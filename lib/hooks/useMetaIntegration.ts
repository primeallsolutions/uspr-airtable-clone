/**
 * useMetaIntegration Hook
 * 
 * Manages Meta (Facebook/Instagram) integration state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { MetaService } from '../services/meta-service';
import type {
  MetaIntegration,
  MetaConnectedAccount,
  UseMetaIntegrationReturn,
} from '../types/meta-integration';
import { toast } from 'sonner';

export function useMetaIntegration(userId?: string): UseMetaIntegrationReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integration, setIntegration] = useState<MetaIntegration | null>(null);
  const [accounts, setAccounts] = useState<MetaConnectedAccount[]>([]);
  const [facebookPages, setFacebookPages] = useState<MetaConnectedAccount[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<MetaConnectedAccount[]>([]);

  /**
   * Load integration and connected accounts
   */
  const refreshIntegration = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const status = await MetaService.getIntegrationByUserId(userId);

      setIsConnected(status.isConnected);
      setIntegration(status.integration || null);
      setAccounts(status.accounts);
      setFacebookPages(status.facebookPages);
      setInstagramAccounts(status.instagramAccounts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load integration';
      setError(errorMessage);
      console.error('Error loading Meta integration:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Connect to Meta - initiate OAuth flow
   */
  const connectMeta = useCallback(async () => {
    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    try {
      // Get auth token for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      // Call auth endpoint to get OAuth URL
      const response = await fetch('/api/meta/auth', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }

      const { authUrl } = await response.json();

      // Redirect to Meta OAuth page
      window.location.href = authUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      toast.error(errorMessage);
      console.error('Error connecting to Meta:', err);
    }
  }, [userId]);

  /**
   * Disconnect Meta integration
   */
  const disconnectMeta = useCallback(async () => {
    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setLoading(true);

      // Get auth token for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      // Call disconnect endpoint
      const response = await fetch('/api/meta/disconnect', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      // Reset state
      setIsConnected(false);
      setIntegration(null);
      setAccounts([]);
      setFacebookPages([]);
      setInstagramAccounts([]);

      toast.success('Successfully disconnected from Meta');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect';
      toast.error(errorMessage);
      console.error('Error disconnecting Meta:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load integration on mount and when userId changes
  useEffect(() => {
    refreshIntegration();
  }, [refreshIntegration]);

  return {
    isConnected,
    loading,
    error,
    integration,
    accounts,
    facebookPages,
    instagramAccounts,
    connectMeta,
    disconnectMeta,
    refreshIntegration,
  };
}
