import { useEffect, useMemo, useState } from "react";
import { X, ShieldAlert } from "lucide-react";
import { MembershipService, type RoleType } from "@/lib/services/membership-service";
import { useTimezone } from "@/lib/hooks/useTimezone";
import { formatInTimezone } from "@/lib/utils/date-helpers";
import { useRole } from "@/lib/hooks/useRole";
import { useAuth } from "@/lib/hooks/useAuth";

interface ManageWorkspaceMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const ManageWorkspaceMembersModal = ({ isOpen, onClose, workspaceId }: ManageWorkspaceMembersModalProps) => {
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
    if (isOpen && canManageMembers) {
      void loadMembers();
    }
  }, [isOpen, loadMembers, canManageMembers]);

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

  if (!isOpen) return null;

  // Show loading state while checking permissions
  if (roleLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl p-8 text-center">
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Block access if user doesn't have permission
  if (!canManageMembers) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Access Denied</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-8 text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-2">You do not have permission to manage workspace members.</p>
            <p className="text-gray-500 text-sm">Only workspace owners and admins can access this feature.</p>
          </div>
          <div className="flex items-center justify-end border-t border-gray-200 px-6 py-4">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Manage Workspace Members</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
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
                      <div className="truncate" title={m.user_id}>
                        <span>{displayName}</span>
                        <span className="ml-2 text-xs text-gray-400 hidden sm:inline">({m.user_id})</span>
                      </div>
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

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};




