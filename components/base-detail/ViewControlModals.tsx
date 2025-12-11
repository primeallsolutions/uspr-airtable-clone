"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  X,
  Filter,
  EyeOff,
  Group,
  ArrowUpDown,
  Palette,
  Share2,
  Search,
  ChevronUp,
  ChevronDown,
  Trash2,
  Link,
  Settings,
  RefreshCw,
  Code2,
  ListPlus
} from "lucide-react";
import type { FieldRow, SortDirection } from "@/lib/types/base-detail";

const generateId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export type FilterOperator = "contains" | "equals" | "starts_with" | "is_not" | 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal';

export interface FilterCondition {
  id: string;
  fieldId: string | null;
  operator: FilterOperator;
  value: string;
}

export interface FilterState {
  match: "all" | "any";
  conditions: FilterCondition[];
}

export interface SortRule {
  id: string;
  fieldId: string | null;
  direction: SortDirection;
}

const createEmptyCondition = (): FilterCondition => ({
  id: generateId(),
  fieldId: null,
  operator: "contains",
  value: ""
});

const createEmptySortRule = (): SortRule => ({
  id: generateId(),
  fieldId: null,
  direction: "asc"
});

interface PanelCardProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

const PanelCard = ({ title, icon, onClose, children, footer }: PanelCardProps) => (
  <div className="w-[450px] max-w-[60vw] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[50vh]">
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            {icon}
          </div>
        )}
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Close panel"
      >
        <X size={16} className="text-gray-500" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {children}
    </div>
    {footer && (
      <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between gap-3">
        {footer}
      </div>
    )}
  </div>
);

interface HideFieldsPanelProps {
  isOpen: boolean;
  fields: FieldRow[];
  hiddenFieldIds: string[];
  onToggleField: (fieldId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onClose: () => void;
}

export const HideFieldsPanel = ({
  isOpen,
  fields,
  hiddenFieldIds,
  onToggleField,
  onShowAll,
  onHideAll,
  onClose
}: HideFieldsPanelProps) => {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  const filteredFields = useMemo(() => {
    if (!search.trim()) return fields;
    return fields.filter((field) => field.name.toLowerCase().includes(search.toLowerCase()));
  }, [fields, search]);

  if (!isOpen) return null;

  return (
    <PanelCard
      title="Hide fields"
      icon={<EyeOff size={18} />}
      onClose={onClose}
      footer={
        <div className="w-full flex flex-col gap-3">
          <div className="text-xs text-gray-500 leading-snug">
            Changes apply to this view only. Hidden fields will still be available in other views.
          </div>
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <button
              type="button"
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100"
              onClick={onHideAll}
            >
              Hide all
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100"
              onClick={onShowAll}
            >
              Show all
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      }
    >
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        This view is being used in a share link. Updating visible fields updates the shared view.
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a field"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {filteredFields.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-200 rounded-lg">
            No matching fields.
          </div>
        ) : (
          filteredFields.map((field) => {
            const isHidden = hiddenFieldIds.includes(field.id);
            return (
              <div
                key={field.id}
                className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{field.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{field.type.replace("_", " ")}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <span>{isHidden ? "Hidden" : "Visible"}</span>
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => onToggleField(field.id)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </label>
              </div>
            );
          })
        )}
      </div>
    </PanelCard>
  );
};

interface FilterPanelProps {
  isOpen: boolean;
  fields: FieldRow[];
  filter: FilterState;
  onApply: (config: FilterState) => void;
  onClear: () => void;
  onClose: () => void;
}

