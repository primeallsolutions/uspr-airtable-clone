export type WorkspaceAnalyticsChartType = 'number' | 'bar' | 'line' | 'pie';

export type WorkspaceAnalyticsAggregation = 'count' | 'sum' | 'avg' | 'min' | 'max';

export type AnalyticsCardLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WorkspaceAnalyticsCard = {
  id: string;
  workspace_id: string;
  base_id: string;
  table_id: string;
  group_field_id: string | null;
  value_field_id: string | null;
  title: string;
  chart_type: WorkspaceAnalyticsChartType;
  aggregation: WorkspaceAnalyticsAggregation;
  layout: AnalyticsCardLayout | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
