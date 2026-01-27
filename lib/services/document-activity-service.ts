import { supabase } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';

export type DocumentActivityAction =
  | 'upload'
  | 'download'
  | 'view'
  | 'edit'
  | 'delete'
  | 'rename'
  | 'move'
  | 'folder_create'
  | 'folder_rename'
  | 'folder_delete'
  | 'signature_request'
  | 'signature_sent'
  | 'signature_viewed'
  | 'signature_signed'
  | 'signature_declined'
  | 'signature_completed'
  | 'template_create'
  | 'template_edit'
  | 'template_delete'
  | 'document_generate'
  | 'share_create'
  | 'share_revoke';

export type DocumentActivityLog = {
  id: string;
  base_id: string;
  table_id: string | null;
  record_id: string | null;
  user_id: string | null;
  action: DocumentActivityAction;
  document_path: string | null;
  folder_path: string | null;
  document_name: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // Joined user data
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type LogActivityParams = {
  baseId: string;
  tableId?: string | null;
  recordId?: string | null;
  action: DocumentActivityAction;
  documentPath?: string | null;
  folderPath?: string | null;
  documentName?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

// Action display configuration
export const ACTION_CONFIG: Record<DocumentActivityAction, { label: string; icon: string; color: string }> = {
  upload: { label: 'uploaded', icon: 'upload', color: 'text-green-600' },
  download: { label: 'downloaded', icon: 'download', color: 'text-blue-600' },
  view: { label: 'viewed', icon: 'eye', color: 'text-gray-600' },
  edit: { label: 'edited', icon: 'edit', color: 'text-orange-600' },
  delete: { label: 'deleted', icon: 'trash', color: 'text-red-600' },
  rename: { label: 'renamed', icon: 'edit-2', color: 'text-purple-600' },
  move: { label: 'moved', icon: 'move', color: 'text-indigo-600' },
  folder_create: { label: 'created folder', icon: 'folder-plus', color: 'text-green-600' },
  folder_rename: { label: 'renamed folder', icon: 'folder', color: 'text-purple-600' },
  folder_delete: { label: 'deleted folder', icon: 'folder-minus', color: 'text-red-600' },
  signature_request: { label: 'created signature request', icon: 'pen-tool', color: 'text-blue-600' },
  signature_sent: { label: 'sent for signature', icon: 'send', color: 'text-blue-600' },
  signature_viewed: { label: 'viewed signature request', icon: 'eye', color: 'text-gray-600' },
  signature_signed: { label: 'signed', icon: 'check', color: 'text-green-600' },
  signature_declined: { label: 'declined signature', icon: 'x', color: 'text-red-600' },
  signature_completed: { label: 'completed signing', icon: 'check-circle', color: 'text-green-600' },
  template_create: { label: 'created template', icon: 'file-plus', color: 'text-green-600' },
  template_edit: { label: 'edited template', icon: 'file-text', color: 'text-orange-600' },
  template_delete: { label: 'deleted template', icon: 'file-minus', color: 'text-red-600' },
  document_generate: { label: 'generated document', icon: 'file', color: 'text-blue-600' },
  share_create: { label: 'shared', icon: 'share-2', color: 'text-purple-600' },
  share_revoke: { label: 'revoked share', icon: 'lock', color: 'text-red-600' },
};

export class DocumentActivityService {
  /**
   * Log a document activity
   */
  static async logActivity(params: LogActivityParams): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Verify user exists in profiles table
      let userId: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();
        
        userId = profile?.id || null;
      }
      
      const { error } = await supabase
        .from('document_activity_log')
        .insert({
          base_id: params.baseId,
          table_id: params.tableId || null,
          record_id: params.recordId || null,
          user_id: userId,
          action: params.action,
          document_path: params.documentPath || null,
          folder_path: params.folderPath || null,
          document_name: params.documentName || null,
          metadata: params.metadata || {},
          ip_address: params.ipAddress || null,
          user_agent: params.userAgent || null,
        });

      if (error) {
        console.error('Failed to log document activity:', error);
        // Don't throw - activity logging should not break main functionality
      }
    } catch (err) {
      console.error('Error logging document activity:', err);
      // Silently fail - activity logging is secondary
    }
  }

  /**
   * Log activity with service role (for server-side operations)
   */
  static async logActivityWithServiceRole(
    params: LogActivityParams,
    userId?: string
  ): Promise<void> {
    try {
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error } = await serviceClient
        .from('document_activity_log')
        .insert({
          base_id: params.baseId,
          table_id: params.tableId || null,
          record_id: params.recordId || null,
          user_id: userId || null,
          action: params.action,
          document_path: params.documentPath || null,
          folder_path: params.folderPath || null,
          document_name: params.documentName || null,
          metadata: params.metadata || {},
          ip_address: params.ipAddress || null,
          user_agent: params.userAgent || null,
        });

      if (error) {
        console.error('Failed to log document activity (service role):', error);
      }
    } catch (err) {
      console.error('Error logging document activity (service role):', err);
    }
  }

  /**
   * Get activity logs for a base/table/record
   */
  static async getActivityLogs(
    baseId: string,
    tableId?: string | null,
    options: {
      limit?: number;
      before?: string;
      actions?: DocumentActivityAction[];
      recordId?: string | null; // Filter by specific record
    } = {}
  ): Promise<DocumentActivityLog[]> {
    const { limit = 50, before, actions, recordId } = options;

    let query = supabase
      .from('document_activity_log')
      .select(`
        id,
        base_id,
        table_id,
        record_id,
        user_id,
        action,
        document_path,
        folder_path,
        document_name,
        metadata,
        ip_address,
        user_agent,
        created_at
      `)
      .eq('base_id', baseId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tableId) {
      query = query.eq('table_id', tableId);
    }

    // Filter by record if provided
    if (recordId) {
      query = query.eq('record_id', recordId);
    }

    if (before) {
      query = query.lt('created_at', before);
    }

    if (actions && actions.length > 0) {
      query = query.in('action', actions);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch activity logs:', error);
      throw error;
    }

    const logs = (data || []) as DocumentActivityLog[];

    // Fetch user details for logs
    const userIds = Array.from(
      new Set(logs.map((l) => l.user_id).filter((id): id is string => Boolean(id)))
    );

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const userMap = new Map(
        (users || []).map((u) => [u.id, u])
      );

      return logs.map((log) => ({
        ...log,
        user: log.user_id ? userMap.get(log.user_id) || null : null,
      }));
    }

    return logs.map((log) => ({ ...log, user: null }));
  }

  /**
   * Subscribe to real-time activity updates
   */
  static subscribeToActivity(
    baseId: string,
    tableId: string | null,
    onNewActivity: (activity: DocumentActivityLog) => void,
    recordId?: string | null // Subscribe to record-specific activities
  ) {
    // Build filter string for realtime subscription
    let filterString = `base_id=eq.${baseId}`;
    if (tableId) {
      filterString += `&table_id=eq.${tableId}`;
    }
    if (recordId) {
      filterString += `&record_id=eq.${recordId}`;
    }

    const channel = supabase
      .channel(`document_activity:${baseId}:${tableId || 'all'}:${recordId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'document_activity_log',
          filter: filterString,
        },
        async (payload) => {
          const newActivity = payload.new as DocumentActivityLog;
          
          // Fetch user details for the new activity
          if (newActivity.user_id) {
            const { data: user } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', newActivity.user_id)
              .single();
            
            newActivity.user = user || null;
          }
          
          onNewActivity(newActivity);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Get action display configuration
   */
  static getActionConfig(action: DocumentActivityAction) {
    return ACTION_CONFIG[action] || { label: action, icon: 'activity', color: 'text-gray-600' };
  }

  /**
   * Format activity message
   */
  static formatActivityMessage(activity: DocumentActivityLog): string {
    const config = this.getActionConfig(activity.action);
    const userName = activity.user?.full_name || 'Someone';
    const targetName = activity.document_name || activity.folder_path || 'a document';
    
    return `${userName} ${config.label} ${targetName}`;
  }

  /**
   * Format relative time
   */
  static formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    
    return date.toLocaleDateString();
  }
}
