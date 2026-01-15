"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Copy, Trash2, ToggleLeft, ToggleRight, Terminal, AlertCircle, CheckCircle, Loader2, Braces } from "lucide-react";
import { BaseDetailService } from "@/lib/services/base-detail-service";
import { WebhookService } from "@/lib/services/webhook-service";
import type { Webhook, WebhookLog } from "@/lib/types/webhooks";
import type { TableRow, FieldRow } from "@/lib/types/base-detail";
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
  const [commandOpenId, setCommandOpenId] = useState<string | null>(null);
  const [commandView, setCommandView] = useState<'curl' | 'json'>('curl');
  const [webhookFields, setWebhookFields] = useState<Record<string, FieldRow[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  const [savingField, setSavingField] = useState<string | false>(false);
  const [fieldMappings, setFieldMappings] = useState<Record<string, Record<string, string>>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});
  
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

  const generateExamplePayload = (fieldMappings: Record<string, string> | undefined) => {
    const payload: Record<string, any> = {};

    if (!fieldMappings || Object.keys(fieldMappings).length === 0 || !selectedWebhook || !webhookFields[selectedWebhook.id]) {
      return {
        table_name: "Replace this with a table name/id, or omit it to select the default.",
        "Your Field Name Here": "Example Value",
        "Another Field": "Another Value"
      };
    }

    // Build nested object structure from JSONPath mappings
    payload.table_name = "Replace this with a table name/id, or omit it to select the default.";
    Object.values(webhookFields[selectedWebhook.id]).forEach(({id, type, name, options}) => {
      const jsonPath = fieldMappings[id];
      const sampleValue = Object.entries(options || {}).length > 0 ? Object.values(options as Record<string, { name: string }>)[0]?.name : `Example Value ${id.split('-')[0]}`;
      if (!jsonPath || jsonPath.trim() === '') {
        payload[name] = sampleValue;
        return;
      }

      // Parse the JSONPath and set value in nested structure
      const pathParts = jsonPath.match(/[^\.\[\]]+|\[\d+\]/g) || [];
      let current = payload;

      pathParts.forEach((part, index) => {
        const isLastPart = index === pathParts.length - 1;
        const isArrayIndex = part.match(/^\[\d+\]$/);

        if (isArrayIndex) {
          // Handle array index like [0]
          const arrayIndex = parseInt(part.match(/\d+/)![0]);
          const parentKey = Object.keys(current).pop();
          if (parentKey && Array.isArray(current[parentKey])) {
            if (isLastPart) {
              current[parentKey][arrayIndex] = sampleValue;
            } else if (!current[parentKey][arrayIndex]) {
              current[parentKey][arrayIndex] = {};
            }
            current = current[parentKey][arrayIndex];
          }
        } else {
          // Handle object key
          if (isLastPart) {
            // Set example value for the final key
            switch (type) {
              case 'monetary': current[part] = 100; break;
              case 'date': current[part] = new Date().toISOString().split('T')[0]; break;
              case 'datetime': current[part] = new Date().toISOString(); break;
              case 'email': current[part] = "johndoe@example.com"; break;
              case 'phone': current[part] = "1234567890"; break;
              case 'link': current[part] = "https://example.com"; break;
              default: current[part] = sampleValue;
            }
          } else {
            // Check if next part is array index
            const nextPart = pathParts[index + 1];
            if (nextPart?.match(/^\[\d+\]$/)) {
              // Next is array, initialize as array
              if (!current[part]) {
                current[part] = [{}];
              }
            } else {
              // Next is object key, initialize as object
              if (!current[part]) {
                current[part] = {};
              }
              current = current[part];
            }
          }
        }
      });
    });

    return payload;
  };

  const buildTestCommand = (webhook: Webhook) => {
    const url = WebhookService.getWebhookUrl(webhook.secret_token);
    const examplePayload = generateExamplePayload(fieldMappings[webhook.id]);
    const jsonString = JSON.stringify(examplePayload).replace(/"/g, '\\"');

    return `curl -X POST "${url}" -H "Content-Type: application/json" -d "${jsonString}"`;
  };

  const handleCopyCommand = (webhook: Webhook) => {
    navigator.clipboard.writeText(commandView === 'curl' ? buildTestCommand(webhook) : JSON.stringify(generateExamplePayload(fieldMappings[webhook.id]), null, 2));
    toast.success('Example cURL command copied to clipboard');
  };

  const loadFieldsForWebhook = async (webhook: Webhook) => {
    const tableId = webhook.default_table_id || tables[0]?.id;
    if (!tableId) return;

    setLoadingFields(prev => ({ ...prev, [webhook.id]: true }));
    try {
      const fields = await BaseDetailService.getFields(tableId);
      setWebhookFields(prev => ({ ...prev, [webhook.id]: fields }));
      
      // Initialize field mappings with webhook's current mapping or defaults
      const initialMapping: Record<string, string> = {};
      fields.forEach(field => {
        initialMapping[field.id] = webhook.field_mapping?.[field.id] || field.name;
      });
      setFieldMappings(prev => ({ ...prev, [webhook.id]: initialMapping }));
    } catch (error) {
      console.error('Failed to load fields:', error);
      toast.error('Failed to load table fields');
    } finally {
      setLoadingFields(prev => ({ ...prev, [webhook.id]: false }));
    }
  };

  const handleToggleCommand = (webhook: Webhook) => {
    const isOpening = commandOpenId !== webhook.id;
    setSelectedWebhook(isOpening ? webhook : null);
    setCommandOpenId(isOpening ? webhook.id : null);
    if (isOpening) {
      loadFieldsForWebhook(webhook);
    }
  };

  const validateJsonPath = (path: string): string | null => {
    if (!path || path.trim() === '') return null;
    
    // Valid JSON path pattern: alphanumeric, underscores, hyphens, dots, and square brackets
    // Examples: "name", "user.email", "contact_info", "items[0]", "data.user.profile"
    const validPathRegex = /^[a-zA-Z0-9_][a-zA-Z0-9_.\[\]-]*$/;
    
    if (!validPathRegex.test(path)) {
      return 'Invalid JSON path. Use alphanumeric characters, dots (.), underscores (_), hyphens (-), and square brackets ([]).';
    }
    
    // Check for balanced square brackets
    const openBrackets = (path.match(/\[/g) || []).length;
    const closeBrackets = (path.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return 'Unbalanced square brackets in JSON path.';
    }
    
    return null;
  };

  const handleFieldMappingChange = (webhookId: string, fieldId: string, jsonPath: string) => {
    // Validate on change
    const error = validateJsonPath(jsonPath);
    setValidationErrors(prev => ({
      ...prev,
      [webhookId]: {
        ...prev[webhookId],
        [fieldId]: error || ''
      }
    }));
  };

  const handleFieldMappingBlur = async (webhookId: string, fieldId: string, jsonPath: string) => {
    // Only save if no validation errors
    const error = validateJsonPath(jsonPath);
    if (error) {
      setValidationErrors(prev => ({
        ...prev,
        [webhookId]: {
          ...prev[webhookId],
          [fieldId]: error
        }
      }));
      return;
    }

    setSavingField(fieldId);
    try {
      const webhook = webhooks.find(w => w.id === webhookId);
      if (!webhook) return;

      const updatedMapping = { ...fieldMappings[webhookId] };
      const updated = await WebhookService.updateWebhook(webhookId, { field_mapping: updatedMapping });
      
      // Update the webhook in the list with the new field_mapping
      setWebhooks(prev => prev.map(w => w.id === webhookId ? updated : w));
      
      // Clear validation error on success
      setValidationErrors(prev => ({
        ...prev,
        [webhookId]: {
          ...prev[webhookId],
          [fieldId]: ''
        }
      }));
      
      toast.success('Field mapping saved');
    } catch (error) {
      console.error('Failed to save field mapping:', error);
      toast.error('Failed to save field mapping');
    } finally {
      setSavingField(false);
    }
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

  if (!isOpen) return null;

  const successRate = (webhook: Webhook) => {
    if (webhook.total_calls === 0) return 0;
    return Math.round((webhook.successful_calls / webhook.total_calls) * 100);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />

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
              onClick={() => {
                setSelectedWebhook(null);
                setCommandOpenId(null);
                onClose();
              }}
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
                            onClick={() => handleToggleCommand(webhook)}
                            className="px-3 py-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                          >
                            <Terminal size={14} />
                            {commandOpenId === webhook.id ? 'Hide Advanced Options' : 'Show Advanced Options'}
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

                        {commandOpenId === webhook.id && (
                          <div className="mt-3 p-3 border border-gray-200 rounded bg-gray-50 space-y-3">
                            {/* cURL Command Section */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-700">
                                  {commandView === 'curl'
                                    ? 'Example cURL Command'
                                    : 'JSON Payload'
                                  }
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleCopyCommand(webhook)}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                                  >
                                    <Copy size={12} />
                                    Copy
                                  </button>
                                  {commandView === 'curl' ? (
                                    <button
                                      onClick={() => setCommandView('json')}
                                      className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                                    >
                                      <Braces size={12} />
                                      Show only JSON payload
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setCommandView('curl')}
                                      className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                                    >
                                      <Terminal size={12} />
                                      Show full cURL command
                                    </button>
                                  )}
                                </div>
                              </div>
                              <pre className="text-xs md:text-sm font-mono whitespace-pre-wrap bg-white border border-gray-200 rounded p-3 overflow-x-auto">
                                {commandView === 'curl'
                                  ? buildTestCommand(webhook)
                                  : JSON.stringify(generateExamplePayload(fieldMappings[webhook.id]), null, 2)
                                }
                              </pre>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-300"></div>

                            {/* Field Mapping Section */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-7000 mb-2">Advanced: Field Mapping (JSON Paths)</h4>
                              <p className="text-xs text-gray-600 mb0">
                                Configure how incoming JSON data maps to your table fields. Use dot notation for nested paths (e.g., <code>user.email</code>, <code>contacts[0].firstName</code>).
                              </p>
                              {loadingFields[webhook.id] ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 size={16} className="animate-spin text-blue-600" />
                                </div>
                              ) : webhookFields[webhook.id] && webhookFields[webhook.id].length > 0 ? (
                                <div className="space-y-2 max-h-60 overflow-y-auto p-2">
                                  {webhookFields[webhook.id].map(field => {
                                    const error = validationErrors[webhook.id]?.[field.id];
                                    return (
                                      <div key={field.id}>
                                        <div className="flex items-center gap-2">
                                          <label className="text-xs font-medium text-gray-700 min-w-[120px]">{field.name}</label>
                                          <input
                                            type="text"
                                            value={fieldMappings[webhook.id]?.[field.id] || field.name}
                                            onChange={(e) => {
                                              setFieldMappings(prev => ({
                                                ...prev,
                                                [webhook.id]: {
                                                  ...prev[webhook.id],
                                                  [field.id]: e.target.value
                                                }
                                              }));
                                              handleFieldMappingChange(webhook.id, field.id, e.target.value);
                                            }}
                                            onBlur={(e) => handleFieldMappingBlur(webhook.id, field.id, e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                              }
                                            }}
                                            placeholder={field.name}
                                            className={`flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 font-mono disabled:opacity-60 ${
                                              error
                                                ? 'border-red-300 focus:ring-red-500'
                                                : 'border-gray-300 focus:ring-blue-500'
                                              }`}
                                              disabled={savingField === field.id}
                                          />
                                        </div>
                                        {error && (
                                          <div className="text-xs text-red-600 mt-1 ml-[120px]">
                                            {error}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 italic">No fields available for this table.</p>
                              )}
                            </div>
                          </div>
                        )}
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

