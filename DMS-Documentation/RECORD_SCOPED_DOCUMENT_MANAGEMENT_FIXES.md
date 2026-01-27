# Record-Scoped Document Management Fixes

## Overview
This document outlines the fixes implemented to ensure proper record-based scoping in the document management system. Previously, certain components were showing all documents/requests instead of limiting them to the specific record context.

## Issues Identified

### 1. Missing Record Context in SignatureRequestStatus Component
- **Location**: `components/base-detail/DocumentsView.tsx` (lines ~1099-1102)
- **Problem**: When accessing signature status from a record-scoped view, the `recordId` prop was not passed to the `SignatureRequestStatus` component
- **Impact**: Users would see all signature requests for the base/table instead of just those for the specific record

### 2. Inefficient Backend Filtering in SignatureRequestStatus
- **Location**: `components/base-detail/documents/SignatureRequestStatus.tsx` (line ~36)
- **Problem**: API call didn't include `recordId` in query string, causing all requests to be fetched then filtered frontend
- **Impact**: Performance degradation and unnecessary data transfer

### 3. Backend API Did Not Support Record-Based Filtering
- **Location**: `app/api/esignature/requests/route.ts` and `lib/services/esign-service.ts`
- **Problem**: The API endpoint and service function didn't support filtering by recordId
- **Impact**: Even with frontend fixes, all requests would still be returned without proper backend filtering

## Solutions Implemented

### 1. Fixed Record Context Passing
**File**: `components/base-detail/DocumentsView.tsx`
**Change**: Added missing `recordId` prop to `SignatureRequestStatus` component

```tsx
<SignatureRequestStatus
  baseId={baseId}
  tableId={selectedTable?.id ?? null}
  recordId={recordId}  // <-- Added this line
/>
```

### 2. Enhanced API Call with Record Parameter
**File**: `components/base-detail/documents/SignatureRequestStatus.tsx`
**Change**: Included `recordId` in the API request query string

```tsx
const response = await fetch(
  `/api/esignature/requests?baseId=${baseId}${tableId ? `&tableId=${tableId}` : ""}${recordId ? `&recordId=${recordId}` : ""}`,
  { headers }
);
```

### 3. Updated Backend Service to Support Record Filtering
**File**: `lib/services/esign-service.ts`
**Change**: Modified `listSignatureRequests` function to accept and use `recordId` parameter

```ts
async listSignatureRequests(baseId: string, tableId?: string | null, client?: SupabaseClient, recordId?: string | null): Promise<SignatureRequest[]> {
  
  // Filter by recordId if provided
  if (recordId) {
    query = query.eq("record_id", recordId);
  }
}
```

### 4. Updated API Route to Process Record Parameter
**File**: `app/api/esignature/requests/route.ts`
**Change**: Parse and pass `recordId` parameter from query string to service function

```ts
const recordId = searchParams.get("recordId");

const requests = await ESignatureService.listSignatureRequests(
  baseId,
  tableId || null,
  supabase,
  recordId || null  // <-- Added this parameter
);
```

## Testing Performed

1. **Record-Scoped Views**: Verified that when viewing documents from a record context, only signature requests for that specific record are displayed
2. **Base/Table Views**: Confirmed that base and table level views still show all requests appropriately
3. **Performance**: Confirmed that only relevant data is transferred from backend to frontend
4. **API Endpoints**: Tested that the API properly filters by recordId when provided

## Impact

- **Improved Performance**: Reduced data transfer by filtering at the backend level
- **Better UX**: Users now see only relevant signature requests in record-scoped contexts
- **Data Isolation**: Enhanced security through proper record-based data scoping
- **Consistency**: All document management components now properly respect record boundaries

## Files Modified

1. `components/base-detail/DocumentsView.tsx`
2. `components/base-detail/documents/SignatureRequestStatus.tsx`
3. `lib/services/esign-service.ts`
4. `app/api/esignature/requests/route.ts`

## Verification Steps

To verify the fixes are working:

1. Navigate to a specific record in the application
2. Open the document management view
3. Access the signature request status section
4. Confirm that only signature requests associated with that specific record are displayed
5. Navigate back to base/table level views and confirm all requests are shown appropriately