import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { getPropertySettings } from "../_shared/property-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatCurrency(amount: number, currency = "EGP"): string {
  if (currency === "EGP") return `EGP ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getFirstName(fullName: string): string {
  if (!fullName || fullName === "Team Member") return "there";
  return fullName.split(" ")[0];
}

function getMonthRange(year: number, month: number): { start: string; end: string; days: number } {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, days: lastDay };
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fullMonthLabel(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
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

async function computeMonthOccupancy(
  supabase: any, propertyId: string, unitIds: string[], start: string, end: string
): Promise<{ avgRate: number; sold: number; available: number; dailyData: { date: string; occupied: number; available: number; rate: number }[] }> {
  const dailyData: { date: string; occupied: number; available: number; rate: number }[] = [];
  let totalSold = 0;
  let totalAvailable = 0;
  const d = new Date(start + "T00:00:00");
  const endD = new Date(end + "T00:00:00");

  while (d <= endD) {
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

async function fetchRevenueData(supabase: any, propertyId: string, start: string, end: string) {
  const { data } = await supabase
    .from("reservations")
    .select("total_price, commission_amount, source, channel, nights")
    .neq("status", "Cancelled")
    .is("cancelled_at", null)
    .gte("check_in_date", start)
    .lte("check_in_date", end)
    .eq("property_id", propertyId);
  return data || [];
}

async function fetchNewBookings(supabase: any, propertyId: string, start: string, end: string) {
  const { data } = await supabase
    .from("reservations")
    .select("source, channel, total_price, commission_amount, nights")
    .gte("created_at", `${start}T00:00:00`)
    .lte("created_at", `${end}T23:59:59`)
    .eq("property_id", propertyId);
  return data || [];
}

interface SourceBreakdown { [source: string]: { count: number; revenue: number } }

function buildSourceBreakdown(data: any[]): SourceBreakdown {
  const bd: SourceBreakdown = {};
  for (const r of data) {
    const src = r.source || r.channel || "Unknown";
    if (!bd[src]) bd[src] = { count: 0, revenue: 0 };
    bd[src].count++;
    bd[src].revenue += (r.total_price || 0) - (r.commission_amount || 0);
  }
  return bd;
}

function simpleSourceBreakdown(data: any[]): { [source: string]: number } {
  const bd: { [source: string]: number } = {};
  for (const r of data) {
    const src = r.source || r.channel || "Unknown";
    bd[src] = (bd[src] || 0) + 1;
  }
  return bd;
}

function formatSimpleBreakdown(bd: { [source: string]: number }, total: number): string {
  return Object.entries(bd).map(([k, v]) => {
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
    return `${k}: ${v} (${pct}%)`;
  }).join(", ") || "—";
}

function renderBarChart(items: { label: string; value: number; displayValue: string; isCurrent: boolean }[]): string {
  const maxVal = Math.max(...items.map(i => i.value), 1);
  return items.map(item => {
    const pct = Math.max(2, (item.value / maxVal) * 100);
    const barBg = item.isCurrent ? "#334155" : "#1e293b";
    const borderLeft = item.isCurrent ? "border-left:3px solid #3b82f6;" : "";
    return `
      <tr>
        <td style="padding:4px 8px 4px 0;font-size:12px;color:#64748b;white-space:nowrap;width:100px;">${item.label}</td>
        <td style="padding:4px 0;width:100%;">
          <div style="background:#e2e8f0;border-radius:4px;height:24px;width:100%;position:relative;">
            <div style="background:${barBg};border-radius:4px;height:24px;width:${pct.toFixed(1)}%;${borderLeft}min-width:2px;"></div>
          </div>
        </td>
        <td style="padding:4px 0 4px 8px;font-size:13px;font-weight:bold;color:#1e293b;white-space:nowrap;">${item.displayValue}</td>
      </tr>`;
  }).join("");
}

function renderComparisonCard(
  current: number, previous: number, label: string, formatFn: (v: number) => string,
  yoyCurrent?: number, yoyPrevious?: number, yoyLabel?: string
): string {
  let momHtml = "";
  if (previous === 0 && current === 0) {
    momHtml = `<span style="font-size:13px;color:#64748b;">No data for comparison</span>`;
  } else {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
    const isPositive = change >= 0;
    const arrow = isPositive ? "↑" : "↓";
    const color = isPositive ? "#16a34a" : "#dc2626";
    momHtml = `
      <div>
        <span style="font-size:16px;font-weight:bold;color:${color};">${arrow} ${Math.abs(change).toFixed(1)}%</span>
        <span style="font-size:13px;color:#64748b;margin-left:8px;">${label}</span>
      </div>
      <div style="font-size:12px;color:#94a3b8;margin-top:2px;">This month: ${formatFn(current)} vs Last month: ${formatFn(previous)}</div>`;
  }

  let yoyHtml = "";
  if (yoyLabel !== undefined) {
    if (yoyPrevious === undefined || yoyPrevious === null) {
      yoyHtml = `<div style="font-size:12px;color:#94a3b8;margin-top:6px;">${yoyLabel}: N/A — no data</div>`;
    } else if (yoyPrevious === 0 && (yoyCurrent || 0) === 0) {
      yoyHtml = `<div style="font-size:12px;color:#94a3b8;margin-top:6px;">${yoyLabel}: N/A</div>`;
    } else {
      const yChange = yoyPrevious > 0 ? (((yoyCurrent || 0) - yoyPrevious) / yoyPrevious) * 100 : ((yoyCurrent || 0) > 0 ? 100 : 0);
      const yPositive = yChange >= 0;
      const yArrow = yPositive ? "↑" : "↓";
      const yColor = yPositive ? "#16a34a" : "#dc2626";
      yoyHtml = `<div style="font-size:12px;margin-top:6px;"><span style="color:${yColor};font-weight:bold;">${yArrow} ${Math.abs(yChange).toFixed(1)}%</span> <span style="color:#94a3b8;">${yoyLabel} (${formatFn(yoyPrevious)})</span></div>`;
    }
  }

  return `
    <div style="background:#f1f5f9;border-radius:8px;border:1px solid #cbd5e1;padding:12px;margin:8px 0 20px;">
      ${momHtml}${yoyHtml}
    </div>`;
}

function comparisonLine(current: number, prior: number | null | undefined, label: string, formatFn: (v: number) => string): string {
  if (prior === null || prior === undefined) return `<span style="color:#94a3b8;">${label}: N/A — no data</span>`;
  if (prior === 0 && current === 0) return `<span style="color:#94a3b8;">${label}: N/A</span>`;
  const change = prior > 0 ? ((current - prior) / prior) * 100 : (current > 0 ? 100 : 0);
  const isPositive = change >= 0;
  const arrow = isPositive ? "↑" : "↓";
  const color = isPositive ? "#16a34a" : "#dc2626";
  return `<span style="color:${color};font-weight:bold;">${arrow} ${Math.abs(change).toFixed(1)}%</span> <span style="color:#64748b;">${label} (${formatFn(prior)})</span>`;
}

interface MonthData {
  label: string;
  year: number;
  month: number;
  occupancyRate: number;
  sold: number;
  avail: number;
  newBookings: number;
  netRevenue: number;
  grossRevenue: number;
  isCurrent: boolean;
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
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthName = fullMonthLabel(currentYear, currentMonth);

    const { data: property } = await supabase
      .from("properties").select("id, name, currency")
      .eq("is_default", true).single();

    if (!property) {
      return new Response(JSON.stringify({ error: "No default property" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currency = property.currency || "EGP";
    const settings = await getPropertySettings(supabase, property.id);
    const recipients = await getRecipients(supabase, property.id);
    if (recipients.length === 0) {
      await supabase.from("summary_report_log").insert({
        report_type: "monthly", property_id: property.id, report_date: todayStr,
        status: "sent", error_message: "No recipients configured", sent_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ success: true, message: "No recipients" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allUnits } = await supabase.from("units").select("id").eq("property_id", property.id);
    const unitIds = (allUnits || []).map((u: any) => u.id);
    const { start, end } = getMonthRange(currentYear, currentMonth);

    // ===== CHECK-INS / CHECK-OUTS =====
    const { data: checkIns } = await supabase
      .from("reservations").select("source, channel")
      .gte("check_in_date", start).lte("check_in_date", end)
      .in("status", ["confirmed", "checked-in"])
      .eq("property_id", property.id);

    const { data: checkOuts } = await supabase
      .from("reservations").select("source, channel")
      .gte("check_out_date", start).lte("check_out_date", end)
      .in("status", ["confirmed", "checked-in", "checked-out", "completed"])
      .eq("property_id", property.id);

    const ciBreakdown = simpleSourceBreakdown(checkIns || []);
    const coBreakdown = simpleSourceBreakdown(checkOuts || []);

    // ===== OCCUPANCY (corrected — excludes blocked) =====
    const occData = await computeMonthOccupancy(supabase, property.id, unitIds, start, end);
    const highestDay = occData.dailyData.length > 0 ? occData.dailyData.reduce((a, b) => a.rate > b.rate ? a : b) : null;
    const lowestDay = occData.dailyData.length > 0 ? occData.dailyData.reduce((a, b) => a.rate < b.rate ? a : b) : null;

    // ===== REVENUE =====
    const revenueData = await fetchRevenueData(supabase, property.id, start, end);
    const grossRevenue = revenueData.reduce((s: number, r: any) => s + (r.total_price || 0), 0);
    const totalCommission = revenueData.reduce((s: number, r: any) => s + (r.commission_amount || 0), 0);
    const netRevenue = grossRevenue - totalCommission;
    const adr = occData.sold > 0 ? netRevenue / occData.sold : 0;
    const revpar = occData.available > 0 ? netRevenue / occData.available : 0;

    // ===== NEW BOOKINGS =====
    const newBookings = await fetchNewBookings(supabase, property.id, start, end);
    const avgBookingValue = newBookings.length > 0 ? newBookings.reduce((s: number, r: any) => s + (r.total_price || 0), 0) / newBookings.length : 0;
    const avgLOS = newBookings.length > 0 ? newBookings.reduce((s: number, r: any) => s + (r.nights || 0), 0) / newBookings.length : 0;
    const bookingBreakdown = simpleSourceBreakdown(newBookings);
    const sourceBreakdown = buildSourceBreakdown(newBookings);

    // ===== PRIOR MONTH =====
    const priorMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const priorYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const priorRange = getMonthRange(priorYear, priorMonth);
    const priorOcc = await computeMonthOccupancy(supabase, property.id, unitIds, priorRange.start, priorRange.end);
    const priorRevData = await fetchRevenueData(supabase, property.id, priorRange.start, priorRange.end);
    const priorGross = priorRevData.reduce((s: number, r: any) => s + (r.total_price || 0), 0);
    const priorComm = priorRevData.reduce((s: number, r: any) => s + (r.commission_amount || 0), 0);
    const priorNet = priorGross - priorComm;
    const priorAdr = priorOcc.sold > 0 ? priorNet / priorOcc.sold : 0;
    const priorRevpar = priorOcc.available > 0 ? priorNet / priorOcc.available : 0;
    const priorBookings = await fetchNewBookings(supabase, property.id, priorRange.start, priorRange.end);
    const priorSourceBreakdown = buildSourceBreakdown(priorBookings);

    // ===== SAME MONTH LAST YEAR =====
    const lyRange = getMonthRange(currentYear - 1, currentMonth);
    const lyOcc = await computeMonthOccupancy(supabase, property.id, unitIds, lyRange.start, lyRange.end);
    const lyRevData = await fetchRevenueData(supabase, property.id, lyRange.start, lyRange.end);
    const lyGross = lyRevData.reduce((s: number, r: any) => s + (r.total_price || 0), 0);
    const lyComm = lyRevData.reduce((s: number, r: any) => s + (r.commission_amount || 0), 0);
    const lyNet = lyGross - lyComm;
    const lyAdr = lyOcc.sold > 0 ? lyNet / lyOcc.sold : 0;
    const lyRevpar = lyOcc.available > 0 ? lyNet / lyOcc.available : 0;
    const lyHasData = lyRevData.length > 0 || lyOcc.sold > 0;
    const lyBookings = await fetchNewBookings(supabase, property.id, lyRange.start, lyRange.end);
    const lyMonthName = monthLabel(currentYear - 1, currentMonth);

    // ===== 6-MONTH TREND DATA =====
    const months: MonthData[] = [];
    for (let i = 5; i >= 0; i--) {
      let mMonth = currentMonth - i;
      let mYear = currentYear;
      while (mMonth < 0) { mMonth += 12; mYear--; }
      const mRange = getMonthRange(mYear, mMonth);

      let mOccRate = 0, mSold = 0, mAvail = 0;
      if (i === 0) {
        mOccRate = occData.avgRate; mSold = occData.sold; mAvail = occData.available;
      } else if (i === 1) {
        mOccRate = priorOcc.avgRate; mSold = priorOcc.sold; mAvail = priorOcc.available;
      } else {
        const mOcc = await computeMonthOccupancy(supabase, property.id, unitIds, mRange.start, mRange.end);
        mOccRate = mOcc.avgRate; mSold = mOcc.sold; mAvail = mOcc.available;
      }

      let mBookings = 0, mNet = 0, mGross = 0;
      if (i === 0) {
        mBookings = newBookings.length; mNet = netRevenue; mGross = grossRevenue;
      } else if (i === 1) {
        mBookings = priorBookings.length; mNet = priorNet; mGross = priorGross;
      } else {
        const mB = await fetchNewBookings(supabase, property.id, mRange.start, mRange.end);
        mBookings = mB.length;
        const mR = await fetchRevenueData(supabase, property.id, mRange.start, mRange.end);
        mGross = mR.reduce((s: number, r: any) => s + (r.total_price || 0), 0);
        const mC = mR.reduce((s: number, r: any) => s + (r.commission_amount || 0), 0);
        mNet = mGross - mC;
      }

      months.push({
        label: monthLabel(mYear, mMonth), year: mYear, month: mMonth,
        occupancyRate: mOccRate, sold: mSold, avail: mAvail,
        newBookings: mBookings, netRevenue: mNet, grossRevenue: mGross,
        isCurrent: i === 0,
      });
    }

    const curMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];

    // ===== SOURCE BREAKDOWN TABLE =====
    const sourceEntries = Object.entries(sourceBreakdown).sort((a, b) => b[1].count - a[1].count);
    const totalBookingsCount = newBookings.length;
    const sourceTableRows = sourceEntries.length > 0
      ? sourceEntries.map(([src, data], i) => {
          const pct = totalBookingsCount > 0 ? ((data.count / totalBookingsCount) * 100).toFixed(1) : "0";
          const priorPct = priorBookings.length > 0 && priorSourceBreakdown[src]
            ? ((priorSourceBreakdown[src].count / priorBookings.length) * 100).toFixed(1) : null;
          const changeStr = priorPct !== null
            ? (() => { const diff = parseFloat(pct) - parseFloat(priorPct); const arrow = diff >= 0 ? "↑" : "↓"; const color = diff >= 0 ? "#16a34a" : "#dc2626"; return `<span style="color:${color};font-size:11px;">${arrow} from ${priorPct}%</span>`; })()
            : `<span style="color:#94a3b8;font-size:11px;">New</span>`;
          const bg = i % 2 === 0 ? '#f9fafb' : '#fff';
          return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;background:${bg};">${src}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;background:${bg};text-align:center;">${data.count}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;background:${bg};text-align:center;">${pct}% ${changeStr}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;background:${bg};text-align:right;">${formatCurrency(data.revenue, currency)}</td></tr>`;
        }).join("")
      : `<tr><td colspan="4" style="padding:12px;color:#888;">No bookings this month</td></tr>`;

    // ===== BAR CHARTS =====
    const occChartRows = renderBarChart(months.map(m => ({ label: m.label, value: m.occupancyRate, displayValue: `${m.occupancyRate.toFixed(1)}%`, isCurrent: m.isCurrent })));
    const bookingsChartRows = renderBarChart(months.map(m => ({ label: m.label, value: m.newBookings, displayValue: `${m.newBookings}`, isCurrent: m.isCurrent })));
    const revenueChartRows = renderBarChart(months.map(m => ({ label: m.label, value: m.netRevenue, displayValue: formatCurrency(m.netRevenue, currency), isCurrent: m.isCurrent })));

    // ===== COMPARISON HELPERS =====
    const fmt = (v: number) => formatCurrency(v, currency);
    const fmtPct = (v: number) => `${v.toFixed(1)}%`;
    const fmtN = (v: number) => `${v} bookings`;

    const thStyle = (extra = '') => `bgcolor="#1e293b" style="background-color:#1e293b;color:#ffffff;padding:8px 12px;text-align:left;font-size:13px;${extra}"`;

    // ===== EMAIL HTML =====
    const monthlyHeaderHTML = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#222;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
          <tr>
            <td bgcolor="#0f172a" style="background-color:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-family:Arial,sans-serif;">SuiteSpot Monthly Summary</h1>
              <p style="color:#ffffff;margin:4px 0 0;font-size:14px;font-family:Arial,sans-serif;">${property.name} — ${monthName}</p>
            </td>
          </tr>
        </table>`;

    const monthlyBodyHTML = `
          <h2 style="font-size:16px;color:#1e293b;margin:0 0 8px;">📥 Check-ins: ${(checkIns || []).length}</h2>
          <p style="font-size:13px;color:#555;margin:0 0 16px;">${formatSimpleBreakdown(ciBreakdown, (checkIns || []).length)}</p>

          <h2 style="font-size:16px;color:#1e293b;margin:0 0 8px;">📤 Check-outs: ${(checkOuts || []).length}</h2>
          <p style="font-size:13px;color:#555;margin:0 0 16px;">${formatSimpleBreakdown(coBreakdown, (checkOuts || []).length)}</p>

          <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">🏠 Occupancy</h2>
          <div style="background:#f1f5f9;padding:16px;border-radius:8px;border:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td style="padding:4px 0;font-size:14px;">Average Occupancy</td><td style="text-align:right;font-weight:bold;font-size:14px;">${occData.avgRate.toFixed(1)}%</td></tr>
              ${highestDay ? `<tr><td style="padding:4px 0;font-size:14px;">Highest Day</td><td style="text-align:right;font-weight:bold;font-size:14px;">${highestDay.date} (${highestDay.rate.toFixed(1)}%)</td></tr>` : ""}
              ${lowestDay ? `<tr><td style="padding:4px 0;font-size:14px;">Lowest Day</td><td style="text-align:right;font-weight:bold;font-size:14px;">${lowestDay.date} (${lowestDay.rate.toFixed(1)}%)</td></tr>` : ""}
              <tr><td style="padding:4px 0;font-size:14px;">Room Nights</td><td style="text-align:right;font-weight:bold;font-size:14px;">${occData.sold} sold / ${occData.available} available</td></tr>
            </table>
            <div style="margin-top:8px;font-size:12px;">
              <p style="margin:2px 0;">${comparisonLine(occData.avgRate, priorOcc.avgRate, `vs ${monthLabel(priorYear, priorMonth)}`, fmtPct)}</p>
              <p style="margin:2px 0;">${comparisonLine(occData.avgRate, lyHasData ? lyOcc.avgRate : null, `vs ${lyMonthName}`, fmtPct)}</p>
            </div>
          </div>

          <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">💰 Revenue</h2>
          <div style="background:#f1f5f9;padding:16px;border-radius:8px;border:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td style="padding:4px 0;font-size:14px;">Gross Revenue</td><td style="text-align:right;font-weight:bold;font-size:14px;">${fmt(grossRevenue)}</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;">Commissions</td><td style="text-align:right;font-weight:bold;font-size:14px;color:#dc2626;">${fmt(totalCommission)}</td></tr>
              <tr style="border-top:2px solid #1e293b;"><td style="padding:8px 0 4px;font-size:14px;font-weight:bold;">Net Revenue</td><td style="text-align:right;font-weight:bold;font-size:16px;color:#16a34a;">${fmt(netRevenue)}</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;">ADR</td><td style="text-align:right;font-weight:bold;font-size:14px;">${fmt(adr)}</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;">RevPAR</td><td style="text-align:right;font-weight:bold;font-size:14px;">${fmt(revpar)}</td></tr>
            </table>
            <div style="margin-top:8px;font-size:12px;">
              <p style="margin:2px 0;">${comparisonLine(grossRevenue, priorGross, `Gross vs ${monthLabel(priorYear, priorMonth)}`, fmt)}</p>
              <p style="margin:2px 0;">${comparisonLine(netRevenue, priorNet, `Net vs ${monthLabel(priorYear, priorMonth)}`, fmt)}</p>
              <p style="margin:2px 0;">${comparisonLine(adr, priorAdr, `ADR vs ${monthLabel(priorYear, priorMonth)}`, fmt)}</p>
              <p style="margin:2px 0;">${comparisonLine(revpar, priorRevpar, `RevPAR vs ${monthLabel(priorYear, priorMonth)}`, fmt)}</p>
              <p style="margin:2px 0;">${comparisonLine(grossRevenue, lyHasData ? lyGross : null, `Gross vs ${lyMonthName}`, fmt)}</p>
              <p style="margin:2px 0;">${comparisonLine(netRevenue, lyHasData ? lyNet : null, `Net vs ${lyMonthName}`, fmt)}</p>
              <p style="margin:2px 0;">${comparisonLine(adr, lyHasData ? lyAdr : null, `ADR vs ${lyMonthName}`, fmt)}</p>
              <p style="margin:2px 0;">${comparisonLine(revpar, lyHasData ? lyRevpar : null, `RevPAR vs ${lyMonthName}`, fmt)}</p>
            </div>
          </div>

          <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">📊 New Bookings: ${newBookings.length}</h2>
          <p style="font-size:13px;color:#555;margin:0;">By source: ${formatSimpleBreakdown(bookingBreakdown, newBookings.length)}</p>
          <p style="font-size:13px;color:#555;margin:4px 0 16px;">Avg value: ${fmt(avgBookingValue)} · Avg stay: ${avgLOS.toFixed(1)} nights</p>

          <hr style="border:none;border-top:2px solid #e2e8f0;margin:24px 0;" />

          <h2 style="font-size:18px;color:#1e293b;margin:0 0 16px;">📊 Performance — Past 6 Months</h2>

          <h3 style="font-size:15px;color:#1e293b;margin:0 0 8px;">Occupancy Trend</h3>
          <table style="width:100%;border-collapse:collapse;">${occChartRows}</table>
          ${renderComparisonCard(curMonth.occupancyRate, prevMonth.occupancyRate, "month-over-month", fmtPct, occData.avgRate, lyHasData ? lyOcc.avgRate : undefined, `vs ${lyMonthName}`)}

          <h3 style="font-size:15px;color:#1e293b;margin:0 0 8px;">New Bookings Trend</h3>
          <table style="width:100%;border-collapse:collapse;">${bookingsChartRows}</table>
          ${renderComparisonCard(curMonth.newBookings, prevMonth.newBookings, "month-over-month", fmtN, newBookings.length, lyHasData ? lyBookings.length : undefined, `vs ${lyMonthName}`)}

          <h3 style="font-size:15px;color:#1e293b;margin:0 0 8px;">Revenue Trend</h3>
          <table style="width:100%;border-collapse:collapse;">${revenueChartRows}</table>
          ${renderComparisonCard(curMonth.netRevenue, prevMonth.netRevenue, "month-over-month", fmt, netRevenue, lyHasData ? lyNet : undefined, `vs ${lyMonthName}`)}

          <h3 style="font-size:15px;color:#1e293b;margin:16px 0 8px;">Booking Source Breakdown</h3>
          <table style="width:100%;border-collapse:collapse;margin:8px 0 16px 0;">
            <tr><th ${thStyle()}>Source</th><th ${thStyle('text-align:center;')}>Count</th><th ${thStyle('text-align:center;')}>Share</th><th ${thStyle('text-align:right;')}>Net Revenue</th></tr>
            ${sourceTableRows}
          </table>

          <p style="margin:24px 0 0;font-size:11px;color:#999;">Generated automatically by SuiteSpot PMS — ${new Date().toISOString()}</p>`;

    // ===== SEND EMAILS =====
    const sentEmails: string[] = [];
    let errorCount = 0;

    for (const recipient of recipients) {
      try {
        const firstName = getFirstName(recipient.name);
        const greeting = `<p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.5;">Hi ${firstName}, here's your monthly summary for ${property.name} — ${monthName}.</p>`;
        const dmHead = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;">`;
        const personalizedHTML = `${dmHead}${monthlyHeaderHTML}<div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">${greeting}${monthlyBodyHTML}</div></div></body></html>`;

        const resp = await resend.emails.send({
          from: `Mia — ${settings.from_name} AI <${settings.from_email_ai}>`,
          to: [recipient.email],
          subject: `Monthly Summary — ${property.name} — ${monthName}`,
          html: personalizedHTML,
        });
        console.log(`Monthly email sent to ${recipient.email}:`, JSON.stringify(resp));
        sentEmails.push(recipient.email);
      } catch (e) {
        console.error(`Error sending monthly to ${recipient.email}:`, e);
        errorCount++;
      }
      if (recipients.indexOf(recipient) < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    await supabase.from("summary_report_log").insert({
      report_type: "monthly", property_id: property.id, report_date: todayStr,
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
    console.error("Error in generate-monthly-summary:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

Deno.serve(handler);
