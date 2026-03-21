import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getFirstName(fullName: string): string {
  if (!fullName || fullName === "Team Member") return "there";
  return fullName.split(" ")[0];
}

function formatDateFull(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRoomDisplay(unit: any): string {
  if (!unit) return "Unassigned";
  const roomName = unit.booking_com_name || unit.name || "Unknown";
  const roomNum = unit.unit_number || "";
  return roomNum ? `${roomName} (#${roomNum})` : roomName;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "EGP") return `EGP ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

async function getRecipients(supabase: any, propertyId?: string): Promise<{ email: string; name: string }[]> {
  const { data: settings } = await supabase
    .from("user_notification_settings")
    .select("user_id")
    .eq("daily_summary_email", true);

  if (!settings || settings.length === 0) return [];

  const userIds = settings.map((s: any) => s.user_id);
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) { console.error("Error fetching users:", error); return []; }

  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  const { data: userRoles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
  const roleMap = new Map((userRoles || []).map((r: any) => [r.user_id, r.role]));

  let candidates: { user_id: string; email: string; name: string; role: string }[] = [];
  for (const uid of userIds) {
    const user = users?.find((u: any) => u.id === uid);
    if (user?.email) {
      candidates.push({ user_id: uid, email: user.email, name: profileMap.get(uid) || "Team Member", role: roleMap.get(uid) || "user" });
    }
  }

  if (propertyId && candidates.length > 0) {
    const candidateIds = candidates.map(c => c.user_id);
    const { data: allAccess } = await supabase.from("user_property_access").select("user_id, property_id").in("user_id", candidateIds);
    const accessList = allAccess || [];
    candidates = candidates.filter(user => {
      const entries = accessList.filter((a: any) => a.user_id === user.user_id);
      if (entries.length === 0 && user.role === "admin") return true;
      return entries.some((a: any) => a.property_id === propertyId);
    });
  }

  return candidates.map(c => ({ email: c.email, name: c.name }));
}

function getWeekRange(today: Date): { start: string; end: string; startDate: Date; endDate: Date } {
  const end = new Date(today);
  while (end.getDay() !== 3) end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0], startDate: start, endDate: end };
}

interface WeekData {
  label: string;
  startDate: Date;
  endDate: Date;
  start: string;
  end: string;
  occupancyRate: number;
  roomNightsSold: number;
  roomNightsAvailable: number;
  newBookings: number;
  revenue: number;
  isCurrent: boolean;
}

async function computeWeekOccupancy(
  supabase: any, propertyId: string, unitIds: string[], startDate: Date, endDate: Date
): Promise<{ avgRate: number; sold: number; available: number; dailyData: { date: string; occupied: number; available: number; rate: number }[] }> {
  const dailyData: { date: string; occupied: number; available: number; rate: number }[] = [];
  let totalSold = 0;
  let totalAvailable = 0;
  const d = new Date(startDate);

  while (d <= endDate) {
    const ds = d.toISOString().split("T")[0];

    const { data: inHouse } = await supabase
      .from("reservations").select("id")
      .lte("check_in_date", ds).gt("check_out_date", ds)
      .in("status", ["confirmed", "checked-in"])
      .eq("property_id", propertyId);

    const { data: blocked } = await supabase
      .from("blocked_dates").select("unit_id")
      .eq("blocked_date", ds)
      .in("unit_id", unitIds);

    const blockedCount = new Set((blocked || []).map((b: any) => b.unit_id)).size;
    const available = Math.max(1, unitIds.length - blockedCount);
    const occupied = inHouse?.length || 0;
    const rate = (occupied / available) * 100;

    dailyData.push({ date: ds, occupied, available, rate });
    totalSold += occupied;
    totalAvailable += available;
    d.setDate(d.getDate() + 1);
  }

  const avgRate = totalAvailable > 0 ? (totalSold / totalAvailable) * 100 : 0;
  return { avgRate, sold: totalSold, available: totalAvailable, dailyData };
}

async function computeWeekBookings(supabase: any, propertyId: string, start: string, end: string): Promise<number> {
  const { data } = await supabase
    .from("reservations").select("id")
    .gte("created_at", `${start}T00:00:00`)
    .lte("created_at", `${end}T23:59:59`)
    .eq("property_id", propertyId);
  return data?.length || 0;
}

async function computeWeekRevenue(supabase: any, propertyId: string, start: string, end: string): Promise<number> {
  const { data } = await supabase
    .from("reservations")
    .select("total_price, commission_amount")
    .neq("status", "Cancelled")
    .is("cancelled_at", null)
    .gte("check_in_date", start)
    .lte("check_in_date", end)
    .eq("property_id", propertyId);

  let total = 0;
  for (const r of (data || [])) {
    const gross = r.total_price || 0;
    const comm = r.commission_amount || 0;
    total += gross - comm;
  }
  return total;
}

function renderBarChart(items: { label: string; value: number; displayValue: string; isCurrent: boolean }[]): string {
  const maxVal = Math.max(...items.map(i => i.value), 1);

  return items.map(item => {
    const pct = Math.max(2, (item.value / maxVal) * 100);
    const barBg = item.isCurrent ? "#334155" : "#1e293b";
    const borderLeft = item.isCurrent ? "border-left:3px solid #3b82f6;" : "";

    return `
      <tr>
        <td style="padding:4px 8px 4px 0;font-size:12px;color:#64748b;white-space:nowrap;width:120px;">${item.label}</td>
        <td style="padding:4px 0;width:100%;">
          <div style="background:#e2e8f0;border-radius:4px;height:24px;width:100%;position:relative;">
            <div style="background:${barBg};border-radius:4px;height:24px;width:${pct.toFixed(1)}%;${borderLeft}min-width:2px;"></div>
          </div>
        </td>
        <td style="padding:4px 0 4px 8px;font-size:13px;font-weight:bold;color:#1e293b;white-space:nowrap;">${item.displayValue}</td>
      </tr>`;
  }).join("");
}

function renderWoWCard(current: number, previous: number, label: string, formatFn: (v: number) => string): string {
  if (previous === 0 && current === 0) {
    return `<div style="background:#f1f5f9;border-radius:8px;border:1px solid #cbd5e1;padding:12px;margin:8px 0 20px;">
      <span style="font-size:13px;color:#64748b;">No data for comparison</span></div>`;
  }

  const change = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
  const isPositive = change >= 0;
  const arrow = isPositive ? "↑" : "↓";
  const color = isPositive ? "#16a34a" : "#dc2626";

  return `
    <div style="background:#f1f5f9;border-radius:8px;border:1px solid #cbd5e1;padding:12px;margin:8px 0 20px;">
      <span style="font-size:16px;font-weight:bold;color:${color};">${arrow} ${Math.abs(change).toFixed(1)}%</span>
      <span style="font-size:13px;color:#64748b;margin-left:8px;">week-over-week</span>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">This week: ${formatFn(current)} vs Last week: ${formatFn(previous)}</div>
    </div>`;
}

interface SourceBreakdown { [source: string]: number }
function breakdownBySource(data: any[]): SourceBreakdown {
  const bd: SourceBreakdown = {};
  for (const r of data) { const src = r.source || r.channel || "Unknown"; bd[src] = (bd[src] || 0) + 1; }
  return bd;
}
function formatBreakdown(bd: SourceBreakdown): string {
  return Object.entries(bd).map(([k, v]) => `${k}: ${v}`).join(", ") || "—";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const { start, end, startDate, endDate } = getWeekRange(today);

    const { data: property } = await supabase
      .from("properties").select("id, name, currency")
      .eq("is_default", true).single();

    if (!property) {
      return new Response(JSON.stringify({ error: "No default property" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currency = property.currency || "USD";
    const recipients = await getRecipients(supabase, property.id);
    if (recipients.length === 0) {
      await supabase.from("summary_report_log").insert({
        report_type: "weekly", property_id: property.id, report_date: todayStr,
        status: "sent", error_message: "No recipients configured", sent_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ success: true, message: "No recipients" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all units for property
    const { data: allUnits } = await supabase.from("units").select("id").eq("property_id", property.id);
    const unitIds = (allUnits || []).map((u: any) => u.id);

    // Check-ins for the week (with room details)
    const { data: checkIns } = await supabase
      .from("reservations")
      .select("guest_names, source, channel, units!unit_id(name, booking_com_name, unit_number)")
      .gte("check_in_date", start).lte("check_in_date", end)
      .in("status", ["confirmed", "checked-in"])
      .eq("property_id", property.id);

    // Check-outs for the week (with room details)
    const { data: checkOuts } = await supabase
      .from("reservations")
      .select("guest_names, source, channel, units!unit_id(name, booking_com_name, unit_number)")
      .gte("check_out_date", start).lte("check_out_date", end)
      .in("status", ["confirmed", "checked-in", "checked-out", "completed"])
      .eq("property_id", property.id);

    // New bookings with source breakdown
    const { data: newBookings } = await supabase
      .from("reservations").select("source, channel")
      .gte("created_at", `${start}T00:00:00`).lte("created_at", `${end}T23:59:59`)
      .eq("property_id", property.id);

    // Occupancy for current week (excluding blocked rooms)
    const occData = await computeWeekOccupancy(supabase, property.id, unitIds, startDate, endDate);
    const highestDay = occData.dailyData.reduce((a, b) => a.rate > b.rate ? a : b);
    const lowestDay = occData.dailyData.reduce((a, b) => a.rate < b.rate ? a : b);

    // ===== 4-WEEK TRENDS =====
    const weeks: WeekData[] = [];
    for (let w = 3; w >= 0; w--) {
      const wEnd = new Date(endDate);
      wEnd.setDate(wEnd.getDate() - w * 7);
      const wStart = new Date(wEnd);
      wStart.setDate(wStart.getDate() - 6);
      const ws = wStart.toISOString().split("T")[0];
      const we = wEnd.toISOString().split("T")[0];

      const wOcc = await computeWeekOccupancy(supabase, property.id, unitIds, wStart, wEnd);
      const wBookings = await computeWeekBookings(supabase, property.id, ws, we);
      const wRevenue = await computeWeekRevenue(supabase, property.id, ws, we);

      weeks.push({
        label: `${formatDateShort(wStart)}–${formatDateShort(wEnd)}`,
        startDate: wStart, endDate: wEnd, start: ws, end: we,
        occupancyRate: wOcc.avgRate, roomNightsSold: wOcc.sold, roomNightsAvailable: wOcc.available,
        newBookings: wBookings, revenue: wRevenue, isCurrent: w === 0,
      });
    }

    const currentWeek = weeks[weeks.length - 1];
    const lastWeek = weeks[weeks.length - 2];

    // ===== BUILD EMAIL =====
    const tableStyle = 'style="width:100%;border-collapse:collapse;margin:8px 0 16px 0;"';
    const thStyle = 'class="dark-th" style="background:#1e293b !important;color:#ffffff !important;padding:8px 12px;text-align:left;font-size:13px;"';
    const tdStyle = (i: number) => `style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;background:${i % 2 === 0 ? '#f9fafb' : '#fff'};"`;

    const ciRows = (checkIns || []).length > 0
      ? (checkIns || []).map((ci: any, i: number) => `<tr><td ${tdStyle(i)}>${ci.guest_names?.[0] || "N/A"}</td><td ${tdStyle(i)}>${formatRoomDisplay(ci.units)}</td><td ${tdStyle(i)}>${ci.source || ci.channel || "N/A"}</td></tr>`).join("")
      : `<tr><td colspan="3" style="padding:12px;color:#888;">No check-ins this week</td></tr>`;

    const coRows = (checkOuts || []).length > 0
      ? (checkOuts || []).map((co: any, i: number) => `<tr><td ${tdStyle(i)}>${co.guest_names?.[0] || "N/A"}</td><td ${tdStyle(i)}>${formatRoomDisplay(co.units)}</td><td ${tdStyle(i)}>${co.source || co.channel || "N/A"}</td></tr>`).join("")
      : `<tr><td colspan="3" style="padding:12px;color:#888;">No check-outs this week</td></tr>`;

    const bookingBreakdown = breakdownBySource(newBookings || []);

    // Occupancy trend bar chart
    const occChartRows = renderBarChart(weeks.map(w => ({
      label: w.label, value: w.occupancyRate, displayValue: `${w.occupancyRate.toFixed(1)}%`, isCurrent: w.isCurrent,
    })));

    // Bookings trend bar chart
    const bookingsChartRows = renderBarChart(weeks.map(w => ({
      label: w.label, value: w.newBookings, displayValue: `${w.newBookings}`, isCurrent: w.isCurrent,
    })));

    // Revenue trend bar chart
    const revenueChartRows = renderBarChart(weeks.map(w => ({
      label: w.label, value: w.revenue, displayValue: formatCurrency(w.revenue, currency), isCurrent: w.isCurrent,
    })));

    const weeklyHeaderHTML = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#222;">
        <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);padding:20px 24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">SuiteSpot Weekly Summary</h1>
          <p style="color:rgba(255,255,255,0.9);margin:4px 0 0;font-size:14px;">${property.name} — ${formatDateFull(startDate)} to ${formatDateFull(endDate)}</p>
        </div>`;

    const weeklyBodyHTML = `
          <h2 style="font-size:16px;color:#1e293b;margin:0 0 8px;">📥 Check-ins (${(checkIns || []).length})</h2>
          <table ${tableStyle}>
            <tr><th ${thStyle}>Guest Name</th><th ${thStyle}>Room</th><th ${thStyle}>Source</th></tr>
            ${ciRows}
          </table>

          <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">📤 Check-outs (${(checkOuts || []).length})</h2>
          <table ${tableStyle}>
            <tr><th ${thStyle}>Guest Name</th><th ${thStyle}>Room</th><th ${thStyle}>Source</th></tr>
            ${coRows}
          </table>

          <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">🏠 Occupancy</h2>
          <div style="background:#f1f5f9;padding:16px;border-radius:8px;border:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td style="padding:4px 0;font-size:14px;">Average Occupancy</td><td style="text-align:right;font-weight:bold;font-size:14px;">${occData.avgRate.toFixed(1)}%</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;">Highest Day</td><td style="text-align:right;font-weight:bold;font-size:14px;">${highestDay.date} (${highestDay.rate.toFixed(1)}%)</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;">Lowest Day</td><td style="text-align:right;font-weight:bold;font-size:14px;">${lowestDay.date} (${lowestDay.rate.toFixed(1)}%)</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;">Room Nights</td><td style="text-align:right;font-weight:bold;font-size:14px;">${occData.sold} sold / ${occData.available} available</td></tr>
            </table>
          </div>

          <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">📊 New Bookings: ${(newBookings || []).length}</h2>
          <p style="font-size:13px;color:#555;margin:0 0 16px;">By source: ${formatBreakdown(bookingBreakdown)}</p>

          <hr style="border:none;border-top:2px solid #e2e8f0;margin:24px 0;" />

          <h2 style="font-size:18px;color:#1e293b;margin:0 0 16px;">📊 Performance — Past 4 Weeks</h2>

          <h3 style="font-size:15px;color:#1e293b;margin:0 0 8px;">Occupancy Trend</h3>
          <table style="width:100%;border-collapse:collapse;">
            ${occChartRows}
          </table>
          ${renderWoWCard(currentWeek.occupancyRate, lastWeek.occupancyRate, "occupancy", v => `${v.toFixed(1)}%`)}

          <h3 style="font-size:15px;color:#1e293b;margin:0 0 8px;">New Bookings Trend</h3>
          <table style="width:100%;border-collapse:collapse;">
            ${bookingsChartRows}
          </table>
          ${renderWoWCard(currentWeek.newBookings, lastWeek.newBookings, "bookings", v => `${v} bookings`)}

          <h3 style="font-size:15px;color:#1e293b;margin:0 0 8px;">Revenue Trend</h3>
          <table style="width:100%;border-collapse:collapse;">
            ${revenueChartRows}
          </table>
          ${renderWoWCard(currentWeek.revenue, lastWeek.revenue, "revenue", v => formatCurrency(v, currency))}

          <p style="margin:24px 0 0;font-size:11px;color:#999;">Generated automatically by SuiteSpot PMS — ${new Date().toISOString()}</p>`;

    // Send emails
    const sentEmails: string[] = [];
    let errorCount = 0;

    const greetingStartDate = startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const greetingEndDate = endDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    for (const recipient of recipients) {
      try {
        const firstName = getFirstName(recipient.name);
        const greeting = `<p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.5;">Hi ${firstName}, here's your weekly summary for ${property.name} from ${greetingStartDate} to ${greetingEndDate}.</p>`;
        const personalizedHTML = `${weeklyHeaderHTML}<div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">${greeting}${weeklyBodyHTML}</div></div>`;

        const resp = await resend.emails.send({
          from: "Mia — SuiteSpot AI <ai-assistant@bookings.suitespoteg.com>",
          to: [recipient.email],
          subject: `Weekly Summary — ${property.name} — ${formatDateFull(startDate)} to ${formatDateFull(endDate)}`,
          html: personalizedHTML,
        });
        console.log(`Weekly email sent to ${recipient.email}:`, JSON.stringify(resp));
        sentEmails.push(recipient.email);
      } catch (e) {
        console.error(`Error sending weekly to ${recipient.email}:`, e);
        errorCount++;
      }
      if (recipients.indexOf(recipient) < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    await supabase.from("summary_report_log").insert({
      report_type: "weekly", property_id: property.id, report_date: todayStr,
      recipients: sentEmails, pdf_url: null,
      status: errorCount === 0 ? "sent" : errorCount < recipients.length ? "partial" : "failed",
      error_message: errorCount > 0 ? `${errorCount} emails failed` : null,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, sent: sentEmails.length, errors: errorCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in generate-weekly-summary:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

Deno.serve(handler);
