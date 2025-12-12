# 🔍 Kanban/Grid Sync Debugging Guide

## Issue
Changes in Kanban view are not reflecting in Grid view (or vice versa).

## Debugging Steps Added

I've added console logging at key points to trace the data flow:

### 1. **When Dropping a Card in Kanban**
Look for: `🎯 Kanban Drop:`
```
{
  recordId: "abc-123",
  fieldId: "field-id",
  fieldName: "Status",
  fieldType: "single_select",
  columnValue: "Buylist",
  formattedValue: "Buylist" (or ["Buylist"] for multi_select)
}
```

### 2. **When useBaseDetail Updates**
Look for: `🔄 useBaseDetail.updateCell:`
```
{
  recordId: "abc-123",
  fieldId: "field-id",
  value: "Buylist",
  valueType: "string",
  isArray: false
}
```

### 3. **When Records State Updates**
Look for: `✅ Records state updated:`
```
{
  totalRecords: 10,
  updatedRecord: "Buylist"
}
```

### 4. **When processedRecords Recomputes**
Look for: `🔄 processedRecords recomputing`
```
raw records count: 10
```

### 5. **When Kanban Columns Rebuild**
Look for: `📊 Kanban columns built:`
```
{
  fieldName: "Status",
  totalRecords: 10,
  columns: [
    { label: "Buylist", value: "Buylist", recordCount: 3 },
    { label: "Waiting For Documents", value: "Waiting For Documents", recordCount: 2 },
    ...
  ]
}
```

---

## How to Test

### Step 1: Open Browser DevTools
1. Open your app at `http://localhost:3001`
2. Open DevTools (F12)
3. Go to Console tab
4. Clear console (Ctrl+L)

### Step 2: Test Kanban → Grid Sync
1. Go to Kanban view
2. Drag a contact card to a different column
3. Watch console logs appear in this order:
   ```
   🎯 Kanban Drop: { ... }
   🔄 useBaseDetail.updateCell: { ... }
   ✅ Records state updated: { ... }
   🔄 processedRecords recomputing, raw records count: X
   📊 Kanban columns built: { ... }
   ```
4. Switch to Grid view
5. Check if the Status column shows the new value

### Step 3: Test Grid → Kanban Sync
1. Go to Grid view
2. Click on a Status cell and change its value
3. Watch console logs
4. Switch to Kanban view
5. Check if the card moved to the correct column

---

## Common Issues & Solutions

### Issue 1: Value Mismatch
**Symptom**: Card doesn't move to correct column after drop

**Check**:
- Compare `columnValue` in "Kanban Drop" log
- With `updatedRecord` in "Records state updated" log
- They should match!

**Possible Causes**:
- `formatValueForField` is incorrectly converting the value
- For single_select: should be string `"Buylist"`
- For multi_select: should be array `["Buylist"]`

**Fix**:
```typescript
const formatValueForField = (value: string | null) => {
  if (!stackedByField) return value;
  if (stackedByField.type === "multi_select") {
    return value ? [value] : null;  // ✅ Correct
  }
  return value;  // ✅ For single_select, return as-is
};
```

### Issue 2: Column Key vs Label Mismatch
**Symptom**: Records show in "No Value" column even though they have a value

**Check**:
- In "Kanban columns built" log, look at column values
- Check if `columnValue` matches the `value` field of a column

**Example Problem**:
```
// Column defined as:
{ label: "Buylist", value: "option-key-123", recordCount: 0 }

// But record has:
record.values.status = "Buylist"  // ❌ Won't match!
```

**Fix**: Use the same value for both key and label:
```typescript
dropdownOptions.map((option) => ({
  value: option.label,  // ✅ Use label as value
  label: option.label,
  color: option.color
}));
```

### Issue 3: React Not Re-rendering
**Symptom**: Console logs show correct values but UI doesn't update

**Check**:
- Do you see "📊 Kanban columns built" log after the update?
- If YES: React is re-rendering, but visual update might be blocked
- If NO: React is not detecting the state change

**Possible Causes**:
- State mutation instead of immutable update
- Missing dependency in useMemo

**Fix**: Ensure all updates are immutable (already done in code)

### Issue 4: Database Update Fails
**Symptom**: "❌ updateCell error" in console

**Check**:
- Error message in console
- Network tab for failed API calls

**Possible Causes**:
- Database constraint violation
- Permission denied
- Network error

**Fix**: Check Supabase logs and RLS policies

---

## Expected Console Output (Success)

When you drag a card, you should see:

```
🎯 Kanban Drop: {
  recordId: "abc-123",
  fieldId: "field-status-id",
  fieldName: "Status",
  fieldType: "single_select",
  columnValue: "Buylist",
  formattedValue: "Buylist"
}

🔄 useBaseDetail.updateCell: {
  recordId: "abc-123",
  fieldId: "field-status-id",
  value: "Buylist",
  valueType: "string",
  isArray: false
}

✅ Records state updated: {
  totalRecords: 10,
  updatedRecord: "Buylist"
}

🔄 processedRecords recomputing, raw records count: 10

📊 Kanban columns built: {
  fieldName: "Status",
  totalRecords: 10,
  columns: [
    { label: "Buylist", value: "Buylist", recordCount: 4 },  // ← Count increased!
    { label: "Waiting For Documents", value: "Waiting For Documents", recordCount: 3 },
    { label: "Pre Qualified", value: "Pre Qualified", recordCount: 2 },
    { label: "No Value", value: null, recordCount: 1 }
  ]
}

✅ Kanban update successful
```

---

## Quick Diagnostic

Run this in browser console after dragging a card:

```javascript
// Check if records state has the new value
console.log("Current records:", window.__NEXT_DATA__);

// Or open React DevTools:
// 1. Click React DevTools tab
// 2. Find BaseDetailPage component
// 3. Check "records" state
// 4. Find the record you updated
// 5. Check if its field value is correct
```

---

## If Sync Still Doesn't Work

### Last Resort Debugging

Add this to `page.tsx` after the `processedRecords` useMemo:

```typescript
useEffect(() => {
  console.log("🔍 processedRecords changed!", {
    count: processedRecords.length,
    sample: processedRecords[0]
  });
}, [processedRecords]);
```

This will log every time `processedRecords` changes. If you don't see this log after dropping a card, then `records` state is not updating.

---

## Need More Help?

1. Copy all console logs from a drag-drop action
2. Check which log is missing or shows wrong data
3. That's where the bug is!






