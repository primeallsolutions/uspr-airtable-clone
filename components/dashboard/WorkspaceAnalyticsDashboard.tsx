"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import GridLayoutBase, { WidthProvider, type Layout } from "react-grid-layout";
import { Loader2, Plus, GripVertical, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { BaseService } from "@/lib/services/base-service";
import { WorkspaceAnalyticsService } from "@/lib/services/workspace-analytics-service";
import type { BaseRecord } from "@/lib/types/dashboard";
import type { FieldRow, FieldType } from "@/lib/types/base-detail";
import type {
  AnalyticsCardLayout,
  WorkspaceAnalyticsAggregation,
  WorkspaceAnalyticsCard,
  WorkspaceAnalyticsChartType
} from "@/lib/types/analytics";

type TableMeta = { id: string; name: string; base_id: string };

const GridLayout = WidthProvider(GridLayoutBase);

const CHART_COLORS = [
  "#2563eb",
  "#0f766e",
  "#ea580c",
  "#7c3aed",
  "#0891b2",
  "#a21caf",
  "#16a34a",
  "#ca8a04"
];

const NUMBER_AGGREGATIONS: WorkspaceAnalyticsAggregation[] = ['count', 'sum', 'avg', 'min', 'max'];
const GROUP_AGGREGATIONS: WorkspaceAnalyticsAggregation[] = ['count', 'sum'];

const DEFAULT_NUMBER_LAYOUT = { w: 3, h: 3 };
const DEFAULT_CHART_LAYOUT = { w: 4, h: 5 };

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

const isNumeric = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "" && !Number.isNaN(Number(value));
  return false;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
};

const resolveOptionLabel = (field: FieldRow | undefined, value: unknown): string => {
  if (!field || !field.options || typeof value !== "string") return String(value);
  const options = field.options as Record<string, { label?: string; name?: string }>;
  const option = options[value];
  return option?.label || option?.name || value;
};

const formatGroupValue = (raw: unknown, field?: FieldRow): string[] => {
  if (raw === null || raw === undefined || raw === "") {
    return ["(empty)"];
  }

  if (Array.isArray(raw)) {
    return raw.map((item) => resolveOptionLabel(field, item));
  }

  if (field?.type === "checkbox") {
    return [raw ? "Yes" : "No"];
  }

  if (field?.type === "date" || field?.type === "datetime") {
    const date = new Date(String(raw));
    if (!Number.isNaN(date.getTime())) {
      const iso = date.toISOString();
      return [field.type === "date" ? iso.slice(0, 10) : iso.replace("T", " ").slice(0, 16)];
    }
  }

  if (field?.type === "single_select" || field?.type === "radio_select") {
    return [resolveOptionLabel(field, raw)];
  }

  return [String(raw)];
};

const sortChartData = (data: { name: string; value: number }[], fieldType?: FieldType) => {
  if (fieldType === "date" || fieldType === "datetime") {
    return [...data].sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  }
  if (data.every((item) => isNumeric(item.name))) {
    return [...data].sort((a, b) => Number(a.name) - Number(b.name));
  }
  return [...data].sort((a, b) => a.name.localeCompare(b.name));
};

const getDefaultLayout = (type: WorkspaceAnalyticsChartType, index: number): AnalyticsCardLayout => {
  const size = type === "number" ? DEFAULT_NUMBER_LAYOUT : DEFAULT_CHART_LAYOUT;
  const x = (index * size.w) % 12;
  const y = Math.floor((index * size.w) / 12) * size.h;
  return { x, y, w: size.w, h: size.h };
};

const normalizeLayout = (
  layout: AnalyticsCardLayout | null,
  fallback: AnalyticsCardLayout
): AnalyticsCardLayout => {
  if (!layout) return fallback;
  const { x, y, w, h } = layout;
  if ([x, y, w, h].every((val) => typeof val === "number")) {
    return { x, y, w, h };
  }
  return fallback;
};

