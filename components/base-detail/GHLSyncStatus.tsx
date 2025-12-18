"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { GHLService } from "@/lib/services/ghl-service";
import type { GHLIntegration } from "@/lib/types/ghl-integration";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";

interface GHLSyncStatusProps {
  baseId: string;
  onOpenSettings?: () => void;
  showConnectButton?: boolean;
}

export const GHLSyncStatus = ({ baseId, onOpenSettings, showConnectButton = false }: GHLSyncStatusProps) => {
  const { timezone } = useTimezone();
  const [integration, setIntegration] = useState<GHLIntegration | null>(null);
  const [loading, setLoading] = useState(true);

  const loadIntegration = useCallback(async () => {
    try {
      setLoading(true);
      const data = await GHLService.getIntegrationByBaseId(baseId);
      setIntegration(data);
    } catch (error) {
      console.error('Failed to load GHL integration:', error);
      setIntegration(null);
    } finally {
      setLoading(false);
    }
  }, [baseId]);

  useEffect(() => {
    loadIntegration();
  }, [loadIntegration]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 size={14} className="animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  const handleClick = () => {
    if (onOpenSettings) {
      if (integration) onOpenSettings();
      else window.location.href = `/api/ghl/auth?base_id=${baseId}`;
    }
  };

  // Show connect button if not connected and button should be shown
  if (!integration && showConnectButton) {
    return (
      <button
        onClick={handleClick}
        className="px-3 py-2 text-sm font-medium text-blue-700 border border-blue-300 rounded-md hover:bg-blue-50 flex items-center gap-2"
        title="Connect Go High Level"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Connect GHL
      </button>
    );
  }

  // Don't show anything if not connected and no button should be shown
  if (!integration) {
    return null;
  }

  // Show connected status
  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors cursor-pointer"
      title="Go High Level connected - Click to manage"
    >
      <CheckCircle size={14} className="text-green-600" />
      <span className="text-green-700 font-medium">GHL Connected</span>
      {integration.last_sync_at && (
        <span className="text-green-600 text-xs">
          • {formatInTimezone(integration.last_sync_at, timezone, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      )}
    </button>
  );
};

