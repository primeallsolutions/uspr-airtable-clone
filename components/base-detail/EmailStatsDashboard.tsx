"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Send,
  Eye,
  MousePointer,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileText,
  Loader2,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import type { EmailStats } from "@/lib/types/base-detail";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface EmailStatsDashboardProps {
  workspaceId?: string;
  recordId?: string;
  compact?: boolean;
}

interface WorkspaceStats extends EmailStats {
  recent_count?: number;
  top_templates?: Array<{ name: string; count: number }>;
}

export const EmailStatsDashboard = ({
  workspaceId,
  recordId,
  compact = false,
}: EmailStatsDashboardProps) => {
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        const url = new URL("/api/emails/stats", window.location.origin);
        if (recordId) {
          url.searchParams.set("record_id", recordId);
        } else if (workspaceId) {
          url.searchParams.set("workspace_id", workspaceId);
        } else {
          return;
        }

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch stats");
        }

        const data = await response.json();
        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [workspaceId, recordId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statCards = [
    {
      label: "Total Sent",
      value: stats.total_sent,
      icon: Send,
      color: "blue",
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      label: "Delivered",
      value: stats.total_delivered,
      icon: CheckCircle,
      color: "green",
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      label: "Opened",
      value: stats.total_opened,
      icon: Eye,
      color: "purple",
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      label: "Clicked",
      value: stats.total_clicked,
      icon: MousePointer,
      color: "indigo",
      bgColor: "bg-indigo-100",
      iconColor: "text-indigo-600",
    },
    {
      label: "Bounced",
      value: stats.total_bounced,
      icon: XCircle,
      color: "red",
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      label: "Open Rate",
      value: `${stats.open_rate.toFixed(1)}%`,
      icon: TrendingUp,
      color: "emerald",
      bgColor: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
  ];

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {statCards.slice(0, 3).map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200"
          >
            <div className={`p-1.5 rounded ${stat.bgColor}`}>
              <stat.icon className={`w-3.5 h-3.5 ${stat.iconColor}`} />
            </div>
            <div>
              <div className="text-xs text-gray-500">{stat.label}</div>
              <div className="text-sm font-semibold text-gray-900">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Open Rate Progress */}
      {stats.total_sent > 0 && (
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Email Performance</h4>
          <div className="space-y-3">
            {/* Delivery Rate */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Delivery Rate</span>
                <span>{stats.total_sent > 0 ? ((stats.total_delivered / stats.total_sent) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${stats.total_sent > 0 ? (stats.total_delivered / stats.total_sent) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Open Rate */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Open Rate</span>
                <span>{stats.open_rate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(stats.open_rate, 100)}%` }}
                />
              </div>
            </div>

            {/* Click Rate */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Click Rate</span>
                <span>{stats.click_rate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${Math.min(stats.click_rate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Templates (if workspace stats) */}
      {stats.top_templates && stats.top_templates.length > 0 && (
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-medium text-gray-700">Top Templates</h4>
          </div>
          <div className="space-y-2">
            {stats.top_templates.map((template, idx) => (
              <div
                key={template.name}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center text-xs font-medium text-gray-500 bg-gray-200 rounded">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-gray-700">{template.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{template.count} uses</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.total_sent === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <Mail className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-lg font-medium text-gray-700">No emails sent yet</p>
          <p className="text-sm mt-1">Start sending emails to see your performance stats.</p>
        </div>
      )}
    </div>
  );
};
