# Select Field Data Format Fix

## Issue
The template data contained invalid data for select fields. The options were stored using inconsistent property names (`label` vs `name`), and record values were storing display names instead of option keys. This caused the dropdown view to work by coincidence, but when editing fields, the options became corrupted.

## Root Causes

### 1. Inconsistent Property Names
- **CreateFieldModal** was using `label` property: `{ label: option.label, color: option.color }`
- **EditFieldModal** was using `name` property: `{ name: option.label, color: option.color }`
- **CellEditor** and other components expected `name` property

### 2. Invalid Record Values
- Template records were storing display names (e.g., `'Buyer'`, `'Active'`) instead of option keys (e.g., `'buyer'`, `'active'`)
- Select field values should reference the option key, not the display name
- This worked in dropdown view by accident but broke when editing

## Solution

### 1. Fixed CreateFieldModal (components/base-detail/CreateFieldModal.tsx)
Changed line 156 from:
```typescript
label: option.label,
```
to:
```typescript
name: option.label,
```

Now both CreateFieldModal and EditFieldModal consistently use the `name` property for option definitions.

### 2. Fixed Template Record Values (lib/data/predefined-templates.ts)
Updated all record values in all templates to use option keys instead of display names:

**REAL_ESTATE_CRM_TEMPLATE:**
- `'Type': 'Buyer'` → `'Type': 'buyer'`
- `'Status': 'Hot Lead'` → `'Status': 'hot_lead'`
- `'Property Type': 'House'` → `'Property Type': 'house'`
- `'Stage': 'Showing'` → `'Stage': 'showing'`
- `'Probability': '50%'` → `'Probability': 'p50'`
- `'Priority': 'High'` → `'Priority': 'high'`
- And all other select field values...

**PROJECT_MANAGEMENT_TEMPLATE:**
- `'Status': 'Active'` → `'Status': 'active'`
- `'Priority': 'High'` → `'Priority': 'high'`
- `'Role': 'Developer'` → `'Role': 'developer'`
- And all other select field values...

**INVENTORY_MANAGEMENT_TEMPLATE:**
- `'Category': 'Electronics'` → `'Category': 'electronics'`
- `'Status': 'In Stock'` → `'Status': 'in_stock'`
- `'Movement Type': 'Purchase'` → `'Movement Type': 'purchase'`
- And all other select field values...

**EVENT_PLANNING_TEMPLATE:**
- `'Event Type': 'Conference'` → `'Event Type': 'conference'`
- `'RSVP Status': 'Confirmed'` → `'RSVP Status': 'confirmed'`
- `'Service Type': 'Catering'` → `'Service Type': 'catering'`
- And all other select field values...

**CONTENT_CALENDAR_TEMPLATE:**
- `'Content Type': 'Blog Post'` → `'Content Type': 'blog_post'`
- `'Status': 'Published'` → `'Status': 'published'`
- `'Platform': ['Website', 'LinkedIn']` → `'Platform': ['website', 'linkedin']`
- And all other select field values...

## Correct Format

### Field Options Structure
```typescript
{
  option_key: {
    name: 'Display Name',
    color: '#HEX_COLOR'
  }
}
```

Example:
```typescript
{
  buyer: { name: 'Buyer', color: '#1E40AF' },
  seller: { name: 'Seller', color: '#C2410C' },
  both: { name: 'Both', color: '#15803D' }
}
```

### Record Values
Record values should reference the **option key**, not the display name:
```typescript
// ✅ CORRECT
{ 'Type': 'buyer' }

// ❌ WRONG
{ 'Type': 'Buyer' }
```

## Impact
- Select fields now work correctly in all views (dropdown, kanban, grid)
- Field editing preserves options correctly
- Template data is consistent and valid
- No more option corruption when editing fields

## Files Changed
1. `components/base-detail/CreateFieldModal.tsx` - Fixed to use `name` property
2. `lib/data/predefined-templates.ts` - Fixed all record values to use option keys

