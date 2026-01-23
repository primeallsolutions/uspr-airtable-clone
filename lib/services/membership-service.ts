import { supabase } from '../supabaseClient';
import { AuditLogService } from './audit-log-service';

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

// Helper to check if current user has admin/owner access to a workspace
async function checkWorkspaceAdminAccess(workspaceId: string): Promise<{ hasAccess: boolean; userId: string | null; userRole: RoleType | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return { hasAccess: false, userId: null, userRole: null };
  }

  // Check if user is workspace owner
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner')
    .eq('id', workspaceId)
    .single();

  if (workspace?.owner === userId) {
    return { hasAccess: true, userId, userRole: 'owner' };
  }

  // Check workspace membership
  const { data: membership } = await supabase
    .from('workspace_memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  const role = membership?.role as RoleType | null;
  const hasAccess = role === 'owner' || role === 'admin';
  return { hasAccess, userId, userRole: role };
}

// Helper to check if current user has admin/owner access to a base
async function checkBaseAdminAccess(baseId: string): Promise<{ hasAccess: boolean; userId: string | null; userRole: RoleType | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return { hasAccess: false, userId: null, userRole: null };
  }

  // Check if user is base owner
  const { data: base } = await supabase
    .from('bases')
    .select('owner, workspace_id')
    .eq('id', baseId)
    .single();

  if (base?.owner === userId) {
    return { hasAccess: true, userId, userRole: 'owner' };
  }

  // Check base membership
  const { data: baseMembership } = await supabase
    .from('base_memberships')
    .select('role')
    .eq('base_id', baseId)
    .eq('user_id', userId)
    .maybeSingle();

  if (baseMembership?.role === 'owner' || baseMembership?.role === 'admin') {
    return { hasAccess: true, userId, userRole: baseMembership.role as RoleType };
  }

  // Inherit from workspace if base belongs to a workspace
  if (base?.workspace_id) {
    const wsAccess = await checkWorkspaceAdminAccess(base.workspace_id);
    return wsAccess;
  }

  return { hasAccess: false, userId, userRole: baseMembership?.role as RoleType | null };
}

export class MembershipService {
  // Workspace membership
  static async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const [membershipResp, workspaceResp] = await Promise.all([
      supabase
        .from('workspace_memberships')
        .select('id, user_id, role, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('workspaces')
        .select('owner, created_at')
        .eq('id', workspaceId)
        .single(),
    ]);

    if (membershipResp.error) throw membershipResp.error;

    const memberships = (membershipResp.data ?? []).map((m: { id: string; user_id: string; role: string; created_at: string }) => ({
      membership_id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
    })) as WorkspaceMember[];

    const ownerId = (workspaceResp.data as { owner?: string | null; created_at?: string })?.owner ?? null;
    const ownerCreatedAt = (workspaceResp.data as { owner?: string | null; created_at?: string })?.created_at ?? new Date().toISOString();

    let combinedMemberships = memberships;
    if (ownerId) {
      const ownerIndex = memberships.findIndex(m => m.user_id === ownerId);
      if (ownerIndex >= 0) {
        combinedMemberships = memberships.map((m, idx) => idx === ownerIndex ? { ...m, role: 'owner' } : m);
      } else {
        combinedMemberships = [
          {
            membership_id: `owner-${workspaceId}`,
            user_id: ownerId,
            role: 'owner',
            created_at: ownerCreatedAt,
          },
          ...memberships,
        ];
      }
    }

    // Fetch profile names in one batch for all user_ids
    const userIds = Array.from(new Set(combinedMemberships.map(m => m.user_id)));
    if (userIds.length === 0) return combinedMemberships;

    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    if (pErr) {
      // Non-fatal: return without names
      console.warn('Failed to load profile names for workspace members:', pErr);
      return combinedMemberships;
    }
    const idToProfile = new Map<string, { full_name: string | null; email?: string | null }>(
      (profiles ?? []).map((p: { id: string; full_name: string | null; email?: string | null }) => [
        p.id,
        { full_name: p.full_name ?? null, email: p.email ?? null },
      ])
    );
    return combinedMemberships.map(m => {
      const profile = idToProfile.get(m.user_id);
      return { ...m, full_name: profile?.full_name ?? null, email: profile?.email ?? null };
    });
  }

  static async addWorkspaceMember(workspaceId: string, userId: string, role: RoleType = 'member'): Promise<void> {
    // Verify caller has admin/owner access
    const { hasAccess } = await checkWorkspaceAdminAccess(workspaceId);
    if (!hasAccess) {
      throw new Error('You do not have permission to add members to this workspace. Only owners and admins can manage members.');
    }

    const { data, error } = await supabase
      .from('workspace_memberships')
      .insert({ workspace_id: workspaceId, user_id: userId, role })
      .select('id')
      .single();
    if (error) throw error;

    // Log member addition
    await AuditLogService.log({
      action: 'create',
      entity_type: 'member',
      entity_id: data.id,
      scope_type: 'workspace',
      scope_id: workspaceId,
      metadata: { user_id: userId, role },
    });
  }

