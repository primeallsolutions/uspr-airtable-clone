-- Fix legacy automation rows that still reference tables by ID inside trigger/action JSON
-- 1) Backfill trigger.table_name from trigger.table_id (and drop table_id key)
UPDATE public.automations AS a
SET trigger = jsonb_set(
    a.trigger - 'table_id',
    '{table_name}',
    to_jsonb(t.name),
    true
  )
FROM public.tables AS t
WHERE a.trigger ? 'table_id'
  AND (a.trigger->>'table_id')::uuid = t.id
  AND (a.trigger->>'table_name') IS NULL;

-- 2) Backfill action.target_table_name from action.target_table_id (and drop target_table_id key)
UPDATE public.automations AS a
SET action = jsonb_set(
    a.action - 'target_table_id',
    '{target_table_name}',
    to_jsonb(t.name),
    true
  )
FROM public.tables AS t
WHERE a.action ? 'target_table_id'
  AND (a.action->>'target_table_id')::uuid = t.id
  AND (a.action->>'target_table_name') IS NULL;

-- 3) Ensure base_id is populated (use trigger.table_name when available)
UPDATE public.automations AS a
SET base_id = t.base_id
FROM public.tables AS t
WHERE a.base_id IS NULL
  AND a.trigger ? 'table_name'
  AND t.name = (a.trigger->>'table_name');
