"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plug, CheckCircle, ExternalLink } from "lucide-react";
import { GHLService } from "@/lib/services/ghl-service";
import { WebhookService } from "@/lib/services/webhook-service";
import type { GHLIntegration } from "@/lib/types/ghl-integration";
import type { Webhook } from "@/lib/types/webhooks";
import { AVAILABLE_INTEGRATIONS } from "@/lib/types/integrations";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";

interface IntegrationsButtonProps {
  baseId: string;
  onConnectGHL: () => void;
  onManageWebhooks: () => void;
  onOpenCatalog: () => void;
  GHLCheckStatus?: boolean;
  setGHLCheckStatus?: (status: boolean) => void;
}

export const IntegrationsButton = ({
  baseId,
  onConnectGHL,
  onManageWebhooks,
  onOpenCatalog,
  GHLCheckStatus,
  setGHLCheckStatus
}: IntegrationsButtonProps) => {
  const { timezone } = useTimezone();
  const [isOpen, setIsOpen] = useState(false);
  const [ghlIntegration, setGhlIntegration] = useState<GHLIntegration | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load GHL integration status and webhooks
  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        setLoading(true);
        const [ghlData, webhooksData] = await Promise.all([
          GHLService.getIntegrationByBaseId(baseId).catch(() => null),
          WebhookService.getWebhooksByBaseId(baseId).catch(() => [])
        ]);
        setGhlIntegration(ghlData);
        setWebhooks(webhooksData);
        setGHLCheckStatus?.(false);
      } catch (error) {
        console.error('Failed to load integrations:', error);
      } finally {
        setLoading(false);
      }
    };

    if (GHLCheckStatus) {
      void loadIntegrations();
    }
  }, [baseId, GHLCheckStatus, setGHLCheckStatus]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeWebhooksCount = webhooks.filter(w => w.is_enabled).length;
  const connectedCount = (ghlIntegration ? 1 : 0) + activeWebhooksCount;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
      >
        <Plug size={16} />
        <span>Integrations</span>
        {connectedCount > 0 && (
          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
            {connectedCount}
          </span>
        )}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Available Integrations</h3>
            
            {/* Integration List */}
            <div className="space-y-2">
              {/* GHL Integration */}
              <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">GoHighLevel</span>
                    {ghlIntegration && (
                      <CheckCircle size={14} className="text-green-600" />
                    )}
                  </div>
                  {ghlIntegration?.last_sync_at && (
                    <span className="text-xs text-gray-500">
                      Last sync: {formatInTimezone(ghlIntegration.last_sync_at, timezone, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    onConnectGHL();
                    setIsOpen(false);
                  }}
                  className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                >
                  {ghlIntegration ? 'Manage' : 'Connect'}
                </button>
              </div>

              {/* Webhooks Integration */}
              <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">Incoming Webhooks</span>
                    {activeWebhooksCount > 0 && (
                      <CheckCircle size={14} className="text-green-600" />
                    )}
                  </div>
                  {webhooks.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {activeWebhooksCount} active webhook{activeWebhooksCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    onManageWebhooks();
                    setIsOpen(false);
                  }}
                  className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                >
                  Manage
                </button>
              </div>

              {/* Coming Soon Integrations (show 2-3) */}
              {AVAILABLE_INTEGRATIONS.filter(i => i.comingSoon).slice(0, 2).map((integration) => (
                <div key={integration.id} className="flex items-center justify-between p-2 opacity-50">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">{integration.name}</span>
                    <span className="ml-2 text-xs text-gray-500">Coming soon</span>
                  </div>
                </div>
              ))}
            </div>

            {/* See More Button */}
            <div className="border-t border-gray-200 mt-3 pt-3">
              <button
                onClick={() => {
                  onOpenCatalog();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 flex items-center justify-center gap-2"
              >
                <ExternalLink size={14} />
                See more integrations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