  static async updateWorkspaceMemberRole(membershipId: string, role: RoleType): Promise<void> {
    // Get the membership to find the workspace
    const { data: membership, error: fetchError } = await supabase
      .from('workspace_memberships')
      .select('workspace_id, user_id, role')
      .eq('id', membershipId)
      .single();
    if (fetchError) throw fetchError;
    if (!membership) throw new Error('Membership not found');

    const oldRole = membership.role;

    // Verify caller has admin/owner access
    const { hasAccess, userId: currentUserId } = await checkWorkspaceAdminAccess(membership.workspace_id);
    if (!hasAccess) {
      throw new Error('You do not have permission to change member roles. Only owners and admins can manage members.');
    }

    // Prevent users from modifying their own role (to prevent privilege escalation)
    if (membership.user_id === currentUserId) {
      throw new Error('You cannot change your own role.');
    }

    const { error } = await supabase
      .from('workspace_memberships')
      .update({ role })
      .eq('id', membershipId);
    if (error) throw error;

    // Log role change
    await AuditLogService.log({
      action: 'update',
      entity_type: 'member',
      entity_id: membershipId,
      scope_type: 'workspace',
      scope_id: membership.workspace_id,
      metadata: { user_id: membership.user_id, old_role: oldRole, new_role: role },
    });
  }

  static async removeWorkspaceMember(membershipId: string): Promise<void> {
    // Get the membership to find the workspace
    const { data: membership, error: fetchError } = await supabase
      .from('workspace_memberships')
      .select('workspace_id, user_id')
      .eq('id', membershipId)
      .single();
    if (fetchError) throw fetchError;
    if (!membership) throw new Error('Membership not found');

    // Verify caller has admin/owner access
    const { hasAccess, userId: currentUserId } = await checkWorkspaceAdminAccess(membership.workspace_id);
    if (!hasAccess) {
      throw new Error('You do not have permission to remove members. Only owners and admins can manage members.');
    }

    // Prevent users from removing themselves (they should use "Leave workspace" instead)
    if (membership.user_id === currentUserId) {
      throw new Error('You cannot remove yourself from the workspace.');
    }

    const workspaceId = membership.workspace_id;
    const userId = membership.user_id;

    const { error } = await supabase
      .from('workspace_memberships')
      .delete()
      .eq('id', membershipId);
    if (error) throw error;

    // Log member removal
    await AuditLogService.log({
      action: 'delete',
      entity_type: 'member',
      entity_id: membershipId,
      scope_type: 'workspace',
      scope_id: workspaceId,
      metadata: { user_id: userId },
    });
  }

