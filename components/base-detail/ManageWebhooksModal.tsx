"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Copy, Trash2, ToggleLeft, ToggleRight, ExternalLink, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { WebhookService } from "@/lib/services/webhook-service";
import type { Webhook, WebhookLog } from "@/lib/types/webhooks";
import type { TableRow } from "@/lib/types/base-detail";
import { toast } from "sonner";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useTimezone } from "@/lib/hooks/useTimezone";

interface ManageWebhooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  tables: TableRow[];
}

export const ManageWebhooksModal = ({
  isOpen,
  onClose,
  baseId,
  tables
}: ManageWebhooksModalProps) => {
  const { timezone } = useTimezone();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  
  // Create webhook form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookTable, setNewWebhookTable] = useState<string>("");

  const loadWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await WebhookService.getWebhooksByBaseId(baseId);
      setWebhooks(data);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
      toast.error('Failed to load webhooks');
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
      const webhook = await WebhookService.createWebhook(
        baseId,
        newWebhookName,
        newWebhookTable || undefined
      );
      toast.success('Webhook created successfully');
      setWebhooks(prev => [webhook, ...prev]);
      setNewWebhookName("");
      setNewWebhookTable("");
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create webhook:', error);
      toast.error('Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleWebhook = async (webhook: Webhook) => {
    try {
      const updated = await WebhookService.updateWebhook(webhook.id, {
        is_enabled: !webhook.is_enabled
      });
      setWebhooks(prev => prev.map(w => w.id === webhook.id ? updated : w));
      toast.success(`Webhook ${updated.is_enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
      toast.error('Failed to update webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook? This cannot be undone.')) {
      return;
    }

    try {
      await WebhookService.deleteWebhook(webhookId);
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      toast.success('Webhook deleted');
      if (selectedWebhook?.id === webhookId) {
        setSelectedWebhook(null);
        setShowLogs(false);
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast.error('Failed to delete webhook');
    }
  };

  const handleCopyUrl = (webhook: Webhook) => {
    const url = WebhookService.getWebhookUrl(webhook.secret_token);
    navigator.clipboard.writeText(url);
    toast.success('Webhook URL copied to clipboard');
  };

  const handleViewLogs = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setShowLogs(true);
    setLoadingLogs(true);
    try {
      const logsData = await WebhookService.getWebhookLogs(webhook.id);
      setLogs(logsData);
    } catch (error) {
      console.error('Failed to load logs:', error);
      toast.error('Failed to load webhook logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleTestWebhook = (webhook: Webhook) => {
    const url = WebhookService.getWebhookUrl(webhook.secret_token);
    const examplePayload = {
      table_name: tables[0]?.name || "YourTableName",
      "Field Name": "Example Value",
      "Another Field": "Another Value"
    };

    const testCommand = `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(examplePayload, null, 2)}'`;

    navigator.clipboard.writeText(testCommand);
    toast.success('Test command copied to clipboard! Paste it in your terminal to test.');
  };

  if (!isOpen) return null;

  const successRate = (webhook: Webhook) => {
    if (webhook.total_calls === 0) return 0;
    return Math.round((webhook.successful_calls / webhook.total_calls) * 100);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Manage Webhooks</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create webhook URLs to receive data from external services
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-blue-600" />
              </div>
            ) : showLogs && selectedWebhook ? (
              /* Logs View */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedWebhook.name} - Recent Calls</h3>
                    <p className="text-sm text-gray-600">Last 50 webhook calls</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowLogs(false);
                      setSelectedWebhook(null);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    ← Back to webhooks
                  </button>
                </div>

                {loadingLogs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-blue-600" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No webhook calls yet. Test your webhook to see logs here.
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
                        <div className="flex items-start justify-between mb-2">
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
                          <div className="mb-2 text-sm text-red-700">
                            Error: {log.error_message}
                          </div>
                        )}

                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-700 hover:text-gray-900">
                            View payload
                          </summary>
                          <pre className="mt-2 p-2 bg-white border border-gray-200 rounded overflow-x-auto">
                            {JSON.stringify(log.request_payload, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Webhooks List */
              <>
                {/* Create Button */}
                <div className="mb-6">
                  {!showCreateForm ? (
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Create New Webhook
                    </button>
                  ) : (
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Create New Webhook</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Webhook Name
                          </label>
                          <input
                            type="text"
                            value={newWebhookName}
                            onChange={(e) => setNewWebhookName(e.target.value)}
                            placeholder="e.g., WordPress Contact Form"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Default Table (Optional)
                          </label>
                          <select
                            value={newWebhookTable}
                            onChange={(e) => setNewWebhookTable(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Auto-detect (Master/First table)</option>
                            {tables.map(table => (
                              <option key={table.id} value={table.id}>
                                {table.name}
                              </option>
                            ))}
                          </select>
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
                              setNewWebhookTable("");
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

                {/* Webhooks List */}
                {webhooks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>No webhooks yet. Create your first webhook to get started!</p>
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
                            title={webhook.is_enabled ? 'Disable webhook' : 'Enable webhook'}
                          >
                            {webhook.is_enabled ? (
                              <ToggleRight size={24} className="text-green-600" />
                            ) : (
                              <ToggleLeft size={24} className="text-gray-400" />
                            )}
                          </button>
                        </div>

                        {/* Stats */}
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

                        {/* URL */}
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Webhook URL
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={WebhookService.getWebhookUrl(webhook.secret_token)}
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

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleTestWebhook(webhook)}
                            className="px-3 py-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                          >
                            <ExternalLink size={14} />
                            Copy Test Command
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

