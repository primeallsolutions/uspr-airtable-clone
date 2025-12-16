import { supabase } from '../supabaseClient';

export type RoleType = 'member' | 'admin' | 'owner';

export type WorkspaceMember = {
  membership_id: string;
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  role: RoleType;
  created_at: string;
};

export type BaseMember = {
  membership_id: string;
  user_id: string;
  email?: string | null;
  role: RoleType;
  created_at: string;
};

export type Invite = {
  id: string;
  email: string;
  invited_by: string;
  workspace_id?: string | null;
  base_id?: string | null;
  role: RoleType;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
};

export class MembershipService {
  // Workspace membership
  static async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await supabase
      .from('workspace_memberships')
      .select('id, user_id, role, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const memberships = (data ?? []).map((m: { id: string; user_id: string; role: string; created_at: string }) => ({
      membership_id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
    })) as WorkspaceMember[];

    // Fetch profile names in one batch for all user_ids
    const userIds = Array.from(new Set(memberships.map(m => m.user_id)));
    if (userIds.length === 0) return memberships;

    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    if (pErr) {
      // Non-fatal: return without names
      console.warn('Failed to load profile names for workspace members:', pErr);
      return memberships;
    }
    const idToName = new Map<string, string | null>((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? null]));
    return memberships.map(m => ({ ...m, full_name: idToName.get(m.user_id) ?? null }));
  }

  static async addWorkspaceMember(workspaceId: string, userId: string, role: RoleType = 'member'): Promise<void> {
    const { error } = await supabase
      .from('workspace_memberships')
      .insert({ workspace_id: workspaceId, user_id: userId, role });
    if (error) throw error;
  }

  static async updateWorkspaceMemberRole(membershipId: string, role: RoleType): Promise<void> {
    const { error } = await supabase
      .from('workspace_memberships')
      .update({ role })
      .eq('id', membershipId);
    if (error) throw error;
  }

  static async removeWorkspaceMember(membershipId: string): Promise<void> {
    const { error } = await supabase
      .from('workspace_memberships')
      .delete()
      .eq('id', membershipId);
    if (error) throw error;
  }

  // Base membership
  static async listBaseMembers(baseId: string): Promise<BaseMember[]> {
    const { data, error } = await supabase
      .from('base_memberships')
      .select('id, user_id, role, created_at')
      .eq('base_id', baseId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((m: { id: string; user_id: string; role: string; created_at: string }) => ({
      membership_id: m.id,
      user_id: m.user_id,
      role: m.role as RoleType,
      created_at: m.created_at,
    }));
  }

  static async addBaseMember(baseId: string, userId: string, role: RoleType = 'member'): Promise<void> {
    const { error } = await supabase
      .from('base_memberships')
      .insert({ base_id: baseId, user_id: userId, role });
    if (error) throw error;
  }

  static async updateBaseMemberRole(membershipId: string, role: RoleType): Promise<void> {
    const { error } = await supabase
      .from('base_memberships')
      .update({ role })
      .eq('id', membershipId);
    if (error) throw error;
  }

  static async removeBaseMember(membershipId: string): Promise<void> {
    const { error } = await supabase
      .from('base_memberships')
      .delete()
      .eq('id', membershipId);
    if (error) throw error;
  }

  // Invites
  static async createInvite(params: { email: string; role: RoleType; workspaceId?: string; baseId?: string; token: string; redirectTo?: string; }): Promise<Invite> {
    const payload: {
      email: string;
      role: RoleType;
      token: string;
      workspace_id: string | null;
      base_id: string | null;
    } = {
      email: params.email,
      role: params.role,
      token: params.token,
      workspace_id: params.workspaceId ?? null,
      base_id: params.baseId ?? null,
    };
    const { data, error } = await supabase
      .from('invites')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;

    // Fire-and-forget custom email via API route (uses Resend server-side)
    try {
      await fetch('/api/invites/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          token: params.token,
          role: params.role,
          workspaceId: params.workspaceId ?? null,
          baseId: params.baseId ?? null,
        }),
      });
    } catch (e) {
      // Non-fatal: invite row exists; caller can still copy the link manually
      console.warn('Failed to trigger invite email via Resend:', e);
    }
    return data as Invite;
  }

  static async listMyInvites(): Promise<Invite[]> {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString());
    if (error) throw error;
    return (data ?? []) as Invite[];
  }

  static async acceptInvite(token: string, currentUserId: string, currentUserEmail?: string | null): Promise<{ redirectPath: string }> {
    // Read the invite by token
    const { data: invite, error: fetchError } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .single();
    if (fetchError) throw fetchError;
    if (!invite) throw new Error('Invite not found');
    if (invite.status !== 'pending') throw new Error('Invite is not pending');
    if (new Date(invite.expires_at) < new Date()) throw new Error('Invite expired');
    if (currentUserEmail && invite.email && invite.email.toLowerCase() !== currentUserEmail.toLowerCase()) {
      throw new Error('Invite email does not match current user');
    }

    // Create membership based on scope (idempotent if already a member)
    if (invite.workspace_id) {
      const { data: existing, error: fetchMemberErr } = await supabase
        .from('workspace_memberships')
        .select('id')
        .eq('workspace_id', invite.workspace_id)
        .eq('user_id', currentUserId)
        .limit(1);
      if (fetchMemberErr) throw fetchMemberErr;
      if (!existing || existing.length === 0) {
        const { error } = await supabase
          .from('workspace_memberships')
          .insert({ workspace_id: invite.workspace_id, user_id: currentUserId, role: invite.role });
        if (error && error.code !== '23505' /* unique_violation */) throw error;
      }
    } else if (invite.base_id) {
      const { data: existing, error: fetchMemberErr } = await supabase
        .from('base_memberships')
        .select('id')
        .eq('base_id', invite.base_id)
        .eq('user_id', currentUserId)
        .limit(1);
      if (fetchMemberErr) throw fetchMemberErr;
      if (!existing || existing.length === 0) {
        const { error } = await supabase
          .from('base_memberships')
          .insert({ base_id: invite.base_id, user_id: currentUserId, role: invite.role });
        if (error && error.code !== '23505') throw error;
      }
    } else {
      throw new Error('Invite scope is invalid');
    }

    // Mark invite as accepted
    const { error: updateError } = await supabase
      .from('invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);
    if (updateError) throw updateError;

    const redirectPath = invite.workspace_id
      ? `/workspaces/${invite.workspace_id}`
      : invite.base_id
        ? `/bases/${invite.base_id}`
        : '/dashboard';

    return { redirectPath };
  }

  static async revokeInvite(inviteId: string): Promise<void> {
    const { error } = await supabase
      .from('invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId);
    if (error) throw error;
  }
}