  static async leaveWorkspace(workspaceId: string): Promise<void> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get user's membership in this workspace
    const { data: membership, error: fetchError } = await supabase
      .from('workspace_memberships')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !membership) {
      throw new Error('You are not a member of this workspace');
    }

    // Prevent owners from leaving (they should delete the workspace or transfer ownership)
    if (membership.role === 'owner') {
      throw new Error('Workspace owners cannot leave. Please delete the workspace or transfer ownership first.');
    }

    // Remove the membership
    const { error: deleteError } = await supabase
      .from('workspace_memberships')
      .delete()
      .eq('id', membership.id);

    if (deleteError) throw deleteError;

    // Log the leave action
    await AuditLogService.log({
      action: 'delete',
      entity_type: 'member',
      entity_id: membership.id,
      scope_type: 'workspace',
      scope_id: workspaceId,
      metadata: { user_id: user.id, action_type: 'leave' },
    });
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
    // Verify caller has admin/owner access
    const { hasAccess } = await checkBaseAdminAccess(baseId);
    if (!hasAccess) {
      throw new Error('You do not have permission to add members to this base. Only owners and admins can manage members.');
    }

    const { error } = await supabase
      .from('base_memberships')
      .insert({ base_id: baseId, user_id: userId, role });
    if (error) throw error;
  }

  static async updateBaseMemberRole(membershipId: string, role: RoleType): Promise<void> {
    // Get the membership to find the base
    const { data: membership, error: fetchError } = await supabase
      .from('base_memberships')
      .select('base_id, user_id')
      .eq('id', membershipId)
      .single();
    if (fetchError) throw fetchError;
    if (!membership) throw new Error('Membership not found');

    // Verify caller has admin/owner access
    const { hasAccess, userId: currentUserId } = await checkBaseAdminAccess(membership.base_id);
    if (!hasAccess) {
      throw new Error('You do not have permission to change member roles. Only owners and admins can manage members.');
    }

    // Prevent users from modifying their own role (to prevent privilege escalation)
    if (membership.user_id === currentUserId) {
      throw new Error('You cannot change your own role.');
    }

    const { error } = await supabase
      .from('base_memberships')
      .update({ role })
      .eq('id', membershipId);
    if (error) throw error;
  }

  static async removeBaseMember(membershipId: string): Promise<void> {
    // Get the membership to find the base
    const { data: membership, error: fetchError } = await supabase
      .from('base_memberships')
      .select('base_id, user_id')
      .eq('id', membershipId)
      .single();
    if (fetchError) throw fetchError;
    if (!membership) throw new Error('Membership not found');

    // Verify caller has admin/owner access
    const { hasAccess, userId: currentUserId } = await checkBaseAdminAccess(membership.base_id);
    if (!hasAccess) {
      throw new Error('You do not have permission to remove members. Only owners and admins can manage members.');
    }

    // Prevent users from removing themselves (they should use "Leave base" instead)
    if (membership.user_id === currentUserId) {
      throw new Error('You cannot remove yourself from the base.');
    }

    const { error } = await supabase
      .from('base_memberships')
      .delete()
      .eq('id', membershipId);
    if (error) throw error;
  }

  // Invites
  static async createInvite(params: { email: string; role: RoleType; workspaceId?: string; baseId?: string; token: string; redirectTo?: string; }): Promise<Invite> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Prevent self-invitation (case-insensitive)
    if (params.email.trim().toLowerCase() === user.email?.toLowerCase()) {
      const scopeType = params.workspaceId ? 'workspace' : 'base';
      throw new Error(`You cannot invite yourself to this ${scopeType}. You are already a member.`);
    }

    // Verify caller has admin/owner access to the workspace or base
    if (params.workspaceId) {
      const { hasAccess } = await checkWorkspaceAdminAccess(params.workspaceId);
      if (!hasAccess) {
        throw new Error('You do not have permission to invite members to this workspace. Only owners and admins can send invites.');
      }
    } else if (params.baseId) {
      const { hasAccess } = await checkBaseAdminAccess(params.baseId);
      if (!hasAccess) {
        throw new Error('You do not have permission to invite members to this base. Only owners and admins can send invites.');
      }
    } else {
      throw new Error('Invite must specify either a workspace or base.');
    }

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

    // Log invite creation
    const scopeType = params.workspaceId ? 'workspace' : 'base';
    const scopeId = params.workspaceId ?? params.baseId!;
    await AuditLogService.log({
      action: 'create',
      entity_type: 'member',
      entity_id: data.id,
      scope_type: scopeType,
      scope_id: scopeId,
      metadata: { email: params.email, role: params.role, type: 'invite' },
    });

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

  static async acceptInvite(
    token: string,
    currentUserId: string,
    currentUserEmail?: string | null
  ): Promise<{ redirectPath: string; workspaceId?: string | null; baseId?: string | null }> {
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

    // Ensure a profile row exists so FK constraints on memberships do not fail
    const upsertProfile = async (payload: Record<string, unknown>) => supabase
      .from('profiles')
      .upsert(payload);

    const { error: profileErr } = await upsertProfile({
      id: currentUserId,
      full_name: currentUserEmail ?? null,
      email: currentUserEmail ?? null,
    });

    if (profileErr) {
      // Fallback for environments where profiles.email does not exist
      if ((profileErr as { code?: string })?.code === '42703') {
        const { error: fallbackErr } = await upsertProfile({
          id: currentUserId,
          full_name: currentUserEmail ?? null,
        });
        if (fallbackErr) throw fallbackErr;
      } else {
        throw profileErr;
      }
    }
    try {
      await supabase
        .from('notification_preferences')
        .upsert({ user_id: currentUserId });
    } catch {
      // Non-fatal: preferences can be set later.
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

    // Resolve workspace to land on after acceptance
    let workspaceId: string | null = invite.workspace_id ?? null;
    if (!workspaceId && invite.base_id) {
      const { data: baseRow, error: baseErr } = await supabase
        .from('bases')
        .select('workspace_id')
        .eq('id', invite.base_id)
        .single();
      if (baseErr) throw baseErr;
      workspaceId = baseRow?.workspace_id ?? null;
      if (!workspaceId) {
        throw new Error('Workspace not found for invited base');
      }
    }

    // Mark invite as accepted
    const { error: updateError } = await supabase
      .from('invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);
    if (updateError) throw updateError;

    const redirectPath = workspaceId
      ? `/dashboard?workspaceId=${workspaceId}`
      : '/dashboard';

    return { redirectPath, workspaceId, baseId: invite.base_id ?? null };
  }

  static async revokeInvite(inviteId: string): Promise<void> {
    const { error } = await supabase
      .from('invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId);
    if (error) throw error;
  }
}
