import { useEffect, useRef } from 'react';
import type { GHLIntegration } from '../types/ghl-integration';

/**
 * Hook to enable automatic background syncing of GHL data
 * Only runs when the base page is open (client-side polling)
 * Uses incremental syncs at user-configured intervals
 */
export const useGHLAutoSync = (baseId: string, integration: GHLIntegration | null) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  useEffect(() => {
    // Don't run if auto-sync is disabled or not configured
    if (!integration?.auto_sync_enabled || !integration.auto_sync_interval_minutes) {
      // Clean up any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const triggerSync = async () => {
      // Prevent concurrent syncs
      if (isSyncingRef.current) {
        console.log('[Auto-Sync] Sync already in progress, skipping');
        return;
      }

      try {
        isSyncingRef.current = true;
        console.log('[Auto-Sync] Triggering incremental sync for base:', baseId);
        
        const response = await fetch('/api/ghl/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            baseId, 
            fullSync: false, // Always use incremental sync for auto-sync
            isAutoSync: true // Mark as auto-sync for tracking
          })
        });

        if (!response.ok) {
          throw new Error(`Sync failed with status: ${response.status}`);
        }

        const result = await response.json();
        console.log('[Auto-Sync] Sync completed successfully:', result);
      } catch (error) {
        console.error('[Auto-Sync] Sync failed:', error);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Convert interval from minutes to milliseconds
    const intervalMs = integration.auto_sync_interval_minutes * 60 * 1000;
    console.log(`[Auto-Sync] Setting up auto-sync with interval: ${integration.auto_sync_interval_minutes} minute(s)`);

    // Check if we should trigger an immediate sync
    // Sync immediately if:
    // 1. No previous auto-sync has occurred, OR
    // 2. The time since last auto-sync exceeds the configured interval
    const shouldSyncNow = !integration.last_auto_sync_at || 
      (Date.now() - new Date(integration.last_auto_sync_at).getTime()) >= intervalMs;
    
    if (shouldSyncNow) {
      console.log('[Auto-Sync] Triggering immediate sync');
      void triggerSync();
    }

    // Set up recurring sync interval
    intervalRef.current = setInterval(() => {
      void triggerSync();
    }, intervalMs);

    // Cleanup function: clear interval when component unmounts or dependencies change
    return () => {
      if (intervalRef.current) {
        console.log('[Auto-Sync] Cleaning up interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [baseId, integration?.auto_sync_enabled, integration?.auto_sync_interval_minutes, integration?.last_auto_sync_at]);

  // Return nothing - this hook manages side effects only
  return null;
};

