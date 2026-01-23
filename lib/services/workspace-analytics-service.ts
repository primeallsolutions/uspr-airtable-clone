import { supabase } from '../supabaseClient';
import type { WorkspaceAnalyticsCard } from '../types/analytics';

export class WorkspaceAnalyticsService {
  static async getCards(workspaceId: string): Promise<WorkspaceAnalyticsCard[]> {
    const { data, error } = await supabase
      .from('workspace_analytics_cards')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as WorkspaceAnalyticsCard[];
  }

  static async createCard(payload: Omit<WorkspaceAnalyticsCard, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('workspace_analytics_cards')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as WorkspaceAnalyticsCard;
  }

  static async updateCard(cardId: string, updates: Partial<WorkspaceAnalyticsCard>) {
    const { data, error } = await supabase
      .from('workspace_analytics_cards')
      .update(updates)
      .eq('id', cardId)
      .select()
      .single();

    if (error) throw error;
    return data as WorkspaceAnalyticsCard;
  }

  static async deleteCard(cardId: string): Promise<void> {
    const { error } = await supabase
      .from('workspace_analytics_cards')
      .delete()
      .eq('id', cardId);

    if (error) throw error;
  }
}
