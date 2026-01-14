"use client";

import { useState, useEffect, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Loader2, Link as LinkIcon, Key, MapPin, RefreshCw, Plus, Trash2, Wand2, StopCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { GHLService } from "@/lib/services/ghl-service";
import { GHLTriggerWebhookService } from "@/lib/services/ghl-trigger-webhook-service";
import { ManageGHLTriggerWebhooksModal } from "@/components/base-detail/ManageGHLTriggerWebhooksModal";
import type { GHLIntegration, GHLFieldMapping } from "@/lib/types/ghl-integration";
import type { FieldRow } from "@/lib/types/base-detail";
import { toast } from "sonner";

// Standard GHL contact fields (commonly used)
const STANDARD_GHL_FIELDS = [
  'name', 'firstName', 'lastName', 'email', 'phone',
  'address1', 'city', 'state', 'postalCode', 'country',
  'companyName', 'website', 'tags', 'source', 'dateOfBirth', 'assignedTo', 'timezone', 'dnd'
];

interface ConnectGHLModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseId: string;
  tableId: string;
  onConnected?: () => void;
}

interface FieldMappingItem {
  id: string;
  ghlFieldKey: string;
  ghlFieldName: string; // Display name
  appFieldId: string;
  appFieldName: string; // Display name
}

