import { supabase } from '../supabaseClient';
import type { Webhook, WebhookLog } from '../types/webhooks';

export class WebhookService {
  static async getWebhooksByBaseId(baseId: string): Promise<Webhook[]> {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('base_id', baseId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async createWebhook(
    baseId: string,
    name: string,
    defaultTableId?: string
  ): Promise<Webhook> {
    const response = await fetch('/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseId, name, defaultTableId })
    });

    if (!response.ok) {
      throw new Error('Failed to create webhook');
    }

    return await response.json();
  }

  static async updateWebhook(
    webhookId: string,
    updates: Partial<Pick<Webhook, 'name' | 'is_enabled' | 'default_table_id'>>
  ): Promise<Webhook> {
    const response = await fetch('/api/webhooks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookId, ...updates })
    });

    if (!response.ok) {
      throw new Error('Failed to update webhook');
    }

    return await response.json();
  }

  static async deleteWebhook(webhookId: string): Promise<void> {
    const response = await fetch(`/api/webhooks?webhookId=${webhookId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete webhook');
    }
  }

  static async getWebhookLogs(webhookId: string, limit: number = 50): Promise<WebhookLog[]> {
    const { data, error } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static getWebhookUrl(secretToken: string): string {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api/webhooks/${secretToken}`;
  }
}

