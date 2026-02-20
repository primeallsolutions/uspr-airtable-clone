import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RecordEmailService } from "@/lib/services/record-email-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getSupabaseAdmin = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/**
 * GET /api/emails/stats
 * Get email statistics for a record or workspace
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("record_id");
    const workspaceId = searchParams.get("workspace_id");

    if (!recordId && !workspaceId) {
      return NextResponse.json(
        { error: "record_id or workspace_id is required" },
        { status: 400 }
      );
    }

    // Verify user authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get stats for a single record
    if (recordId) {
      // Verify access to record
      const { data: record } = await supabase
        .from("records")
        .select(`id, table_id, tables!inner(base_id, bases!inner(workspace_id))`)
        .eq("id", recordId)
        .single();

      if (!record) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      // Check workspace membership
      const workspaceIdFromRecord = (record as Record<string, unknown>).tables 
        ? ((record as Record<string, unknown>).tables as Record<string, unknown>).bases 
          ? (((record as Record<string, unknown>).tables as Record<string, unknown>).bases as Record<string, unknown>).workspace_id 
          : null
        : null;

      const { data: member } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceIdFromRecord)
        .eq("user_id", user.id)
        .single();

      if (!member) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const stats = await RecordEmailService.getEmailStats(recordId);

      // Get additional detailed stats
      const { data: emails } = await supabase
        .from("record_emails")
        .select("id, direction, status, created_at")
        .eq("record_id", recordId);

      const detailedStats = {
        ...stats,
        total_inbound: emails?.filter(e => e.direction === "inbound").length || 0,
        total_outbound: emails?.filter(e => e.direction === "outbound").length || 0,
        pending: emails?.filter(e => e.status === "pending").length || 0,
        failed: emails?.filter(e => e.status === "failed").length || 0,
      };

      return NextResponse.json({ stats: detailedStats });
    }

    // Get stats for a workspace (aggregate)
    if (workspaceId) {
      // Check workspace membership
      const { data: member } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();

      if (!member) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Get all bases in workspace
      const { data: bases } = await supabase
        .from("bases")
        .select("id")
        .eq("workspace_id", workspaceId);

      if (!bases || bases.length === 0) {
        return NextResponse.json({
          stats: {
            total_sent: 0,
            total_delivered: 0,
            total_opened: 0,
            total_clicked: 0,
            total_bounced: 0,
            open_rate: 0,
            click_rate: 0,
          },
        });
      }

      const baseIds = bases.map(b => b.id);

      // Get all tables in these bases
      const { data: tables } = await supabase
        .from("tables")
        .select("id")
        .in("base_id", baseIds);

      if (!tables || tables.length === 0) {
        return NextResponse.json({
          stats: {
            total_sent: 0,
            total_delivered: 0,
            total_opened: 0,
            total_clicked: 0,
            total_bounced: 0,
            open_rate: 0,
            click_rate: 0,
          },
        });
      }

      const tableIds = tables.map(t => t.id);

      // Get all records in these tables
      const { data: records } = await supabase
        .from("records")
        .select("id")
        .in("table_id", tableIds);

      if (!records || records.length === 0) {
        return NextResponse.json({
          stats: {
            total_sent: 0,
            total_delivered: 0,
            total_opened: 0,
            total_clicked: 0,
            total_bounced: 0,
            open_rate: 0,
            click_rate: 0,
          },
        });
      }

      const recordIds = records.map(r => r.id);

      // Get aggregate email stats
      const { data: emails, error: emailError } = await supabase
        .from("record_emails")
        .select("id, direction, status, opened_at, clicked_at")
        .in("record_id", recordIds)
        .eq("direction", "outbound");

      if (emailError) {
        throw new Error("Failed to fetch emails");
      }

      const totalSent = emails?.length || 0;
      const totalDelivered = emails?.filter(e => 
        ["delivered", "opened", "clicked"].includes(e.status)
      ).length || 0;
      const totalOpened = emails?.filter(e => e.opened_at !== null).length || 0;
      const totalClicked = emails?.filter(e => e.clicked_at !== null).length || 0;
      const totalBounced = emails?.filter(e => e.status === "bounced").length || 0;

      const stats = {
        total_sent: totalSent,
        total_delivered: totalDelivered,
        total_opened: totalOpened,
        total_clicked: totalClicked,
        total_bounced: totalBounced,
        open_rate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
        click_rate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
      };

      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentEmails } = await supabase
        .from("record_emails")
        .select("id, direction, status, created_at")
        .in("record_id", recordIds)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      // Get top templates
      const { data: templateUsage } = await supabase
        .from("record_emails")
        .select("template_id, email_templates(name)")
        .in("record_id", recordIds)
        .eq("direction", "outbound")
        .not("template_id", "is", null);

      const templateStats = new Map<string, { name: string; count: number }>();
      templateUsage?.forEach((e) => {
        const templates = e.email_templates as unknown as { name: string }[] | null;
        const template = templates?.[0];
        if (template && e.template_id) {
          const existing = templateStats.get(e.template_id as string);
          if (existing) {
            existing.count++;
          } else {
            templateStats.set(e.template_id as string, { name: template.name, count: 1 });
          }
        }
      });

      return NextResponse.json({
        stats,
        recent_emails: recentEmails?.slice(0, 10) || [],
        recent_count: recentEmails?.length || 0,
        top_templates: Array.from(templateStats.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching email stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch email stats" },
      { status: 500 }
    );
  }
}
