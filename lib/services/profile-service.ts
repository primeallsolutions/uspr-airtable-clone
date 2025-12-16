import { supabase } from '../supabaseClient';

const PROFILE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET || 'Profile';
const PROFILE_FOLDER = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_FOLDER || 'Profile';

export type Profile = {
  id: string;
  full_name: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  phone: string | null;
  avatar_url?: string | null;
  timezone?: string | null;
  locale?: string | null;
  deactivated_at?: string | null;
  created_at: string;
  updated_at: string;
};

export class ProfileService {
  static async getMyProfile(): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, middle_name, last_name, phone, avatar_url, timezone, locale, deactivated_at, created_at, updated_at')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .maybeSingle();
    if (error) throw error;
    return (data as Profile) ?? null;
  }

  static async updateMyProfile(updates: { first_name?: string | null; middle_name?: string | null; last_name?: string | null; phone?: string | null; avatar_url?: string | null; timezone?: string | null; locale?: string | null }): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user?.id;
    if (!uid) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: uid, ...updates })
      .eq('id', uid);
    if (error) throw error;
  }

  static async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  static async uploadAvatar(file: File): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user?.id;
    if (!uid) throw new Error('Not authenticated');
    const path = `${PROFILE_FOLDER}/${uid}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from(PROFILE_BUCKET).upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
    const url = (pub as { publicUrl: string | undefined })?.publicUrl;
    if (!url) throw new Error('Could not resolve avatar URL');
    await this.updateMyProfile({ avatar_url: url });
    return url;
  }

  static async getMyPreferences(): Promise<{ email_product: boolean; email_activity: boolean } | null> {
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user?.id;
    if (!uid) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('email_product, email_activity')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    return (data as { email_product: boolean; email_activity: boolean } | null) ?? null;
  }

  static async upsertMyPreferences(updates: { email_product?: boolean; email_activity?: boolean }): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user?.id;
    if (!uid) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: uid, ...updates });
    if (error) throw error;
  }
}


