"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Search, Plug, CheckCircle } from "lucide-react";
import { AVAILABLE_INTEGRATIONS, type Integration, type IntegrationType } from "@/lib/types/integrations";
import { GHLService } from "@/lib/services/ghl-service";
import { WebhookService } from "@/lib/services/webhook-service";
import type { GHLIntegration } from "@/lib/types/ghl-integration";
import type { Webhook } from "@/lib/types/webhooks";

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  onConnectGHL: () => void;
  onManageWebhooks: () => void;
}

export const IntegrationsModal = ({
  isOpen,
  onClose,
  baseId,
  onConnectGHL,
  onManageWebhooks
}: IntegrationsModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [ghlIntegration, setGhlIntegration] = useState<GHLIntegration | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (isOpen) {
      const loadIntegrations = async () => {
        try {
          const [ghlData, webhooksData] = await Promise.all([
            GHLService.getIntegrationByBaseId(baseId).catch(() => null),
            WebhookService.getWebhooksByBaseId(baseId).catch(() => [])
          ]);
          setGhlIntegration(ghlData);
          setWebhooks(webhooksData);
        } catch (error) {
          console.error('Failed to load integrations:', error);
        }
      };
      void loadIntegrations();
    }
  }, [isOpen, baseId]);

  const categories = useMemo(() => {
    const cats = new Set(AVAILABLE_INTEGRATIONS.map(i => i.category));
    return ['all', ...Array.from(cats)];
  }, []);

  const filteredIntegrations = useMemo(() => {
    return AVAILABLE_INTEGRATIONS.filter(integration => {
      const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           integration.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleConnect = (integrationType: IntegrationType) => {
    if (integrationType === 'ghl') {
      onConnectGHL();
      onClose();
    } else if (integrationType === 'webhook') {
      onManageWebhooks();
      onClose();
    }
    // Future: handle other integration types
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Integrations Catalog</h2>
              <p className="text-sm text-gray-600 mt-1">Connect your base with external services</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="p-6 border-b border-gray-200 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filters */}
            <div className="flex gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Integration Grid */}
          <div className="p-6 overflow-y-auto max-h-[50vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIntegrations.map((integration) => {
                const isGHL = integration.id === 'ghl';
                const isWebhook = integration.id === 'webhook';
                const ghlConnected = isGHL && ghlIntegration;
                const webhookConnected = isWebhook && webhooks.some(w => w.is_enabled);
                const isConnected = ghlConnected || webhookConnected;

                return (
                  <div
                    key={integration.id}
                    className={`p-4 border rounded-lg hover:shadow-md transition-shadow ${
                      integration.available ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Plug size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                            {isConnected && (
                              <CheckCircle size={16} className="text-green-600" />
                            )}
                          </div>
                          <span className="text-xs text-gray-500 capitalize">{integration.category}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">{integration.description}</p>

                    {integration.available ? (
                      <button
                        onClick={() => handleConnect(integration.id)}
                        className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                      >
                        {isConnected ? 'Manage' : 'Connect'}
                      </button>
                    ) : (
                      <div className="w-full px-4 py-2 text-sm font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-md text-center">
                        Coming Soon
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredIntegrations.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No integrations found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

