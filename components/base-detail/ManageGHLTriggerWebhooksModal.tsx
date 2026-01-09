"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Copy, Trash2, ToggleLeft, ToggleRight, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { GHLTriggerWebhookService } from "@/lib/services/ghl-trigger-webhook-service";
import type { GHLSyncTriggerWebhook, WebhookLog } from "@/lib/types/webhooks";
import { toast } from "sonner";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";

interface ManageGHLTriggerWebhooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
}

export const ManageGHLTriggerWebhooksModal = ({
  isOpen,
  onClose,
  baseId
}: ManageGHLTriggerWebhooksModalProps) => {
  const { timezone } = useTimezone();
  const [webhooks, setWebhooks] = useState<GHLSyncTriggerWebhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<GHLSyncTriggerWebhook | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState("");

  const loadWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await GHLTriggerWebhookService.getTriggerWebhooksByBaseId(baseId);
      setWebhooks(data);
    } catch (error) {
      console.error('Failed to load trigger webhooks:', error);
      toast.error('Failed to load trigger webhooks');
    } finally {
      setLoading(false);
    }
  }, [baseId]);

  useEffect(() => {
    if (isOpen) {
      void loadWebhooks();
    }
  }, [isOpen, loadWebhooks]);

  const handleCreateWebhook = async () => {
    if (!newWebhookName.trim()) {
      toast.error('Please enter a webhook name');
      return;
    }

    try {
      setCreating(true);
      const webhook = await GHLTriggerWebhookService.createTriggerWebhook(
        baseId,
        newWebhookName
      );
      toast.success('Trigger webhook created successfully');
      setWebhooks(prev => [webhook, ...prev]);
      setNewWebhookName("");
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create trigger webhook:', error);
      toast.error('Failed to create trigger webhook');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleWebhook = async (webhook: GHLSyncTriggerWebhook) => {
    try {
      const updated = await GHLTriggerWebhookService.updateTriggerWebhook(webhook.id, {
        is_enabled: !webhook.is_enabled
      });
      setWebhooks(prev => prev.map(w => w.id === webhook.id ? updated : w));
      toast.success(`Trigger webhook ${updated.is_enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle trigger webhook:', error);
      toast.error('Failed to update trigger webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this trigger webhook? This cannot be undone.')) {
      return;
    }

    try {
      await GHLTriggerWebhookService.deleteTriggerWebhook(webhookId);
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      toast.success('Trigger webhook deleted');
      if (selectedWebhook?.id === webhookId) {
        setSelectedWebhook(null);
        setShowLogs(false);
      }
    } catch (error) {
      console.error('Failed to delete trigger webhook:', error);
      toast.error('Failed to delete trigger webhook');
    }
  };

  const handleCopyUrl = (webhook: GHLSyncTriggerWebhook) => {
    const url = GHLTriggerWebhookService.getWebhookUrl(webhook.secret_token);
    navigator.clipboard.writeText(url);
    toast.success('Trigger webhook URL copied to clipboard');
  };

  const handleViewLogs = async (webhook: GHLSyncTriggerWebhook) => {
    setSelectedWebhook(webhook);
    setShowLogs(true);
    setLoadingLogs(true);
    try {
      const logsData = await GHLTriggerWebhookService.getWebhookLogs(webhook.id);
      setLogs(logsData);
    } catch (error) {
      console.error('Failed to load trigger webhook logs:', error);
      toast.error('Failed to load trigger webhook logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCopyExample = (webhook: GHLSyncTriggerWebhook) => {
    const url = GHLTriggerWebhookService.getWebhookUrl(webhook.secret_token);
    const testCommand = `curl -X POST "${url}"`;
    navigator.clipboard.writeText(testCommand);
    toast.success('Example command copied to clipboard!');
  };

  if (!isOpen) return null;

  const successRate = (webhook: GHLSyncTriggerWebhook) => {
    if (webhook.total_calls === 0) return 0;
    return Math.round((webhook.successful_calls / webhook.total_calls) * 100);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={onClose} />

      <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Sync Trigger Webhooks</h2>
              <p className="text-sm text-gray-600 mt-1">
                Use these webhooks to sync right after form submissions, CRM events, or automation steps.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-blue-600" />
              </div>
            ) : showLogs && selectedWebhook ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedWebhook.name} - Recent Calls</h3>
                    <p className="text-sm text-gray-600">Last 50 trigger calls</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowLogs(false);
                      setSelectedWebhook(null);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Back to triggers
                  </button>
                </div>

                {loadingLogs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-blue-600" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No trigger calls yet. Send a test request to see logs here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-4 border rounded-lg ${
                          log.status === 'success'
                            ? 'border-green-200 bg-green-50'
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {log.status === 'success' ? (
                              <CheckCircle size={16} className="text-green-600" />
                            ) : (
                              <AlertCircle size={16} className="text-red-600" />
                            )}
                            <span className={`text-sm font-medium ${
                              log.status === 'success' ? 'text-green-900' : 'text-red-900'
                            }`}>
                              {log.status === 'success' ? 'Success' : 'Error'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatInTimezone(log.created_at, timezone, {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </span>
                          </div>
                          <span className="text-xs text-gray-600">
                            Status: {log.response_status}
                          </span>
                        </div>

                        {log.error_message && (
                          <div className="mt-2 text-sm text-red-700">
                            Error: {log.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="mb-6">
                  {!showCreateForm ? (
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Create New Trigger Webhook
                    </button>
                  ) : (
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Create New Trigger Webhook</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Webhook Name
                          </label>
                          <input
                            type="text"
                            value={newWebhookName}
                            onChange={(e) => setNewWebhookName(e.target.value)}
                            placeholder="e.g., HubSpot Deal Won"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateWebhook}
                            disabled={creating || !newWebhookName.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                          >
                            {creating ? 'Creating...' : 'Create'}
                          </button>
                          <button
                            onClick={() => {
                              setShowCreateForm(false);
                              setNewWebhookName("");
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {webhooks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>No trigger webhooks yet. Create your first one to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {webhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{webhook.name}</h3>
                              {webhook.is_enabled ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                  Active
                                </span>
                              ) : (
                                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Created {formatInTimezone(webhook.created_at, timezone, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleWebhook(webhook)}
                            className="p-2 hover:bg-gray-100 rounded transition-colors"
                            title={webhook.is_enabled ? 'Disable trigger webhook' : 'Enable trigger webhook'}
                          >
                            {webhook.is_enabled ? (
                              <ToggleRight size={24} className="text-green-600" />
                            ) : (
                              <ToggleLeft size={24} className="text-gray-400" />
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-3 p-3 bg-gray-50 rounded">
                          <div>
                            <div className="text-xs text-gray-600">Total Calls</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {webhook.total_calls}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Success Rate</div>
                            <div className="text-lg font-semibold text-green-600">
                              {successRate(webhook)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Last Triggered</div>
                            <div className="text-sm font-medium text-gray-900">
                              {webhook.last_triggered_at
                                ? formatInTimezone(webhook.last_triggered_at, timezone, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })
                                : 'Never'}
                            </div>
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Trigger URL
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={GHLTriggerWebhookService.getWebhookUrl(webhook.secret_token)}
                              readOnly
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 font-mono"
                            />
                            <button
                              onClick={() => handleCopyUrl(webhook)}
                              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                              title="Copy URL"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyExample(webhook)}
                            className="px-3 py-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                          >
                            <Copy size={14} />
                            Copy cURL Command
                          </button>
                          <button
                            onClick={() => handleViewLogs(webhook)}
                            className="px-3 py-1.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100"
                          >
                            View Logs
                          </button>
                          <button
                            onClick={() => handleDeleteWebhook(webhook.id)}
                            className="ml-auto px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 flex items-center gap-1"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
