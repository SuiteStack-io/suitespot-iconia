
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const checks: Record<string, any> = {};
  let overallStatus: "healthy" | "degraded" | "error" = "healthy";

  // 1. API Connection
  try {
    const start = Date.now();
    await channexRequest("GET", "/api/v1/properties?limit=1");
    checks.api_connection = { status: "ok", latency_ms: Date.now() - start };
  } catch (err: any) {
    checks.api_connection = { status: "error", error: err.message };
    overallStatus = "error";
  }

  // 2. Sync Errors
  try {
    const { count } = await supabase
      .from("channex_mappings")
      .select("id", { count: "exact", head: true })
      .eq("sync_status", "error");
    const c = count || 0;
    checks.sync_errors = { status: c > 0 ? "warning" : "ok", count: c };
    if (c > 0 && overallStatus === "healthy") overallStatus = "degraded";
  } catch {
    checks.sync_errors = { status: "error", count: -1 };
  }

  // 3. Unacknowledged Bookings
  try {
    const { count } = await supabase
      .from("channex_bookings")
      .select("id", { count: "exact", head: true })
      .eq("acknowledged", false);
    const c = count || 0;
    checks.unacked_bookings = { status: c > 0 ? "warning" : "ok", count: c };
    if (c > 0 && overallStatus === "healthy") overallStatus = "degraded";
  } catch {
    checks.unacked_bookings = { status: "error", count: -1 };
  }

  // 4. Recent Failures (last 24h)
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("channex_sync_logs")
      .select("id", { count: "exact", head: true })
      .eq("success", false)
      .gte("created_at", since);
    const c = count || 0;
    checks.recent_failures = { status: c > 0 ? "warning" : "ok", count: c };
    if (c > 0 && overallStatus === "healthy") overallStatus = "degraded";
  } catch {
    checks.recent_failures = { status: "error", count: -1 };
  }

  // 5. Unresolved Alerts
  try {
    const { count } = await supabase
      .from("channex_alerts")
      .select("id", { count: "exact", head: true })
      .eq("resolved", false);
    const c = count || 0;
    checks.unresolved_alerts = { status: c > 0 ? "warning" : "ok", count: c };
    if (c > 0 && overallStatus === "healthy") overallStatus = "degraded";
  } catch {
    checks.unresolved_alerts = { status: "error", count: -1 };
  }

  // 6. Queue Backlog
  try {
    const { count: pendingCount } = await supabase
      .from("channex_sync_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    const { count: failedCount } = await supabase
      .from("channex_sync_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    const p = pendingCount || 0;
    const f = failedCount || 0;
    checks.queue_backlog = { status: (p > 10 || f > 0) ? "warning" : "ok", pending: p, failed: f };
    if ((p > 10 || f > 0) && overallStatus === "healthy") overallStatus = "degraded";
  } catch {
    checks.queue_backlog = { status: "error", pending: -1, failed: -1 };
  }

  return new Response(
    JSON.stringify({ status: overallStatus, checks, checked_at: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
