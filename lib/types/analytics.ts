export type WorkspaceAnalyticsChartType = 'number' | 'bar' | 'line' | 'pie';

export type WorkspaceAnalyticsAggregation = 'count' | 'sum' | 'avg' | 'min' | 'max';

export type WorkspaceAnalyticsFilterMatch = 'all' | 'any';

export type WorkspaceAnalyticsFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'within_last_days'
  | 'is_empty'
  | 'is_not_empty';

export type WorkspaceAnalyticsFilterTarget = 'field' | 'record_updated_at';

export type WorkspaceAnalyticsFilter = {
  id: string;
  target: WorkspaceAnalyticsFilterTarget;
  field_id: string | null;
  operator: WorkspaceAnalyticsFilterOperator;
  value: string;
};

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
  filters: WorkspaceAnalyticsFilter[];
  filter_match: WorkspaceAnalyticsFilterMatch;
  layout: AnalyticsCardLayout | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
