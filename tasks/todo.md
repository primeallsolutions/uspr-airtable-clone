## Plan
- [x] Enforce masterlist as the only canonical record: all edits (master or copy) sync to master first, then propagate one copy to target; clean stray copies.
- [x] Make trigger resolution deterministic for field_change (require explicit field and changed fields present).
- [x] Harden move/sync pipeline: strict single-copy invariant, delete extras, ensure `_source_record_id` set, consistent select remap.
- [x] Align automation UI with backend: disable preserve_original for moves, block unsupported configs, and validate mappings/conditions.
- [x] Add lightweight guardrails to prevent multiple copies per table (cleanup on write).

## Plan (automation canonical fix)
- [x] Tighten automation trigger filtering so base-wide triggers run only from masterlist, require matching table when provided, and skip ambiguous field_name/field_id mixes.
- [x] Enforce master-first single-copy invariant inside automation actions (copy/move/sync): always set `_source_record_id`, sync master first, and remove stray copies.
- [x] Add a lightweight duplicate guard that prunes multiple copies per table/_source_record_id during automation runs.
- [x] Align automation UI with backend constraints: require a source table/field, remove "all tables" ambiguity, and disable preserve_original for move actions.
The table automation is not working after I changed status it did not go to its respective non-masterlist table. Can you Fix it?- [ ] Update review notes once changes are in.

## Review
- Summary: Tightened automation gating to require explicit source tables/masterlist for base-wide triggers, enforced master-first single-copy flows (copy/move/sync) with `_source_record_id` and duplicate pruning, and aligned the automation modal to require a source table while disabling preserve_original for move actions.
- Notes: Not run: tests/lint.

## Plan (delete base failure)
- [ ] Trace delete flow (DeleteBaseModal -> caller -> service) to locate where FK conflict surfaces.
- [ ] Implement safe cascade delete: remove tables (and children) for the base before deleting the base, wrapped in a transaction/RPC or sequential guarded calls.
- [ ] Surface clear UI error when FK blocks delete; refresh list on success.
- [ ] Verify deletion end-to-end and update review notes.

