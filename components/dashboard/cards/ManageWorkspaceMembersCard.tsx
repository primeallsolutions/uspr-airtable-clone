import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { MembershipService, type RoleType } from "@/lib/services/membership-service";
import { useTimezone } from "@/lib/hooks/useTimezone";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useRole } from "@/lib/hooks/useRole";
import { useAuth } from "@/lib/hooks/useAuth";

interface ManageWorkspaceMembersCardProps {
  workspaceId: string;
}

type WorkspaceMemberRow = {
  membership_id: string;
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  role: RoleType;
  created_at: string;
};

export const ManageWorkspaceMembersCard = ({ workspaceId }: ManageWorkspaceMembersCardProps) => {
  const { timezone } = useTimezone();
  const { user } = useAuth();
  const { role: currentUserRole, loading: roleLoading } = useRole({ workspaceId });
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleType>("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Check if current user has permission to manage members (only owner/admin)
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  
  // Check if the invite email is the current user's email (case-insensitive)
  const isInvitingSelf = inviteEmail.trim().toLowerCase() === user?.email?.toLowerCase();

  const loadMembers = useMemo(() => async () => {
    if (!workspaceId || !canManageMembers) return;
    setLoading(true);
    setError(null);
    setOwnerId(null);
    try {
      const data = await MembershipService.listWorkspaceMembers(workspaceId);
      setMembers(data as WorkspaceMemberRow[]);
      const owner = (data as WorkspaceMemberRow[]).find(m => m.role === 'owner');
      setOwnerId(owner?.user_id ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, canManageMembers]);

  useEffect(() => {
    if (canManageMembers) {
      void loadMembers();
    }
  }, [loadMembers, canManageMembers]);

  const handleRoleChange = async (membershipId: string, role: RoleType) => {
    setError(null);
    try {
      const member = members.find(m => m.membership_id === membershipId);
      if (member && (member.role === 'owner' || (ownerId && member.user_id === ownerId))) {
        setError("Owner role cannot be changed.");
        return;
      }
      await MembershipService.updateWorkspaceMemberRole(membershipId, role);
      setMembers(prev => prev.map(m => m.membership_id === membershipId ? { ...m, role } : m));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update member role");
    }
  };

  const handleRemove = async (membershipId: string) => {
    setError(null);
    try {
      const member = members.find(m => m.membership_id === membershipId);
      if (member && (member.role === 'owner' || (ownerId && member.user_id === ownerId))) {
        setError("Owner cannot be removed from their workspace.");
        return;
      }
      await MembershipService.removeWorkspaceMember(membershipId);
      setMembers(prev => prev.filter(m => m.membership_id !== membershipId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    
    // Prevent inviting yourself
    if (isInvitingSelf) {
      setError("You cannot invite yourself. You are already a member of this workspace.");
      return;
    }
    
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const token = crypto.randomUUID();
      await MembershipService.createInvite({ email: inviteEmail.trim(), role: inviteRole, workspaceId, token });
      setSuccess("Invite created. Share the link with the recipient to accept.");
      setInviteEmail("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create invite");
    } finally {
      setInviting(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8">
        <div className="text-center">
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Block access if user doesn't have permission
  if (!canManageMembers) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Manage Workspace Members</h3>
        </div>
        <div className="px-6 py-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <p className="mb-2 font-medium text-gray-700">You do not have permission to manage workspace members.</p>
          <p className="text-sm text-gray-500">Only workspace owners and admins can access this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-4/5 rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-full border-b border-gray-200 px-6 py-4 transition-colors text-left ${isCollapsed ? 'rounded-lg' : ''} hover:bg-gray-50`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Manage Workspace Members</h3>
          <ChevronDown size={14} className={`text-gray-600 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
        </div>
      </button>

      {!isCollapsed && (
        <div className="space-y-4 px-6 py-4">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
            )}
            {success && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">{success}</div>
            )}

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Members</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 bg-gray-50 text-xs font-medium text-gray-600 px-4 py-2">
                  <div>User</div>
                  <div>Role</div>
                  <div>Added</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="divide-y divide-gray-200">
                  {loading ? (
                    <div className="p-4 text-sm text-gray-500">Loading members...</div>
                  ) : members.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No members yet</div>
                  ) : (
                    members.map((m) => {
                      const isOwner = m.role === 'owner' || (ownerId && m.user_id === ownerId);
                      const displayName = m.full_name || m.email || 'Unknown user';
                      return (
                      <div key={m.membership_id} className="grid grid-cols-4 items-center px-4 py-2 text-sm">
                        <div className="truncate" title={m.user_id}>{displayName}</div>
                        <div>
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.membership_id, e.target.value as RoleType)}
                            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                            disabled={Boolean(isOwner)}
                          >
                            <option value="owner" disabled>Owner</option>
                            <option value="member">Member</option>
                            <option value="admin">{isOwner ? 'Admin (Owner)' : 'Admin'}</option>
                          </select>
                        </div>
                        <div>{formatInTimezone(m.created_at, timezone, { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' })}</div>
                        <div className="text-right">
                          <button
                            onClick={() => handleRemove(m.membership_id)}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            disabled={Boolean(isOwner)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Invite by Email</h4>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as RoleType)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="owner">Owner</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim() || isInvitingSelf}
                  className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  title={isInvitingSelf ? "You cannot invite yourself" : ""}
                >
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">After creating an invite, share a link like /invites/accept/TOKEN with the user.</p>
            </div>
          </div>
        )}
      </div>
    );
};