export const WorkspaceAnalyticsDashboard = ({ workspaceId }: { workspaceId: string }) => {
  const [cards, setCards] = useState<WorkspaceAnalyticsCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [bases, setBases] = useState<BaseRecord[]>([]);
  const [tablesByBase, setTablesByBase] = useState<Record<string, TableMeta[]>>({});
  const [fieldsByTable, setFieldsByTable] = useState<Record<string, FieldRow[]>>({});
  const [tableRefreshVersion, setTableRefreshVersion] = useState<Record<string, number>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<WorkspaceAnalyticsCard | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [formState, setFormState] = useState({
    title: "",
    chart_type: "number" as WorkspaceAnalyticsChartType,
    base_id: "",
    table_id: "",
    group_field_id: "",
    value_field_id: "",
    aggregation: "count" as WorkspaceAnalyticsAggregation
  });

  const loadCards = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoadingCards(true);
      const data = await WorkspaceAnalyticsService.getCards(workspaceId);
      setCards(data);
    } catch (error) {
      console.error("Failed to load analytics cards:", error);
      toast.error("Failed to load analytics cards");
    } finally {
      setLoadingCards(false);
    }
  }, [workspaceId]);

  const loadBases = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await BaseService.getWorkspaceBases(workspaceId);
      setBases(data);
    } catch (error) {
      console.error("Failed to load bases:", error);
    }
  }, [workspaceId]);

  const refreshTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const bumpTableRefresh = useCallback((tableId: string) => {
    const existing = refreshTimersRef.current[tableId];
    if (existing) {
      clearTimeout(existing);
    }
    refreshTimersRef.current[tableId] = setTimeout(() => {
      setTableRefreshVersion((prev) => ({
        ...prev,
        [tableId]: (prev[tableId] ?? 0) + 1
      }));
    }, 250);
  }, []);

  const ensureTables = useCallback(async (baseId: string) => {
    if (!baseId || tablesByBase[baseId]) return;
    const { data, error } = await supabase
      .from("tables")
      .select("id, name, base_id")
      .eq("base_id", baseId)
      .order("order_index");

    if (!error) {
      setTablesByBase((prev) => ({ ...prev, [baseId]: (data ?? []) as TableMeta[] }));
    }
  }, [tablesByBase]);

  const ensureFields = useCallback(async (tableId: string) => {
    if (!tableId || fieldsByTable[tableId]) return;
    const { data, error } = await supabase
      .from("fields")
      .select("id, name, type, options, table_id, order_index")
      .eq("table_id", tableId)
      .order("order_index");

    if (!error) {
      setFieldsByTable((prev) => ({ ...prev, [tableId]: (data ?? []) as FieldRow[] }));
    }
  }, [fieldsByTable]);

  useEffect(() => {
    void loadCards();
    void loadBases();
  }, [loadCards, loadBases]);

  useEffect(() => {
    cards.forEach((card) => {
      void ensureTables(card.base_id);
      void ensureFields(card.table_id);
    });
  }, [cards, ensureTables, ensureFields]);

  useEffect(() => {
    if (!cards.length) return;
    const tableIds = Array.from(new Set(cards.map((card) => card.table_id))).filter(Boolean);
    const channels = tableIds.map((tableId) => {
      const channel = supabase
        .channel(`analytics-table-${tableId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "records",
            filter: `table_id=eq.${tableId}`
          },
          () => bumpTableRefresh(tableId)
        )
        .subscribe();
      return channel;
    });

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [cards, bumpTableRefresh]);

  useEffect(() => {
    if (!detailCardId) return;
    if (!cards.some((card) => card.id === detailCardId)) {
      setDetailCardId(null);
    }
  }, [cards, detailCardId]);

  useEffect(() => {
    const timers = refreshTimersRef.current;
    return () => {
      Object.values(timers).forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  const openCreate = () => {
    setEditingCard(null);
    setFormState({
      title: "",
      chart_type: "number",
      base_id: "",
      table_id: "",
      group_field_id: "",
      value_field_id: "",
      aggregation: "count"
    });
    setEditorOpen(true);
  };

  const openEdit = (card: WorkspaceAnalyticsCard) => {
    setEditingCard(card);
    setFormState({
      title: card.title,
      chart_type: card.chart_type,
      base_id: card.base_id,
      table_id: card.table_id,
      group_field_id: card.group_field_id ?? "",
      value_field_id: card.value_field_id ?? "",
      aggregation: card.aggregation
    });
    void ensureTables(card.base_id);
    void ensureFields(card.table_id);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
  };

  const handleFormChange = (key: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveCard = async () => {
    if (!workspaceId) return;
    if (!formState.title.trim()) {
      toast.error("Card title is required");
      return;
    }
    if (!formState.base_id || !formState.table_id) {
      toast.error("Select a base and table");
      return;
    }
    if (formState.chart_type !== "number" && !formState.group_field_id) {
      toast.error("Select a field to group by");
      return;
    }
    if (formState.aggregation === "sum" && !formState.value_field_id) {
      toast.error("Select a numeric value field for sum");
      return;
    }
    if (formState.chart_type === "number" && formState.aggregation !== "count" && !formState.value_field_id) {
      toast.error("Select a numeric value field for this aggregation");
      return;
    }

    const aggregation =
      formState.chart_type === "number"
        ? formState.aggregation
        : (GROUP_AGGREGATIONS.includes(formState.aggregation) ? formState.aggregation : "count");

    try {
      setSavingCard(true);
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData.user?.id ?? null;

      if (editingCard) {
        const updated = await WorkspaceAnalyticsService.updateCard(editingCard.id, {
          title: formState.title.trim(),
          chart_type: formState.chart_type,
          base_id: formState.base_id,
          table_id: formState.table_id,
          group_field_id: formState.group_field_id || null,
          value_field_id: formState.value_field_id || null,
          aggregation
        });
        setCards((prev) => prev.map((card) => (card.id === updated.id ? updated : card)));
        toast.success("Analytics card updated");
      } else {
        const layout = getDefaultLayout(formState.chart_type, cards.length);
        const created = await WorkspaceAnalyticsService.createCard({
          workspace_id: workspaceId,
          base_id: formState.base_id,
          table_id: formState.table_id,
          group_field_id: formState.group_field_id || null,
          value_field_id: formState.value_field_id || null,
          title: formState.title.trim(),
          chart_type: formState.chart_type,
          aggregation,
          layout,
          created_by: createdBy
        } as Omit<WorkspaceAnalyticsCard, "id" | "created_at" | "updated_at">);
        setCards((prev) => [created, ...prev]);
        toast.success("Analytics card created");
      }
      setEditorOpen(false);
    } catch (error) {
      console.error("Failed to save analytics card:", error);
      toast.error("Failed to save analytics card");
    } finally {
      setSavingCard(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm("Delete this analytics card? This cannot be undone.")) return;
    try {
      await WorkspaceAnalyticsService.deleteCard(cardId);
      setCards((prev) => prev.filter((card) => card.id !== cardId));
      toast.success("Analytics card deleted");
    } catch (error) {
      console.error("Failed to delete analytics card:", error);
      toast.error("Failed to delete analytics card");
    }
  };

  const layout = useMemo(() => (
    cards.map((card, index) => {
      const fallback = getDefaultLayout(card.chart_type, index);
      const normalized = normalizeLayout(card.layout, fallback);
      const minW = card.chart_type === "number" ? 2 : 3;
      const minH = card.chart_type === "number" ? 2 : 4;
      return { i: card.id, ...normalized, minW, minH, maxW: 12, maxH: 12 } as Layout;
    })
  ), [cards]);

  const persistLayout = async (nextLayout: Layout[]) => {
    const layoutById = new Map(nextLayout.map((item) => [item.i, item]));
    setCards((prev) => prev.map((card) => {
      const item = layoutById.get(card.id);
      if (!item) return card;
      return {
        ...card,
        layout: { x: item.x, y: item.y, w: item.w, h: item.h }
      };
    }));

    try {
      await Promise.all(
        nextLayout.map((item) =>
          WorkspaceAnalyticsService.updateCard(item.i, {
            layout: { x: item.x, y: item.y, w: item.w, h: item.h }
          })
        )
      );
    } catch (error) {
      console.error("Failed to save layout:", error);
      toast.error("Failed to save card layout");
    }
  };

  const baseOptions = useMemo(
    () => [...bases].sort((a, b) => a.name.localeCompare(b.name)),
    [bases]
  );
  const tableOptions = formState.base_id ? (tablesByBase[formState.base_id] ?? []) : [];
  const fieldOptions = formState.table_id ? (fieldsByTable[formState.table_id] ?? []) : [];

  const groupFieldOptions = fieldOptions;
  const valueFieldOptions = fieldOptions;
  const detailCard = detailCardId ? cards.find((card) => card.id === detailCardId) ?? null : null;
  const detailBaseName = detailCard
    ? bases.find((base) => base.id === detailCard.base_id)?.name
    : undefined;
  const detailTableName = detailCard
    ? tablesByBase[detailCard.base_id]?.find((table) => table.id === detailCard.table_id)?.name
    : undefined;
  const detailFields = detailCard ? fieldsByTable[detailCard.table_id] : undefined;
  const detailRefreshToken = detailCard ? (tableRefreshVersion[detailCard.table_id] ?? 0) : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Workspace Analytics</h2>
          <p className="text-sm text-gray-600">Build custom cards from any base and table.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add card
        </button>
      </div>

      <div className="mt-6">
        {loadingCards ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-500">
            No analytics cards yet. Add your first card to start visualizing data.
          </div>
        ) : (
          <GridLayout
            layout={layout}
            cols={12}
            rowHeight={40}
            margin={[16, 16]}
            isResizable
            compactType="vertical"
            draggableHandle=".analytics-card__drag"
            resizeHandles={["se"]}
            onDragStop={persistLayout}
            onResizeStop={persistLayout}
          >
            {cards.map((card) => {
              const baseName = bases.find((base) => base.id === card.base_id)?.name;
              const tableName = tablesByBase[card.base_id]?.find((table) => table.id === card.table_id)?.name;
              const fields = fieldsByTable[card.table_id];
              const refreshToken = tableRefreshVersion[card.table_id] ?? 0;
              return (
                <div key={card.id} className="h-full">
                  <AnalyticsCard
                    card={card}
                    baseName={baseName}
                    tableName={tableName}
                    fields={fields}
                    refreshToken={refreshToken}
                    onEdit={() => openEdit(card)}
                    onDelete={() => handleDeleteCard(card.id)}
                    onOpenDetails={() => setDetailCardId(card.id)}
                  />
                </div>
              );
            })}
          </GridLayout>
        )}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingCard ? "Edit analytics card" : "Add analytics card"}
                </h3>
                <p className="text-sm text-gray-600">Choose the base, table, and metric.</p>
              </div>
              <button
                onClick={closeEditor}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="text-sm font-medium text-gray-700">Card title</label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Active leads"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Chart type</label>
                  <select
                    value={formState.chart_type}
                    onChange={(e) => {
                      handleFormChange("chart_type", e.target.value);
                      handleFormChange("aggregation", "count");
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="number">Number</option>
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="pie">Pie</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Aggregation</label>
                  <select
                    value={formState.aggregation}
                    onChange={(e) => handleFormChange("aggregation", e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(formState.chart_type === "number" ? NUMBER_AGGREGATIONS : GROUP_AGGREGATIONS).map((option) => (
                      <option key={option} value={option}>
                        {option.replace("_", " ").toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Base</label>
                  <select
                    value={formState.base_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleFormChange("base_id", value);
                      handleFormChange("table_id", "");
                      handleFormChange("group_field_id", "");
                      handleFormChange("value_field_id", "");
                      void ensureTables(value);
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select base</option>
                    {baseOptions.map((base) => (
                      <option key={base.id} value={base.id}>{base.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Table</label>
                  <select
                    value={formState.table_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleFormChange("table_id", value);
                      handleFormChange("group_field_id", "");
                      handleFormChange("value_field_id", "");
                      void ensureFields(value);
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select table</option>
                    {tableOptions.map((table) => (
                      <option key={table.id} value={table.id}>{table.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formState.chart_type !== "number" && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Group by field</label>
                  <select
                    value={formState.group_field_id}
                    onChange={(e) => handleFormChange("group_field_id", e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                  <option value="">Select field</option>
                    {groupFieldOptions.map((field) => (
                      <option key={field.id} value={field.id}>{field.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">
                  {formState.chart_type === "number" ? "Value field (optional)" : "Value field (optional for sum)"}
                </label>
                <select
                  value={formState.value_field_id}
                  onChange={(e) => handleFormChange("value_field_id", e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {valueFieldOptions.map((field) => (
                    <option key={field.id} value={field.id}>{field.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to count records. Sum/avg need a numeric field.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                onClick={closeEditor}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCard}
                disabled={savingCard}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingCard ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingCard ? "Save changes" : "Create card"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailCard && (
        <AnalyticsCardDetailModal
          card={detailCard}
          baseName={detailBaseName}
          tableName={detailTableName}
          fields={detailFields}
          refreshToken={detailRefreshToken}
          onClose={() => setDetailCardId(null)}
        />
      )}
    </div>
  );
};

const useAnalyticsCardData = ({
  card,
  fields,
  refreshToken
}: {
  card: WorkspaceAnalyticsCard;
  fields?: FieldRow[];
  refreshToken: number;
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [numberValue, setNumberValue] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fieldsMap = useMemo(() => {
    return new Map((fields ?? []).map((field) => [field.id, field]));
  }, [fields]);

  const loadCardData = useCallback(async () => {
    if (!card.table_id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: records, error: recordError } = await supabase
        .from("records")
        .select("values")
        .eq("table_id", card.table_id);

      if (recordError) {
        throw recordError;
      }

      const rows = records ?? [];
      setLastUpdated(new Date().toLocaleTimeString());

      if (card.chart_type === "number") {
        if (card.aggregation === "count" || !card.value_field_id) {
          if (card.value_field_id) {
            const count = rows.filter((row) => row.values?.[card.value_field_id!] != null).length;
            setNumberValue(count);
          } else {
            setNumberValue(rows.length);
          }
        } else {
          const values = rows
            .map((row) => row.values?.[card.value_field_id ?? ""])
            .map((val) => toNumber(val))
            .filter((val): val is number => val !== null);

          if (values.length === 0) {
            setNumberValue(0);
          } else if (card.aggregation === "sum") {
            setNumberValue(values.reduce((sum, val) => sum + val, 0));
          } else if (card.aggregation === "avg") {
            setNumberValue(values.reduce((sum, val) => sum + val, 0) / values.length);
          } else if (card.aggregation === "min") {
            setNumberValue(Math.min(...values));
          } else if (card.aggregation === "max") {
            setNumberValue(Math.max(...values));
          }
        }
        return;
      }

      const groupField = card.group_field_id ? fieldsMap.get(card.group_field_id) : undefined;
      const metric = card.aggregation;
      const grouped = new Map<string, number>();

      rows.forEach((row) => {
        const rawGroup = card.group_field_id ? row.values?.[card.group_field_id] : null;
        const groupValues = formatGroupValue(rawGroup, groupField);
        let metricValue = 1;

        if (metric === "sum" && card.value_field_id) {
          const rawValue = row.values?.[card.value_field_id];
          const numeric = toNumber(rawValue);
          metricValue = numeric ?? 0;
        }

        groupValues.forEach((value) => {
          grouped.set(value, (grouped.get(value) || 0) + metricValue);
        });
      });

      let data = Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
      data = sortChartData(data, groupField?.type);

      if (card.chart_type === "pie") {
        const top = data.slice(0, 8);
        const remaining = data.slice(8).reduce((sum, item) => sum + item.value, 0);
        if (remaining > 0) {
          top.push({ name: "Other", value: remaining });
        }
        data = top;
      } else if (card.chart_type === "bar") {
        data = data.slice(0, 12);
      } else if (card.chart_type === "line") {
        data = data.slice(0, 20);
      }

      setChartData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      setChartData([]);
      setNumberValue(null);
    } finally {
      setLoading(false);
    }
  }, [card, fieldsMap]);

  useEffect(() => {
    void loadCardData();
  }, [loadCardData, refreshToken]);

  return { loading, error, chartData, numberValue, lastUpdated, refreshData: loadCardData, fieldsMap };
};

const AnalyticsCard = ({
  card,
  baseName,
  tableName,
  fields,
  onEdit,
  onDelete,
  refreshToken,
  onOpenDetails
}: {
  card: WorkspaceAnalyticsCard;
  baseName?: string;
  tableName?: string;
  fields?: FieldRow[];
  onEdit: () => void;
  onDelete: () => void;
  refreshToken: number;
  onOpenDetails: () => void;
}) => {
  const {
    loading,
    error,
    chartData,
    numberValue,
    lastUpdated,
    refreshData,
    fieldsMap
  } = useAnalyticsCardData({ card, fields, refreshToken });

  const valueField = card.value_field_id ? fieldsMap.get(card.value_field_id) : undefined;
  const valueLabel = valueField?.name || "Records";

  const renderChart = (showLegend: boolean) => {
    if (card.chart_type === "bar") {
      return (
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 10 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name={valueLabel} />
        </BarChart>
      );
    }
    if (card.chart_type === "line") {
      return (
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 10 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} name={valueLabel} />
        </LineChart>
      );
    }
    return (
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={showLegend ? 55 : 35}
          outerRadius={showLegend ? 110 : 70}
          paddingAngle={3}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    );
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    if (target.closest(".analytics-card__drag")) return;
    onOpenDetails();
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="flex h-full cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <button
              className="analytics-card__drag text-gray-400 hover:text-gray-600"
              title="Drag to move"
              onClick={(event) => event.stopPropagation()}
            >
              <GripVertical size={16} />
            </button>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
              <p className="text-xs text-gray-500">
                {baseName || "Base"} - {tableName || "Table"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                void refreshData();
              }}
              className="text-gray-400 hover:text-gray-600"
              title="Refresh data"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="text-gray-400 hover:text-gray-600"
              title="Edit card"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="text-gray-400 hover:text-red-600"
              title="Delete card"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading data...
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : card.chart_type === "number" ? (
            <div className="flex h-full flex-col justify-between">
              <div className="text-4xl font-semibold text-gray-900">
                {numberValue !== null ? formatNumber(numberValue) : "--"}
              </div>
              <div className="text-xs text-gray-500">Aggregation: {card.aggregation.toUpperCase()}</div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              No data to display
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {renderChart(false)}
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-400">
          {lastUpdated ? `Updated ${lastUpdated}` : "Waiting for data"}
        </div>
      </div>
    </>
  );
};

const AnalyticsCardDetailModal = ({
  card,
  baseName,
  tableName,
  fields,
  refreshToken,
  onClose
}: {
  card: WorkspaceAnalyticsCard;
  baseName?: string;
  tableName?: string;
  fields?: FieldRow[];
  refreshToken: number;
  onClose: () => void;
}) => {
  const {
    loading,
    error,
    chartData,
    numberValue,
    lastUpdated,
    refreshData,
    fieldsMap
  } = useAnalyticsCardData({ card, fields, refreshToken });

  const groupField = card.group_field_id ? fieldsMap.get(card.group_field_id) : undefined;
  const valueField = card.value_field_id ? fieldsMap.get(card.value_field_id) : undefined;
  const groupLabel = groupField?.name || "Record";
  const valueLabel = valueField?.name || "Records";
  const totalValue = card.chart_type === "number"
    ? (numberValue ?? 0)
    : chartData.reduce((sum, item) => sum + item.value, 0);
  const maxValue = card.chart_type === "number"
    ? (numberValue ?? 0)
    : chartData.length
      ? Math.max(...chartData.map((item) => item.value))
      : 0;
  const topSegments = card.chart_type === "number" ? [] : chartData.slice(0, 6);
  const dataPointCount = chartData.length || (numberValue !== null ? 1 : 0);
  const legendItems = (() => {
    if (card.chart_type === "number") return [];
    if (card.chart_type === "bar") {
      return [{ label: valueLabel, value: totalValue, color: CHART_COLORS[0] }];
    }
    if (card.chart_type === "line") {
      return [{ label: valueLabel, value: totalValue, color: CHART_COLORS[1] }];
    }
    return chartData.map((item, index) => ({
      label: item.name,
      value: item.value,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  })();

  const renderChart = (showLegend: boolean) => {
    if (card.chart_type === "bar") {
      return (
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 10 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name={valueLabel} />
        </BarChart>
      );
    }
    if (card.chart_type === "line") {
      return (
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 10 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} name={valueLabel} />
        </LineChart>
      );
    }
    return (
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={showLegend ? 55 : 35}
          outerRadius={showLegend ? 110 : 70}
          paddingAngle={3}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    );
  };

  return (
    <div className="fixed inset-0 z-[90] flex bg-slate-900/70 backdrop-blur-sm">
      <div className="flex w-full items-start justify-center overflow-y-auto px-6 py-8">
        <div className="flex h-full w-full max-w-[1600px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 px-8 py-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span className="text-gray-900">Workspace analytics</span>
                <span className="text-gray-300">/</span>
                <span className="text-gray-500">{baseName || "Base"} / {tableName || "Table"}</span>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">{card.title}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {card.chart_type.toUpperCase()}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {card.aggregation.toUpperCase()}
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {dataPointCount} data point{dataPointCount === 1 ? "" : "s"}
                </span>
                {lastUpdated && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <RefreshCw size={12} />
                    Updated {lastUpdated}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void refreshData()}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                <X size={16} />
                Close
              </button>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-12 gap-6 overflow-y-auto px-8 py-8">
            <div className="col-span-12 xl:col-span-8 flex flex-col gap-4">
              <div className="min-h-[520px] rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Data visual</div>
                    <p className="text-sm text-gray-600">Full-width view with the live chart</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    {card.chart_type === "number" ? "Metric" : "Chart"}
                  </span>
                </div>
                <div className="mt-4 h-[440px] sm:h-[480px] lg:h-[520px]">
                  {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading data...
                    </div>
                  ) : error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
                  ) : card.chart_type === "number" ? (
                    <div className="flex h-full flex-col justify-between rounded-xl bg-gray-50 p-6">
                      <div className="text-6xl font-semibold text-gray-900">
                        {numberValue !== null ? formatNumber(numberValue) : "--"}
                      </div>
                      <div className="text-sm text-gray-500">Aggregation: {card.aggregation.toUpperCase()}</div>
                    </div>
                  ) : chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                      No data to display
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {renderChart(true)}
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Total</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {formatNumber(totalValue)}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Peak</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {formatNumber(maxValue)}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Data points</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {dataPointCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
              {legendItems.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Legend & breakdown</h4>
                    <span className="text-xs text-gray-500">{legendItems.length} items</span>
                  </div>
                  <div className="mt-3 max-h-[240px] space-y-2 overflow-y-auto pr-1">
                    {legendItems.map((item, index) => {
                      const showPercent = card.chart_type === "pie";
                      const percent = showPercent && totalValue > 0
                        ? Math.round((item.value / totalValue) * 100)
                        : 0;
                      return (
                        <div key={`${item.label}-${index}`} className="flex items-center justify-between text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>
                          <span className="text-gray-500">
                            {formatNumber(item.value)}{showPercent ? ` (${percent}%)` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-900">Card details</h4>
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                  <div>Type: {card.chart_type.toUpperCase()}</div>
                  <div>Aggregation: {card.aggregation.toUpperCase()}</div>
                  {card.chart_type !== "number" && (
                    <div>Grouped by: {groupLabel}</div>
                  )}
                  {card.value_field_id && (
                    <div>Value field: {valueLabel}</div>
                  )}
                  <div>Data points: {dataPointCount}</div>
                  <div>Table: {tableName || "Table"}</div>
                  <div>Base: {baseName || "Base"}</div>
                </div>
              </div>

              {topSegments.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-gray-900">Top segments</h4>
                  <div className="mt-3 space-y-2">
                    {topSegments.map((segment, index) => {
                      const percent = totalValue > 0 ? Math.round((segment.value / totalValue) * 100) : 0;
                      return (
                        <div key={segment.name} className="flex items-center justify-between text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span>{segment.name}</span>
                          </div>
                          <span>{formatNumber(segment.value)} ({percent}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-900">Last refresh</h4>
                <p className="mt-2 text-sm text-gray-600">
                  {lastUpdated ? `Updated ${lastUpdated}` : "Not loaded yet"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};