export const FilterPanel = ({
  isOpen,
  fields,
  filter,
  onApply,
  onClear,
  onClose
}: FilterPanelProps) => {
  const [localFilter, setLocalFilter] = useState<FilterState>(filter);

  useEffect(() => {
    if (isOpen) {
      setLocalFilter(filter);
    }
  }, [filter, isOpen]);

  const updateCondition = (conditionId: string, updates: Partial<FilterCondition>) => {
    setLocalFilter((prev) => ({
      ...prev,
      conditions: prev.conditions.map((condition) =>
        condition.id === conditionId ? { ...condition, ...updates } : condition
      )
    }));
  };

  // Helper function to select available operators for filters based on the selected field type
  // This can be expanded later to use different filters for any other data types
  const operatorOptions = (fieldId: string | null) => {
    const field = fields.find((f) => f.id === fieldId);
    const isNumeric = field?.type === "number";

    if (isNumeric) {
      return [
        { value: "equals", label: "is exactly" },
        { value: "is_not", label: "is not" },
        { value: "greater_than", label: "greater than" },
        { value: "greater_than_or_equal", label: "greater than or equal" },
        { value: "less_than", label: "less than" },
        { value: "less_than_or_equal", label: "less than or equal" }
      ] as Array<{ value: FilterOperator; label: string }>;
    }

    return [
      { value: "contains", label: "contains" },
      { value: "equals", label: "is exactly" },
      { value: "starts_with", label: "starts with" },
      { value: "is_not", label: "is not" }
    ] as Array<{ value: FilterOperator; label: string }>;
  };

  const addCondition = () => {
    setLocalFilter((prev) => ({
      ...prev,
      conditions: [...prev.conditions, createEmptyCondition()]
    }));
  };

  const removeCondition = (conditionId: string) => {
    setLocalFilter((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((condition) => condition.id !== conditionId)
    }));
  };

  const validConditions = localFilter.conditions.filter(
    (condition) => condition.fieldId && condition.value.trim()
  );

  const handleApply = () => {
    const sanitizedConditions = localFilter.conditions.filter(condition => condition.fieldId && condition.value.trim());
    const nextFilter: FilterState = {
      match: localFilter.match,
      conditions: sanitizedConditions.length ? sanitizedConditions : [createEmptyCondition()]
    };
    onApply(nextFilter);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <PanelCard
      title="Filter"
      icon={<Filter size={18} />}
      onClose={onClose}
      footer={
        <>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Show records that {localFilter.match === "all" ? "match all" : "match any"} conditions.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100"
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
              disabled={validConditions.length === 0}
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </>
      }
    >
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        This view is being used in a share link. Filtering will update everyone with the link.
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Show records when</span>
        <div className="flex rounded-full border border-gray-200 bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setLocalFilter((prev) => ({ ...prev, match: "all" }))}
            className={`px-3 py-1 text-xs font-medium rounded-full ${
              localFilter.match === "all" ? "bg-white shadow text-gray-900" : "text-gray-500"
            }`}
          >
            All conditions
          </button>
          <button
            type="button"
            onClick={() => setLocalFilter((prev) => ({ ...prev, match: "any" }))}
            className={`px-3 py-1 text-xs font-medium rounded-full ${
              localFilter.match === "any" ? "bg-white shadow text-gray-900" : "text-gray-500"
            }`}
          >
            Any condition
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {localFilter.conditions.map((condition, index) => (
          <div key={condition.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Condition {index + 1}</span>
              {localFilter.conditions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCondition(condition.id)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  aria-label="Remove condition"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={condition.fieldId ?? ""}
                onChange={(e) => {
                  const nextFieldId = e.target.value || null;
                  const allowed = operatorOptions(nextFieldId).map(op => op.value); // prevent a filter from being used on the wrong type (i.e. greater_than on text)
                  const nextOperator = allowed.includes(condition.operator) ? condition.operator : allowed[0];
                  updateCondition(condition.id, { fieldId: nextFieldId, operator: nextOperator });
                }}
              >
                <option value="">Choose field</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={condition.operator}
                onChange={(e) => updateCondition(condition.id, { operator: e.target.value as FilterOperator })}
              >
                {operatorOptions(condition.fieldId).map((option) => ( /* Generate options based on field type */
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={condition.value}
                onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                placeholder="Enter a value"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCondition}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-2"
      >
        <Filter size={14} />
        Add condition
      </button>
    </PanelCard>
  );
};

interface GroupPanelProps {
  isOpen: boolean;
  fields: FieldRow[];
  groupFieldIds: string[];
  onApply: (fieldIds: string[]) => void;
  onClose: () => void;
}

export const GroupPanel = ({
  isOpen,
  fields,
  groupFieldIds,
  onApply,
  onClose
}: GroupPanelProps) => {
  const [localGroups, setLocalGroups] = useState<string[]>(groupFieldIds);

  useEffect(() => {
    if (isOpen) {
      setLocalGroups(groupFieldIds);
    }
  }, [groupFieldIds, isOpen]);

  const toggleField = (fieldId: string) => {
    setLocalGroups((prev) => (prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]));
  };

  const moveField = (fieldId: string, direction: "up" | "down") => {
    setLocalGroups((prev) => {
      const index = prev.indexOf(fieldId);
      if (index === -1) return prev;
      const newOrder = [...prev];
      const targetIndex = direction === "up" ? Math.max(0, index - 1) : Math.min(prev.length - 1, index + 1);
      const [value] = newOrder.splice(index, 1);
      newOrder.splice(targetIndex, 0, value);
      return newOrder;
    });
  };

  const selectedFields = localGroups
    .map((id) => fields.find((field) => field.id === id))
    .filter((field): field is FieldRow => Boolean(field));

  const availableFields =
    localGroups.length >= 3 ? [] : fields.filter((field) => !localGroups.includes(field.id));

  if (!isOpen) return null;

  return (
    <PanelCard
      title="Group by"
      icon={<Group size={18} />}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100"
            onClick={() => {
              setLocalGroups([]);
              onApply([]);
              onClose();
            }}
          >
            Clear groups
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => {
              onApply(localGroups);
              onClose();
            }}
          >
            Apply grouping
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-600">Pick up to three fields to create stacked groups.</p>

      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Selected groups</p>
        {selectedFields.length === 0 && (
          <div className="px-4 py-3 border border-dashed border-gray-200 rounded-lg text-sm text-gray-500">
            No groups yet. Add fields below to start grouping.
          </div>
        )}
        {selectedFields.map((field, index) => (
          <div
            key={field.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 bg-gray-50"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {index + 1}. {field.name}
              </p>
              <p className="text-xs text-gray-500 capitalize">{field.type.replace("_", " ")}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveField(field.id, "up")}
                className="p-1 rounded hover:bg-white text-gray-500 disabled:opacity-30"
                disabled={index === 0}
                aria-label="Move up"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveField(field.id, "down")}
                className="p-1 rounded hover:bg-white text-gray-500 disabled:opacity-30"
                disabled={index === selectedFields.length - 1}
                aria-label="Move down"
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => toggleField(field.id)}
                className="p-1 rounded hover:bg-white text-red-500"
                aria-label="Remove group"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Available fields</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {availableFields.map((field) => (
            <button
              key={field.id}
              type="button"
              onClick={() => toggleField(field.id)}
              className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-left hover:border-blue-300 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{field.name}</p>
                <p className="text-xs text-gray-500 capitalize">{field.type.replace("_", " ")}</p>
              </div>
              <span className="text-xs font-semibold text-blue-600">Add</span>
            </button>
          ))}
          {availableFields.length === 0 && (
            <div className="col-span-full text-sm text-gray-500 text-center py-3 border border-dashed border-gray-200 rounded-lg">
              {localGroups.length >= 3
                ? "Grouping is limited to three fields. Remove one above to add another."
                : "All fields have been added above."}
            </div>
          )}
        </div>
      </div>
    </PanelCard>
  );
};

interface SortPanelProps {
  isOpen: boolean;
  fields: FieldRow[];
  sortRules: SortRule[];
  onApply: (rules: SortRule[]) => void;
  onClear: () => void;
  onClose: () => void;
}

export const SortPanel = ({
  isOpen,
  fields,
  sortRules,
  onApply,
  onClear,
  onClose
}: SortPanelProps) => {
  const [localRules, setLocalRules] = useState<SortRule[]>(sortRules.length ? sortRules : [createEmptySortRule()]);

  useEffect(() => {
    if (isOpen) {
      setLocalRules(sortRules.length ? sortRules : [createEmptySortRule()]);
    }
  }, [sortRules, isOpen]);

  const updateRule = (ruleId: string, updates: Partial<SortRule>) => {
    setLocalRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, ...updates } : rule)));
  };

  const addRule = () => {
    setLocalRules((prev) => [...prev, createEmptySortRule()]);
  };

  const removeRule = (ruleId: string) => {
    setLocalRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  };

  const validRules = localRules.filter((rule) => Boolean(rule.fieldId));

  const handleApply = () => {
    onApply(validRules.length ? validRules : []);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <PanelCard
      title="Sort"
      icon={<ArrowUpDown size={18} />}
      onClose={onClose}
      footer={
        <>
          <div className="text-xs text-gray-500">Rules run from top to bottom, similar to Airtable views.</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100"
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {localRules.map((rule, index) => (
          <div key={rule.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sort {index + 1}</span>
              {localRules.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  aria-label="Remove sort rule"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={rule.fieldId ?? ""}
                onChange={(e) => updateRule(rule.id, { fieldId: e.target.value || null })}
              >
                <option value="">Select field</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={rule.direction}
                onChange={(e) => updateRule(rule.id, { direction: e.target.value as SortDirection })}
              >
                <option value="asc">First → Last</option>
                <option value="desc">Last → First</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRule}
        disabled={localRules.length >= 3}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-2 disabled:opacity-40"
      >
        <ArrowUpDown size={14} />
        Add another sort
      </button>
    </PanelCard>
  );
};

interface ColorPanelProps {
  isOpen: boolean;
  fields: FieldRow[];
  colorFieldId: string | null;
  onApply: (fieldId: string | null) => void;
  onClose: () => void;
}

export const ColorPanel = ({
  isOpen,
  fields,
  colorFieldId,
  onApply,
  onClose
}: ColorPanelProps) => {
  const [localFieldId, setLocalFieldId] = useState<string | null>(colorFieldId);

  useEffect(() => {
    if (isOpen) {
      setLocalFieldId(colorFieldId);
    }
  }, [colorFieldId, isOpen]);

  const colorableFields = useMemo(
    () =>
      fields.filter((field) =>
        ["single_select", "multi_select"].includes(field.type) ||
        field.name.toLowerCase().includes("status") ||
        field.name.toLowerCase().includes("priority")
      ),
    [fields]
  );

  if (!isOpen) return null;

  return (
    <PanelCard
      title="Color records"
      icon={<Palette size={18} />}
      onClose={onClose}
      footer={
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100"
            onClick={() => {
              setLocalFieldId(null);
              onApply(null);
              onClose();
            }}
          >
            Remove colors
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => {
              onApply(localFieldId ?? null);
              onClose();
            }}
          >
            Apply
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-600">
        Choose a select-style field to apply consistent pill colors across the grid, similar to Airtable&apos;s color picker.
      </p>
      <select
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none mt-3"
        value={localFieldId ?? ""}
        onChange={(e) => setLocalFieldId(e.target.value || null)}
      >
        <option value="">No colors applied</option>
        {colorableFields.map((field) => (
          <option key={field.id} value={field.id}>
            {field.name}
          </option>
        ))}
      </select>
      {colorableFields.length === 0 && (
        <div className="mt-3 text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg px-4 py-3">
          Add a single select or status field to unlock color coding.
        </div>
      )}
    </PanelCard>
  );
};

interface ShareViewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  baseId: string | null;
  baseName: string;
}

export const ShareViewPanel = ({
  isOpen,
  onClose,
  baseId,
  baseName
}: ShareViewPanelProps) => {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (!baseId) return "";
    if (typeof window !== "undefined") {
      return `${window.location.origin}/bases/${baseId}`;
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    return siteUrl ? `${siteUrl.replace(/\/$/, "")}/bases/${baseId}` : `/bases/${baseId}`;
  }, [baseId]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const shareOptions = [
    { id: "link-settings", icon: <Settings size={16} />, label: "Link settings", description: "Control access permissions and expiration." },
    { id: "sync", icon: <RefreshCw size={16} />, label: "Sync to another base", description: "Send this view to another workspace." },
    { id: "embed", icon: <Code2 size={16} />, label: "Embed this view", description: "Generate an iframe to embed in a site." },
    { id: "form", icon: <ListPlus size={16} />, label: "Create a form", description: "Collect data directly into this base." }
  ];

  if (!isOpen) return null;

  return (
    <PanelCard
      title="Share & sync"
      icon={<Share2 size={18} />}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors ml-auto"
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
        <p className="text-sm text-gray-600">
          Share a read-only link to <span className="font-semibold">{baseName || "this base"}</span>. Anyone with the link can view the data.
        </p>
        <div className="space-y-2">
          <label className="text-xs text-gray-600 uppercase tracking-wide">Share link</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center gap-1"
              disabled={!shareUrl}
            >
              <Link size={14} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {shareOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                {option.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{option.label}</p>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </PanelCard>
  );
};