export const ConnectGHLModal = ({
  isOpen,
  onClose,
  baseId,
  tableId,
  onConnected,
}: ConnectGHLModalProps) => {
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);
  const [integration, setIntegration] = useState<GHLIntegration | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [savingMapping, setSavingMapping] = useState(false);

  // Auto-sync settings state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(15);
  const [savingAutoSync, setSavingAutoSync] = useState(false);

  // Trigger webhook management state
  const [isTriggerWebhooksModalOpen, setIsTriggerWebhooksModalOpen] = useState(false);
  const [triggerWebhookSummary, setTriggerWebhookSummary] = useState({ total: 0, active: 0 });
  const [loadingTriggerWebhooks, setLoadingTriggerWebhooks] = useState(false);

  // Form state for Private Integration Token
  const [accessToken, setAccessToken] = useState("");
  const [locationId, setLocationId] = useState("");
  
  // Sync progress state
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; phase: 'fetching' | 'syncing'; cancelled?: boolean } | null>(null);
  const [progressPollInterval, setProgressPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [syncType, setSyncType] = useState<'incremental' | 'full' | null>(null); // Track current sync type
  const [cancelling, setCancelling] = useState(false);

  // Field mapping state - shows paired GHL field + App field
  const [fieldMappings, setFieldMappings] = useState<FieldMappingItem[]>([]);

  // All available GHL fields (discovered from mapping)
  const [availableGHLFields, setAvailableGHLFields] = useState<string[]>(STANDARD_GHL_FIELDS);

  // Define functions before they're used in useEffect
  const loadIntegration = useCallback(async () => {
    try {
      setLoading(true);
      const integrationData = await GHLService.getIntegrationByBaseId(baseId);
      if (integrationData) {
        setIntegration(integrationData);
        // Load auto-sync settings
        setAutoSyncEnabled(integrationData.auto_sync_enabled || false);
        setAutoSyncInterval(integrationData.auto_sync_interval_minutes || 15);
      } else {
        setIntegration(null);
        setAutoSyncEnabled(false);
        setAutoSyncInterval(15);
        setTriggerWebhookSummary({ total: 0, active: 0 });
        setIsTriggerWebhooksModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to load integration:', error);
    } finally {
      setLoading(false);
    }
  }, [baseId]);

  const loadFields = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('table_id', tableId)
        .order('order_index');

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('Failed to load fields:', error);
      toast.error('Failed to load fields');
    }
  }, [tableId]);

  const loadTriggerWebhookSummary = useCallback(async () => {
    if (!baseId) return;
    try {
      setLoadingTriggerWebhooks(true);
      const data = await GHLTriggerWebhookService.getTriggerWebhooksByBaseId(baseId);
      const active = data.filter(webhook => webhook.is_enabled).length;
      setTriggerWebhookSummary({ total: data.length, active });
    } catch (error) {
      console.error('Failed to load trigger webhook summary:', error);
      setTriggerWebhookSummary({ total: 0, active: 0 });
    } finally {
      setLoadingTriggerWebhooks(false);
    }
  }, [baseId]);

  // Load integration status and fields
  useEffect(() => {
    if (isOpen && baseId) {
      loadIntegration();
      loadFields();
    }
  }, [isOpen, baseId, tableId, loadIntegration, loadFields]);

  useEffect(() => {
    if (isOpen && baseId && integration) {
      void loadTriggerWebhookSummary();
    }
  }, [isOpen, baseId, integration, loadTriggerWebhookSummary]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && !integration) {
      setAccessToken("");
      setLocationId("");
      setFieldMappings([]);
    }
  }, [isOpen, integration]);

  // Cleanup polling interval on unmount or modal close
  useEffect(() => {
    return () => {
      if (progressPollInterval) {
        clearInterval(progressPollInterval);
      }
    };
  }, [progressPollInterval]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (progressPollInterval) {
        clearInterval(progressPollInterval);
        setProgressPollInterval(null);
      }
      setSyncProgress(null);
      // Don't reset syncing state - keep it for when modal reopens
    }
  }, [isOpen, progressPollInterval]);

  // Check for active sync when modal opens (in case it was closed during sync)
  useEffect(() => {
    if (!isOpen || !baseId) return;
    
    let pollInterval: NodeJS.Timeout | null = null;
    let isMounted = true;
    
    const checkActiveSyncProgress = async () => {
      try {
        const progressResponse = await fetch(`/api/ghl/sync-progress?base_id=${baseId}`);
        const progressData = await progressResponse.json();
        
        if (!isMounted) return;
        
        if (progressData.success && progressData.progress) {
          // There's an active sync in progress - resume tracking
          setSyncProgress(progressData.progress);
          setSyncing(true);
          setCancelling(progressData.progress.cancelled || false);
          setSyncType(prev => prev || 'full'); // Keep existing or default to full
          
          // Start polling for progress updates
          pollInterval = setInterval(async () => {
            try {
              const response = await fetch(`/api/ghl/sync-progress?base_id=${baseId}`);
              const data = await response.json();
              
              if (!isMounted) return;
              
              if (data.success && data.progress) {
                setSyncProgress(data.progress);
                if (data.progress.cancelled) {
                  setCancelling(true);
                }
              } else if (data.success && !data.progress) {
                // Sync completed - clear everything
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
                setProgressPollInterval(null);
                setSyncProgress(null);
                setSyncing(false);
                setCancelling(false);
                setSyncType(null);
                // Reload integration to get updated last_sync_at
                loadIntegration();
              }
            } catch (error) {
              console.error('Failed to fetch progress:', error);
            }
          }, 2000);
          
          setProgressPollInterval(pollInterval);
        }
      } catch (error) {
        console.error('Failed to check active sync:', error);
      }
    };
    
    checkActiveSyncProgress();
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isOpen, baseId, loadIntegration]);

  // Convert flat fieldMapping to array format when integration loads
  useEffect(() => {
    if (integration?.field_mapping && fields.length > 0) {
      const mappings: FieldMappingItem[] = [];
      const ghlFieldKeys: string[] = [...STANDARD_GHL_FIELDS];

      // Get the GHL field names lookup (maps key -> display name)
      const ghlFieldNamesLookup = (integration as any).ghl_field_names || {};

      Object.entries(integration.field_mapping).forEach(([ghlFieldKey, appFieldId]) => {
        if (appFieldId) {
          // Find the app field name
          const appField = fields.find(f => f.id === appFieldId);
          const appFieldName = appField?.name || appFieldId;

          // Get the GHL field display name from lookup, or use the key if not found
          const ghlFieldDisplayName = ghlFieldNamesLookup[ghlFieldKey] || ghlFieldKey;

          mappings.push({
            id: crypto.randomUUID(),
            ghlFieldKey,
            ghlFieldName: ghlFieldDisplayName, // Use actual name from lookup
            appFieldId: appFieldId as string,
            appFieldName,
          });

          // Add to available GHL fields if not already there
          if (!ghlFieldKeys.includes(ghlFieldKey)) {
            ghlFieldKeys.push(ghlFieldKey);
          }
        }
      });

      setFieldMappings(mappings);
      setAvailableGHLFields(ghlFieldKeys);
    } else if (integration && fields.length > 0) {
      // No mapping yet - start with empty
      setFieldMappings([]);
    }
  }, [integration, fields]);

  const handleConnect = async () => {
    if (!accessToken.trim() || !locationId.trim()) {
      toast.error('Please enter both Access Token and Location ID');
      return;
    }

    setConnecting(true);
    try {
      const response = await fetch('/api/ghl/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseId,
          locationId: locationId.trim(),
          accessToken: accessToken.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect');
      }

      toast.success('GoHighLevel connected successfully!');
      await loadIntegration();
      if (onConnected) onConnected();
    } catch (error) {
      console.error('Failed to connect:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;

    const confirmed = confirm(
      'Are you sure you want to disconnect GoHighLevel? This will stop all syncing.'
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/ghl/disconnect?base_id=${baseId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disconnect');
      }

      setIntegration(null);
      setFieldMappings([]);
      setAccessToken("");
      setLocationId("");
      setTriggerWebhookSummary({ total: 0, active: 0 });
      setIsTriggerWebhooksModalOpen(false);
      toast.success('GoHighLevel disconnected successfully');
      if (onConnected) onConnected();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async (forceFullSync: boolean = false) => {
    if (!integration) return;

    setSyncing(true);
    setSyncProgress(null);
    
    // Determine sync type
    const isIncremental = !forceFullSync && integration.last_sync_at;
    const currentSyncType = isIncremental ? 'incremental' : 'full';
    setSyncType(currentSyncType);

    try {
      // For incremental sync, we don't need to get total count upfront
      // For full sync, optionally get total count for better progress display
      let totalContacts = 0;
      if (forceFullSync) {
        try {
          const countResponse = await fetch(`/api/ghl/contacts-count?base_id=${baseId}`);
          const countData = await countResponse.json();
          if (countResponse.ok) {
            totalContacts = countData.total || 0;
          }
        } catch (error) {
          console.warn('Failed to get contact count, proceeding without it');
        }
      }
      
      setSyncProgress({ current: 0, total: totalContacts, phase: 'fetching' });

      // Start sync (don't await - let it run in background)
      const syncPromise = fetch('/api/ghl/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseId,
          fullSync: forceFullSync, // Pass fullSync flag
        }),
      });

      // Poll for progress every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/ghl/sync-progress?base_id=${baseId}`);
          const progressData = await progressResponse.json();
          
          if (progressData.success && progressData.progress) {
            setSyncProgress(progressData.progress);
            // Update cancelling state based on server response
            if (progressData.progress.cancelled && !cancelling) {
              setCancelling(true);
            }
          } else if (progressData.success && !progressData.progress) {
            // Progress cleared - sync likely completed
            clearInterval(pollInterval);
            setProgressPollInterval(null);
          }
        } catch (error) {
          console.error('Failed to fetch progress:', error);
        }
      }, 2000); // Poll every 2 seconds

      setProgressPollInterval(pollInterval);

      // Wait for sync to complete
      const response = await syncPromise;
      const data = await response.json();

      // Clear polling interval
      clearInterval(pollInterval);
      setProgressPollInterval(null);

      if (!response.ok && !data.cancelled) {
        throw new Error(data.error || 'Failed to sync');
      }

      // Clear progress
      setSyncProgress(null);
      setSyncType(null);
      
      // Handle cancelled sync
      if (data.cancelled) {
        toast.warning(data.message || `Sync cancelled. ${data.created || 0} created, ${data.updated || 0} updated.`);
      } else {
        const syncTypeMessage = data.syncType === 'incremental' 
          ? ' (new/modified only)' 
          : ' (full sync)';
        toast.success(data.message || `Successfully synced ${data.total || 0} contacts!${syncTypeMessage}`);
      }
      await loadIntegration(); // Refresh to get updated last_sync_at
    } catch (error) {
      console.error('Failed to sync:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync contacts');
      
      // Clear progress on error
      setSyncProgress(null);
      setSyncType(null);
      if (progressPollInterval) {
        clearInterval(progressPollInterval);
        setProgressPollInterval(null);
      }
    } finally {
      setSyncing(false);
      setCancelling(false);
    }
  };

  const handleCancelSync = async () => {
    if (!syncing || cancelling) return;
    
    setCancelling(true);
    try {
      const response = await fetch(`/api/ghl/sync-progress?base_id=${baseId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.info('Cancellation requested. The sync will stop after the current batch.');
      } else {
        throw new Error('Failed to cancel sync');
      }
    } catch (error) {
      console.error('Failed to cancel sync:', error);
      toast.error('Failed to cancel sync');
      setCancelling(false);
    }
  };

  const handleMapAllFields = async () => {
    if (!integration) return;

    const confirmed = confirm(
      'This will:\n\n' +
      '1. Fetch ALL field information from your GHL contacts\n' +
      '2. Create new fields in your base for each GHL field\n' +
      '3. Automatically map all fields\n\n' +
      'Continue?'
    );
    if (!confirmed) return;

    setAutoMapping(true);
    try {
      const response = await fetch('/api/ghl/discover-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ baseId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to map fields');
      }

      // Show success message with details
      toast.success(`Mapped ${data.totalMapped} fields! (${data.createdFields?.length || 0} new fields created)`);

      // Reload integration and fields to show updated mapping
      await loadIntegration();
      await loadFields();
    } catch (error) {
      console.error('Failed to auto-map fields:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to map fields');
    } finally {
      setAutoMapping(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!integration) return;

    setSavingMapping(true);
    try {
      // Convert array to flat object
      const flatMapping: GHLFieldMapping = {};
      fieldMappings.forEach(mapping => {
        if (mapping.ghlFieldKey && mapping.appFieldId) {
          flatMapping[mapping.ghlFieldKey] = mapping.appFieldId;
        }
      });

      await GHLService.updateFieldMapping(integration.id, flatMapping);
      toast.success('Field mapping saved successfully');
    } catch (error) {
      console.error('Failed to save mapping:', error);
      toast.error('Failed to save field mapping');
    } finally {
      setSavingMapping(false);
    }
  };

  const handleSaveAutoSyncSettings = async () => {
    if (!integration) return;

    setSavingAutoSync(true);
    try {
      await GHLService.updateAutoSyncSettings(baseId, {
        auto_sync_enabled: autoSyncEnabled,
        auto_sync_interval_minutes: autoSyncInterval
      });
      toast.success('Auto-sync settings updated successfully');
      // Reload integration to get updated timestamps
      await loadIntegration();
    } catch (error) {
      console.error('Failed to save auto-sync settings:', error);
      toast.error('Failed to update auto-sync settings');
    } finally {
      setSavingAutoSync(false);
    }
  };

  const openTriggerWebhooksModal = () => setIsTriggerWebhooksModalOpen(true);
  const closeTriggerWebhooksModal = () => {
    setIsTriggerWebhooksModalOpen(false);
    void loadTriggerWebhookSummary();
  };

  const addFieldMapping = () => {
    setFieldMappings(prev => [
      ...prev,
      { 
        id: crypto.randomUUID(), 
        ghlFieldKey: '', 
        ghlFieldName: '',
        appFieldId: '', 
        appFieldName: '' 
      }
    ]);
  };

  const removeFieldMapping = (id: string) => {
    setFieldMappings(prev => prev.filter(m => m.id !== id));
  };

  const updateFieldMapping = (id: string, ghlFieldKey: string, appFieldId: string) => {
    const appField = fields.find(f => f.id === appFieldId);
    setFieldMappings(prev => prev.map(m => 
      m.id === id 
        ? { 
            ...m, 
            ghlFieldKey,
            ghlFieldName: ghlFieldKey,
            appFieldId,
            appFieldName: appField?.name || appFieldId
          } 
        : m
    ));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {integration ? 'GoHighLevel Settings' : 'Connect GoHighLevel'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-blue-600" />
            </div>
          ) : !integration ? (
            // Not connected - show connect UI with Private Integration Token
            <>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <LinkIcon className="text-blue-600 mt-1" size={20} />
                  <div>
                    <h3 className="font-medium text-gray-900">Sync Contacts from GoHighLevel</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Connect your GoHighLevel account to automatically sync contacts into this base.
                    </p>
                  </div>
                </div>

                {/* OAuth Sign In Option */}
                <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 mb-3">Easiest option: Sign in with GoHighLevel</p>
                  <a
                    href={`/api/ghl/auth?base_id=${baseId}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <LinkIcon size={16} />
                    Sign In with GoHighLevel
                  </a>
                </div>

                {/* Or Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-gray-500 font-medium">OR</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">How to get your credentials:</p>
                      <ol className="list-decimal list-inside space-y-1 text-blue-700">
                        <li>Go to GHL Settings → Private Integrations</li>
                        <li>Create a new Private Integration (or use existing) with permissions to read and write contacts and custom fields</li>
                        <li>Copy the Access Token</li>
                        <li>Your Location ID is in your GHL URL or Settings</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Key size={14} className="inline mr-1" />
                      Access Token (Private Integration Token)
                    </label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Starts with &quot;pit-&quot; for Private Integration Tokens
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin size={14} className="inline mr-1" />
                      Location ID
                    </label>
                    <input
                      type="text"
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      placeholder="e.g., ve9EPM428h8vShlRW1KT"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Found in your GHL URL after /location/ or in Settings → Business Info
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  disabled={connecting || !accessToken.trim() || !locationId.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {connecting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <LinkIcon size={16} />
                      Connect
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            // Connected - show settings
            <>
              {/* Connection Status */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-green-600" size={20} />
                    <div>
                      <p className="font-medium text-green-900">Connected to GoHighLevel</p>
                      <p className="text-sm text-green-700 mt-1">
                        Location ID: {integration.location_id}
                      </p>
                      <p className="text-sm text-green-700">
                        Authenticated via: {integration.access_token?.startsWith('pit') ? 'Private Integration Token (PIT)' : 'GHL Login'}
                      </p>
                      {integration.last_sync_at && (
                        <p className="text-sm text-green-700">
                          Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Sync Buttons */}
                  <div className="flex gap-2">
                    {integration.last_sync_at && (
                      <button
                        onClick={() => handleSyncNow(false)}
                        disabled={syncing}
                        className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 disabled:opacity-50 flex items-center gap-2"
                        title="Sync only new or modified contacts since last sync"
                      >
                        {syncing && syncType === 'incremental' ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={16} />
                            Sync New/Modified
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleSyncNow(true)}
                      disabled={syncing}
                      className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2"
                      title="Sync all contacts from GoHighLevel"
                    >
                      {syncing && syncType === 'full' ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Syncing All...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={16} />
                          Full Sync All Contacts
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Sync Progress Display */}
                {syncProgress && (
                  <div className={`mt-4 p-4 rounded-md ${cancelling ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className={`text-sm font-medium ${cancelling ? 'text-amber-900' : 'text-blue-900'}`}>
                          {cancelling 
                            ? 'Cancelling sync...' 
                            : syncProgress.phase === 'fetching' 
                              ? 'Fetching contacts...' 
                              : 'Syncing contacts...'}
                        </span>
                        {syncType && !cancelling && (
                          <span className="ml-2 text-xs text-blue-600">
                            ({syncType === 'incremental' ? 'New/Modified only' : 'Full sync'})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm ${cancelling ? 'text-amber-700' : 'text-blue-700'}`}>
                          {syncProgress.current.toLocaleString()} / {syncProgress.total > 0 ? syncProgress.total.toLocaleString() : '...'}
                        </span>
                        {!cancelling && (
                          <button
                            onClick={handleCancelSync}
                            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 flex items-center gap-1 transition-colors"
                            title="Cancel the sync"
                          >
                            <StopCircle size={14} />
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`w-full rounded-full h-2 ${cancelling ? 'bg-amber-200' : 'bg-blue-200'}`}>
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${cancelling ? 'bg-amber-500' : 'bg-blue-600'}`}
                        style={{
                          width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className={`text-xs mt-2 ${cancelling ? 'text-amber-600' : 'text-blue-600'}`}>
                      {cancelling 
                        ? 'Stopping after current batch completes...' 
                        : syncProgress.phase === 'fetching' 
                          ? syncType === 'incremental'
                            ? 'Retrieving new or modified contacts from GoHighLevel...'
                            : 'Retrieving all contacts from GoHighLevel...'
                          : 'Saving contacts to your base...'}
                    </p>
                  </div>
                )}
              </div>

              {/* Auto-Sync Settings */}
              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Auto-Sync Settings</h3>
                  <p className="text-sm text-gray-600">
                    Automatically sync new or modified contacts in the background while the base is open.
                  </p>
                </div>
                
                {/* Toggle Auto-Sync */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Enable auto-sync</label>
                  <button
                    type="button"
                    onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoSyncEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    aria-label="Toggle auto-sync"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Interval Selector */}
                {autoSyncEnabled && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 block">Sync interval</label>
                    <select
                      value={autoSyncInterval}
                      onChange={(e) => setAutoSyncInterval(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1}>Every 1 minute</option>
                      <option value={5}>Every 5 minutes</option>
                      <option value={15}>Every 15 minutes (recommended)</option>
                      <option value={30}>Every 30 minutes</option>
                      <option value={60}>Every 1 hour</option>
                    </select>
                    
                    {autoSyncInterval === 1 && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle size={14} />
                        1-minute sync may impact performance. Use only if critical.
                      </p>
                    )}
                  </div>
                )}

                {/* Last Auto-Sync Time */}
                {integration?.last_auto_sync_at && (
                  <div className="text-xs text-gray-500">
                    Last auto-sync: {new Date(integration.last_auto_sync_at).toLocaleString()}
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSaveAutoSyncSettings}
                  disabled={savingAutoSync}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {savingAutoSync ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Auto-Sync Settings'
                  )}
                </button>
              </div>

              {/* Sync Trigger Webhooks */}
              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Sync Trigger Webhooks</h3>
                  <p className="text-sm text-gray-600">
                    Manually trigger a contact sync from GoHighLevel using webhooks.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {triggerWebhookSummary.total > 0 ? (
                        loadingTriggerWebhooks
                          ? 'Loading trigger webhooks...'
                          : `${triggerWebhookSummary.active} active of ${triggerWebhookSummary.total} total`
                      ) : 'No trigger webhooks configured'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Each trigger will sync new contacts from GoHighLevel
                    </div>
                  </div>
                  <button
                    onClick={openTriggerWebhooksModal}
                    className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center gap-2"
                  >
                    <LinkIcon size={16} />
                    Manage Sync Triggers
                  </button>
                </div>
              </div>

              {/* Field Mapping */}
              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">Field Mapping</h3>
                    <p className="text-sm text-gray-600">
                      Map GoHighLevel contact fields to fields in your base.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleMapAllFields}
                      disabled={autoMapping}
                      className="px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1"
                      title="Auto-create fields and map all GHL contact fields"
                    >
                      {autoMapping ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Mapping...
                        </>
                      ) : (
                        <>
                          <Wand2 size={14} />
                          Map All Fields
                        </>
                      )}
                    </button>
                    <button
                      onClick={addFieldMapping}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Add Field
                    </button>
                  </div>
                </div>

                {/* Field Mapping Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_40px_1fr_40px] gap-2 p-3 bg-gray-100 border-b border-gray-200 font-medium text-sm text-gray-700">
                    <div>GHL Field</div>
                    <div></div>
                    <div>App Field</div>
                    <div></div>
                  </div>

                  {/* Mapping Rows */}
                  <div className="max-h-80 overflow-y-auto">
                    {fieldMappings.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <p>No field mappings configured.</p>
                        <p className="mt-2 text-sm">
                          Click <strong>&quot;Map All Fields&quot;</strong> to auto-create and map all GHL fields,
                          <br />or click <strong>&quot;Add Field&quot;</strong> to manually add mappings.
                        </p>
                      </div>
                    ) : (
                      fieldMappings.map((mapping) => (
                        <div 
                          key={mapping.id} 
                          className="grid grid-cols-[1fr_40px_1fr_40px] gap-2 p-3 border-b border-gray-100 items-center hover:bg-gray-50"
                        >
                          {/* GHL Field - show display name (not the key) */}
                          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-medium text-gray-800">
                            {mapping.ghlFieldName || mapping.ghlFieldKey || '(not set)'}
                          </div>

                          {/* Arrow */}
                          <div className="text-center text-gray-400 font-bold">→</div>

                          {/* App Field - show as text (read-only display) */}
                          <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-800">
                            {mapping.appFieldName || '(not set)'}
                          </div>

                          {/* Delete button */}
                          <button
                            onClick={() => removeFieldMapping(mapping.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove mapping"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Summary */}
                {fieldMappings.length > 0 && (
                  <div className="text-sm text-gray-600">
                    <strong>{fieldMappings.length}</strong> field mappings configured
                  </div>
                )}

                {/* Field mapping info */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-600">
                    <strong>Tip:</strong> Click &quot;Map All Fields&quot; to automatically discover all GHL fields and create matching fields in your base.
                    Contacts will sync to the masterlist table. The GHL Contact ID is automatically stored for deduplication.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                >
                  {loading ? 'Disconnecting...' : 'Disconnect'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
      {integration && (
        <ManageGHLTriggerWebhooksModal
          isOpen={isTriggerWebhooksModalOpen}
          onClose={closeTriggerWebhooksModal}
          baseId={baseId}
        />
      )}
    </>
  );
};
