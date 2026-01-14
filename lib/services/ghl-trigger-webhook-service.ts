import { supabase } from '../supabaseClient';
import type { GHLSyncTriggerWebhook, WebhookLog } from '../types/webhooks';

export class GHLTriggerWebhookService {
  static async getTriggerWebhooksByBaseId(baseId: string): Promise<GHLSyncTriggerWebhook[]> {
    const { data, error } = await supabase
      .from('ghl_sync_trigger_webhooks')
      .select('*')
      .eq('base_id', baseId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async createTriggerWebhook(
    baseId: string,
    name: string
  ): Promise<GHLSyncTriggerWebhook> {
    const response = await fetch('/api/ghl/trigger-webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseId, name })
    });

    if (!response.ok) {
      throw new Error('Failed to create trigger webhook');
    }

    return await response.json();
  }

  static async updateTriggerWebhook(
    webhookId: string,
    updates: Partial<Pick<GHLSyncTriggerWebhook, 'name' | 'is_enabled'>>
  ): Promise<GHLSyncTriggerWebhook> {
    const response = await fetch('/api/ghl/trigger-webhooks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookId, ...updates })
    });

    if (!response.ok) {
      throw new Error('Failed to update trigger webhook');
    }

    return await response.json();
  }

  static async deleteTriggerWebhook(webhookId: string): Promise<void> {
    const response = await fetch(`/api/ghl/trigger-webhooks?webhookId=${webhookId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete trigger webhook');
    }
  }

  static async getWebhookLogs(webhookId: string, limit: number = 50): Promise<WebhookLog[]> {
    const { data, error } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('ghl_sync_trigger_webhook_id', webhookId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static getWebhookUrl(secretToken: string): string {
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api/ghl/trigger-webhook/${secretToken}`;
  }
}
