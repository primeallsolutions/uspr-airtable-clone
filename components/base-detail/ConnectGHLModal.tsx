"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle, Loader2, Link as LinkIcon, Key, MapPin, RefreshCw, Plus, Trash2, Wand2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { GHLService } from "@/lib/services/ghl-service";
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

  // Form state for Private Integration Token
  const [accessToken, setAccessToken] = useState("");
  const [locationId, setLocationId] = useState("");
  
  // Sync progress state
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; phase: 'fetching' | 'syncing' } | null>(null);
  const [progressPollInterval, setProgressPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [syncType, setSyncType] = useState<'incremental' | 'full' | null>(null); // Track current sync type

  // Field mapping state - shows paired GHL field + App field
  const [fieldMappings, setFieldMappings] = useState<FieldMappingItem[]>([]);

  // All available GHL fields (discovered from mapping)
  const [availableGHLFields, setAvailableGHLFields] = useState<string[]>(STANDARD_GHL_FIELDS);

  // Load integration status and fields
  useEffect(() => {
    if (isOpen && baseId) {
      loadIntegration();
      loadFields();
    }
  }, [isOpen, baseId, tableId]);

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
    }
  }, [isOpen, progressPollInterval]);

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

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const integrationData = await GHLService.getIntegrationByBaseId(baseId);
      if (integrationData) {
        setIntegration(integrationData);
      } else {
        setIntegration(null);
      }
    } catch (error) {
      console.error('Failed to load integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFields = async () => {
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
  };

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

      toast.success('Go High Level connected successfully!');
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
      'Are you sure you want to disconnect Go High Level? This will stop all syncing.'
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
      toast.success('Go High Level disconnected successfully');
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

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync');
      }

      // Clear progress
      setSyncProgress(null);
      setSyncType(null);
      
      const syncTypeMessage = data.syncType === 'incremental' 
        ? ' (new/modified only)' 
        : ' (full sync)';
      toast.success(data.message || `Successfully synced ${data.total || 0} contacts!${syncTypeMessage}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {integration ? 'Go High Level Settings' : 'Connect Go High Level'}
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
                    <h3 className="font-medium text-gray-900">Sync Contacts from Go High Level</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Connect your Go High Level Private Integration to automatically sync contacts into this base.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">How to get your credentials:</p>
                      <ol className="list-decimal list-inside space-y-1 text-blue-700">
                        <li>Go to GHL Settings → Integrations → Private Integrations</li>
                        <li>Create a new Private Integration (or use existing)</li>
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
                      Starts with "pit-" for Private Integration Tokens
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
                      <p className="font-medium text-green-900">Connected to Go High Level</p>
                      <p className="text-sm text-green-700 mt-1">
                        Location ID: {integration.location_id}
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
                      title="Sync all contacts from Go High Level"
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
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-blue-900">
                          {syncProgress.phase === 'fetching' ? 'Fetching contacts...' : 'Syncing contacts...'}
                        </span>
                        {syncType && (
                          <span className="ml-2 text-xs text-blue-600">
                            ({syncType === 'incremental' ? 'New/Modified only' : 'Full sync'})
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-blue-700">
                        {syncProgress.current.toLocaleString()} / {syncProgress.total > 0 ? syncProgress.total.toLocaleString() : '...'}
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      {syncProgress.phase === 'fetching' 
                        ? syncType === 'incremental'
                          ? 'Retrieving new or modified contacts from Go High Level...'
                          : 'Retrieving all contacts from Go High Level...'
                        : 'Saving contacts to your base...'}
                    </p>
                  </div>
                )}
              </div>

              {/* Field Mapping */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">Field Mapping</h3>
                    <p className="text-sm text-gray-600">
                      Map Go High Level contact fields to fields in your base.
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
                          Click <strong>"Map All Fields"</strong> to auto-create and map all GHL fields,
                          <br />or click <strong>"Add Field"</strong> to manually add mappings.
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
                    <strong>Tip:</strong> Click "Map All Fields" to automatically discover all GHL fields and create matching fields in your base.
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
  );
};
