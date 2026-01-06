# Leave Workspace Feature

## Issue
Workspace members had no way to leave a workspace on their own. They could only be removed by workspace admins/owners, which meant members were stuck in workspaces they no longer wanted to be part of.

## Solution
Implemented a complete "Leave Workspace" feature that allows non-owner members to voluntarily leave workspaces.

## Implementation

### 1. Backend Service - MembershipService
**File:** `lib/services/membership-service.ts`

Added `leaveWorkspace()` method:
```typescript
static async leaveWorkspace(workspaceId: string): Promise<void>
```

**Features:**
- Gets current authenticated user
- Finds user's membership in the workspace
- Prevents workspace owners from leaving (they must delete workspace or transfer ownership)
- Removes the membership from database
- Logs the leave action in audit log

**Validation:**
- User must be authenticated
- User must be a member of the workspace
- Owners cannot leave (must delete workspace instead)

### 2. Hook Integration - useWorkspaces
**File:** `lib/hooks/useWorkspaces.ts`

Added `leaveWorkspace()` function to the hook:
```typescript
const leaveWorkspace = useCallback(async (workspaceId: string): Promise<void>
```

**Features:**
- Calls MembershipService.leaveWorkspace()
- Removes workspace from sharedWorkspaces list
- Handles errors with proper error messages

### 3. UI Component - WorkspaceView
**File:** `components/dashboard/views/WorkspaceView.tsx`

Added "Leave Workspace" button:
- **Visibility:** Only shown to members and admins (not owners)
- **Styling:** Red border and text to indicate destructive action
- **Position:** Next to "Manage members" button in workspace toolbar
- **Props Added:**
  - `onLeaveWorkspace?: () => void` - Callback for leave action
  - `canLeaveWorkspace?: boolean` - Controls button visibility

### 4. Dashboard Integration
**File:** `app/dashboard/page.tsx`

Added `handleLeaveWorkspace()` handler:
```typescript
const handleLeaveWorkspace = useCallback(async () => {
  // Confirmation dialog
  // Call leaveWorkspace service
  // Switch to home view
  // Show success/error toast
}, [selectedWorkspaceId, leaveWorkspace, switchToHomeView, setSelectedWorkspaceId]);
```

**Features:**
- Confirmation dialog before leaving
- Switches to home view after leaving
- Shows success/error toast notifications
- Clears selected workspace

## User Experience

### For Members and Admins
1. Navigate to any workspace they're a member of
2. See "Leave workspace" button in red (next to other workspace actions)
3. Click button → confirmation dialog appears
4. Confirm → immediately removed from workspace
5. Redirected to home view
6. Success toast notification shown

### For Owners
- "Leave workspace" button is **not shown**
- Owners must either:
  - Delete the workspace entirely
  - Transfer ownership to another member first (future feature)

## Permissions

| Role | Can Leave Workspace? | Notes |
|------|---------------------|-------|
| Owner | ❌ No | Must delete workspace or transfer ownership |
| Admin | ✅ Yes | Can leave voluntarily |
| Member | ✅ Yes | Can leave voluntarily |

## Security & Validation

### Frontend Validation
- Button only shown to non-owners
- Confirmation dialog prevents accidental clicks
- Proper error handling with toast notifications

### Backend Validation
- Authenticated user check
- Membership existence check
- Owner prevention (throws error if owner tries to leave)
- Audit logging for compliance

## Database Changes
- No schema changes required
- Uses existing `workspace_memberships` table
- Audit log records leave actions with `action_type: 'leave'`

## Edge Cases Handled

1. **Owner trying to leave:** Blocked with clear error message
2. **Non-member trying to leave:** Error - "You are not a member of this workspace"
3. **Unauthenticated user:** Error - "Not authenticated"
4. **User cancels confirmation:** No action taken
5. **Currently viewing workspace being left:** Automatically redirected to home view

## Benefits

### User Autonomy
- Members can manage their own workspace memberships
- No need to contact admins to be removed
- Reduces administrative burden

### Better UX
- Clear, visible button for leaving
- Confirmation prevents accidents
- Immediate feedback with toasts
- Smooth navigation after leaving

### Data Integrity
- Proper audit logging
- Clean membership removal
- Prevents orphaned data

## Files Modified
1. `lib/services/membership-service.ts` - Added leaveWorkspace() method
2. `lib/hooks/useWorkspaces.ts` - Added leaveWorkspace to hook
3. `components/dashboard/views/WorkspaceView.tsx` - Added Leave button UI
4. `app/dashboard/page.tsx` - Added handler and wired up functionality

## Testing Scenarios

✅ **Member leaves workspace:** Successfully removed, redirected to home
✅ **Admin leaves workspace:** Successfully removed, redirected to home  
✅ **Owner tries to leave:** Button not shown, backend blocks if attempted
✅ **Confirmation cancel:** No action taken, stays in workspace
✅ **Leave while viewing workspace:** Redirected to home view
✅ **Error handling:** Proper error messages shown in toast
✅ **Audit logging:** Leave action recorded in audit log

## Future Enhancements
- Transfer ownership feature (allow owners to transfer before leaving)
- Bulk leave multiple workspaces
- Leave workspace from sidebar context menu
- Email notification when member leaves

