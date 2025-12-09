# Kanban View Refactor - Airtable-Style Implementation

## Overview
Refactored the Kanban view to work like Airtable, where Grid and Kanban views share the same data and changes sync bidirectionally.

## Key Changes

### 1. KanbanView Component (`components/base-detail/KanbanView.tsx`)

**Before:**
- Kanban columns were based on table names (pipeline tables)
- Moving cards would transfer records between different tables
- Separate data management for Kanban vs Grid

**After:**
- Kanban columns are based on single-select field options (Airtable-style)
- Drag-and-drop updates the single-select field value (stays in same table)
- Same data source as Grid view
- Added inline editing for all fields in Kanban cards
- Enhanced card detail modal with editing capabilities

**New Features:**
- Click on any field in a card to edit it inline
- "View all" button opens detailed modal with all fields
- Edit any field in the detail modal by clicking
- Keyboard shortcuts: Enter to save, Escape to cancel
- Visual feedback for saving states
- Better UI with Edit2 and Trash2 icons

### 2. Base Detail Page (`app/bases/[id]/page.tsx`)

**Before:**
- Separate `gridTableId` and `kanbanTableId` state
- Kanban was pinned to masterlist table
- Different table selection logic for each view
- `showTableTabs` only visible in Grid view

**After:**
- Single `viewTableId` state for both views
- Both Grid and Kanban use the same selected table
- Unified table selection logic
- Table tabs visible in both views
- Both views receive the same `processedRecords` and `visibleFields`

**Removed Logic:**
```typescript
// Old: Separate table management
const [gridTableId, setGridTableId] = useState<string | null>(null);
const [kanbanTableId, setKanbanTableId] = useState<string | null>(null);

// Old: Complex view-specific logic
if (viewMode === 'kanban') {
  return; // Block table switching
}
```

**New Logic:**
```typescript
// New: Unified table management
const [viewTableId, setViewTableId] = useState<string | null>(null);

// New: Simple, shared logic
const handleTableSelect = (tableId: string) => {
  setViewTableId(tableId);
  setSelectedTableId(tableId);
};
```

### 3. Column Generation

**Before:**
```typescript
// Columns based on tables
const baseColumns = pipelineTables.map(table => ({
  id: table.id,
  label: table.name,
  // ...
}));
```

**After:**
```typescript
// Columns based on single-select options
const baseColumns = stackOptions.map((option) => ({
  id: `option-${option.key}`,
  label: option.label,
  color: option.color || pickColor(option.label),
  persistValue: option.key
}));
```

## How It Works Now

1. **Data Flow:**
   - User selects a table (applies to both Grid and Kanban)
   - Both views receive the same filtered, sorted, and processed records
   - Both views can edit the same data

2. **Kanban Organization:**
   - Kanban columns = options from a single-select field
   - User can choose which single-select field to "stack by"
   - Drag card to different column = updates that field's value
   - "No Status" column for records without a value

3. **Bidirectional Sync:**
   - Edit in Grid → instantly reflects in Kanban
   - Edit in Kanban → instantly reflects in Grid
   - Both use the same `updateCell` function
   - Both use the same `savingCell` state for visual feedback

4. **Inline Editing:**
   - Click any field value to edit it
   - Changes save automatically on blur or Enter
   - ESC to cancel
   - Works in both card view and detail modal

## Benefits

1. **Consistency:** Same data everywhere, no confusion
2. **Flexibility:** Can view any table in Kanban (not just masterlist)
3. **Airtable-like UX:** Familiar workflow for users
4. **Better Performance:** Single data source, no duplicate fetching
5. **Easier Maintenance:** Less complex state management

## Testing Checklist

- [ ] Switch between Grid and Kanban views
- [ ] Edit a field in Grid, verify it updates in Kanban
- [ ] Edit a field in Kanban card, verify it updates in Grid
- [ ] Drag a card between columns, verify field value updates
- [ ] Switch tables, verify both views update
- [ ] Create a new record in Kanban, verify it appears in Grid
- [ ] Delete a record in either view, verify it's removed from both
- [ ] Test with tables that have single-select fields
- [ ] Test with tables that don't have single-select fields
- [ ] Verify inline editing works correctly
- [ ] Test keyboard shortcuts (Enter/Escape)

## Notes

- If a table has no single-select fields, Kanban shows a helpful message
- Users can switch between different single-select fields as the "stack by" field
- The "No Status" column catches all records without a value
- All view controls (filter, sort, hide fields) apply to both views

