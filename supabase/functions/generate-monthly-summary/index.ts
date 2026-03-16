import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@3.2.0";
import jsPDF from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getRecipients(supabase: any): Promise<{ email: string; name: string }[]> {
  const { data: settings } = await supabase
    .from("user_notification_settings")
    .select("user_id")
    .eq("daily_summary_email", true);
  if (!settings || settings.length === 0) return [];
  const userIds = settings.map((s: any) => s.user_id);
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
  const recipients: { email: string; name: string }[] = [];
  for (const uid of userIds) {
    const user = users?.find((u: any) => u.id === uid);
    if (user?.email) recipients.push({ email: user.email, name: profileMap.get(uid) || "Team Member" });
  }
  return recipients;
}

interface SourceBreakdown { [source: string]: number; }

function breakdownBySource(data: any[]): SourceBreakdown {
  const bd: SourceBreakdown = {};
  for (const r of data) {
    const src = r.source || r.channel || "Unknown";
    bd[src] = (bd[src] || 0) + 1;
  }
  return bd;
}

function formatBreakdown(bd: SourceBreakdown): string {
  return Object.entries(bd).map(([k, v]) => `${k}: ${v}`).join(", ");
}

function formatBreakdownWithPct(bd: SourceBreakdown, total: number): string {
  return Object.entries(bd).map(([k, v]) => {
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
    return `${k}: ${v} (${pct}%)`;
  }).join(", ");
}

function comparisonStr(current: number, prior: number | null, label: string, isCurrency = false): string {
  if (prior === null || prior === undefined) return `${label}: ${isCurrency ? formatCurrency(current) : current.toFixed(1) + '%'} (N/A — no prior data)`;
  if (prior === 0) return `${label}: ${isCurrency ? formatCurrency(current) : current.toFixed(1) + '%'} (N/A — prior period was zero)`;
  const change = ((current - prior) / prior) * 100;
  const arrow = change >= 0 ? "↑" : "↓";
  const priorStr = isCurrency ? formatCurrency(prior) : prior.toFixed(1) + '%';
  return `${label}: ${isCurrency ? formatCurrency(current) : current.toFixed(1) + '%'} (${arrow} ${Math.abs(change).toFixed(1)}% vs ${priorStr})`;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
}

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

async function fetchRevenueData(supabase: any, propertyId: string, start: string, end: string) {
  // Matching Analytics.tsx exactly: neq status Cancelled, is cancelled_at null, gte/lte check_in_date
  const { data } = await supabase
    .from("reservations")
    .select("total_price, commission_amount, source, channel, nights, check_in_date, check_out_date")
    .neq("status", "Cancelled")
    .is("cancelled_at", null)
    .gte("check_in_date", start)
    .lte("check_in_date", end)
    .eq("property_id", propertyId);
  return data || [];
}

async function fetchOccupancyForMonth(supabase: any, propertyId: string, start: string, end: string, totalRooms: number) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  let totalOccupied = 0;
  let days = 0;

  const d = new Date(startDate);
  while (d <= endDate) {
    const ds = d.toISOString().split("T")[0];
    const { data } = await supabase
      .from("reservations")
      .select("id")
      .lte("check_in_date", ds)
      .gt("check_out_date", ds)
      .in("status", ["confirmed", "checked-in"])
      .eq("property_id", propertyId);
    totalOccupied += (data?.length || 0);
    days++;
    d.setDate(d.getDate() + 1);
  }

  const avgRate = days > 0 ? (totalOccupied / (totalRooms * days)) * 100 : 0;
  return { avgRate, roomNightsSold: totalOccupied, roomNightsAvailable: totalRooms * days };
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
    const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const { data: property } = await supabase
      .from("properties")
      .select("id, name")
      .eq("is_default", true)
      .single();

    if (!property) {
      return new Response(JSON.stringify({ error: "No default property" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients = await getRecipients(supabase);
    if (recipients.length === 0) {
      await supabase.from("summary_report_log").insert({
        report_type: "monthly", property_id: property.id, report_date: todayStr,
        status: "sent", error_message: "No recipients configured", sent_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ success: true, message: "No recipients" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { start, end } = getMonthRange(currentYear, currentMonth);

    // Total units
    const { data: units } = await supabase.from("units").select("id").eq("property_id", property.id);
    const totalRooms = units?.length || 1;

    // Check-ins/Check-outs
    const { data: checkIns } = await supabase
      .from("reservations")
      .select("source, channel")
      .gte("check_in_date", start).lte("check_in_date", end)
      .in("status", ["confirmed", "checked-in"])
      .eq("property_id", property.id);

    const { data: checkOuts } = await supabase
      .from("reservations")
      .select("source, channel")
      .gte("check_out_date", start).lte("check_out_date", end)
      .in("status", ["confirmed", "checked-in", "checked-out", "completed"])
      .eq("property_id", property.id);

    // Occupancy
    const occupancy = await fetchOccupancyForMonth(supabase, property.id, start, end, totalRooms);

    // Revenue — matching Analytics.tsx exactly
    const revenueData = await fetchRevenueData(supabase, property.id, start, end);
    const grossRevenue = revenueData.reduce((s: number, r: any) => s + (r.total_price || 0), 0);
    const totalCommission = revenueData.reduce((s: number, r: any) => s + (r.commission_amount || 0), 0);
    const netRevenue = revenueData.reduce((s: number, r: any) => s + ((r.total_price || 0) - (r.commission_amount || 0)), 0);

    // Bookings
    const { data: newBookings } = await supabase
      .from("reservations")
      .select("source, channel, total_price, nights")
      .gte("created_at", `${start}T00:00:00`).lte("created_at", `${end}T23:59:59`)
      .eq("property_id", property.id);

    const avgBookingValue = (newBookings || []).length > 0
      ? (newBookings || []).reduce((s: number, r: any) => s + (r.total_price || 0), 0) / (newBookings || []).length
      : 0;
    const avgLOS = (newBookings || []).length > 0
      ? (newBookings || []).reduce((s: number, r: any) => s + (r.nights || 0), 0) / (newBookings || []).length
      : 0;

    // Prior month comparison
    const priorMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const priorYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const priorRange = getMonthRange(priorYear, priorMonth);
    const priorOcc = await fetchOccupancyForMonth(supabase, property.id, priorRange.start, priorRange.end, totalRooms);
    const priorRevData = await fetchRevenueData(supabase, property.id, priorRange.start, priorRange.end);
    const priorGross = priorRevData.reduce((s: number, r: any) => s + (r.total_price || 0), 0);
    const priorNet = priorRevData.reduce((s: number, r: any) => s + ((r.total_price || 0) - (r.commission_amount || 0)), 0);

    // Same month last year
    const lyRange = getMonthRange(currentYear - 1, currentMonth);
    const lyOcc = await fetchOccupancyForMonth(supabase, property.id, lyRange.start, lyRange.end, totalRooms);
    const lyRevData = await fetchRevenueData(supabase, property.id, lyRange.start, lyRange.end);
    const lyGross = lyRevData.reduce((s: number, r: any) => s + (r.total_price || 0), 0);
    const lyNet = lyRevData.reduce((s: number, r: any) => s + ((r.total_price || 0) - (r.commission_amount || 0)), 0);
    const lyHasData = lyRevData.length > 0;
    const lyMonthName = new Date(currentYear - 1, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const ciBreakdown = breakdownBySource(checkIns || []);
    const coBreakdown = breakdownBySource(checkOuts || []);
    const bookingBreakdown = breakdownBySource(newBookings || []);

    // Comparison strings
    const occVsPrior = comparisonStr(occupancy.avgRate, priorOcc.avgRate, "vs last month");
    const occVsLY = lyHasData ? comparisonStr(occupancy.avgRate, lyOcc.avgRate, `vs ${lyMonthName}`) : `vs ${lyMonthName}: N/A — no data`;
    const grossVsPrior = comparisonStr(grossRevenue, priorGross, "vs last month", true);
    const grossVsLY = lyHasData ? comparisonStr(grossRevenue, lyGross, `vs ${lyMonthName}`, true) : `vs ${lyMonthName}: N/A — no data`;
    const netVsPrior = comparisonStr(netRevenue, priorNet, "vs last month", true);
    const netVsLY = lyHasData ? comparisonStr(netRevenue, lyNet, `vs ${lyMonthName}`, true) : `vs ${lyMonthName}: N/A — no data`;

    // Generate PDF
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(20); doc.setTextColor(14, 165, 233);
    doc.text("SuiteSpot", 14, y); y += 8;
    doc.setFontSize(14); doc.setTextColor(0, 0, 0);
    doc.text(`Monthly Summary — ${property.name}`, 14, y); y += 7;
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(monthName, 14, y); y += 12;

    // Check-ins
    doc.setFontSize(13); doc.setTextColor(0, 0, 0);
    doc.text(`Check-ins: ${(checkIns || []).length}`, 14, y); y += 7;
    doc.setFontSize(9);
    doc.text(`By source: ${formatBreakdownWithPct(ciBreakdown, (checkIns || []).length)}`, 16, y); y += 8;

    // Check-outs
    doc.setFontSize(13);
    doc.text(`Check-outs: ${(checkOuts || []).length}`, 14, y); y += 7;
    doc.setFontSize(9);
    doc.text(`By source: ${formatBreakdownWithPct(coBreakdown, (checkOuts || []).length)}`, 16, y); y += 10;

    // Occupancy
    doc.setFontSize(13);
    doc.text("Occupancy", 14, y); y += 7;
    doc.setFontSize(10);
    doc.text(`Average: ${occupancy.avgRate.toFixed(1)}%`, 16, y); y += 6;
    doc.text(`Room nights: ${occupancy.roomNightsSold} sold / ${occupancy.roomNightsAvailable} available`, 16, y); y += 6;
    doc.setFontSize(9);
    doc.text(occVsPrior, 16, y); y += 5;
    doc.text(occVsLY, 16, y); y += 10;

    // Revenue
    doc.setFontSize(13);
    doc.text("Revenue", 14, y); y += 7;
    doc.setFontSize(10);
    doc.text(`Gross: ${formatCurrency(grossRevenue)}`, 16, y); y += 6;
    doc.text(`Commissions: ${formatCurrency(totalCommission)}`, 16, y); y += 6;
    doc.text(`Net: ${formatCurrency(netRevenue)}`, 16, y); y += 7;
    doc.setFontSize(9);
    doc.text(grossVsPrior, 16, y); y += 5;
    doc.text(grossVsLY, 16, y); y += 5;
    doc.text(netVsPrior, 16, y); y += 5;
    doc.text(netVsLY, 16, y); y += 10;

    // Bookings
    doc.setFontSize(13);
    doc.text(`New Bookings: ${(newBookings || []).length}`, 14, y); y += 7;
    doc.setFontSize(10);
    doc.text(`By source: ${formatBreakdown(bookingBreakdown)}`, 16, y); y += 6;
    doc.text(`Avg booking value: ${formatCurrency(avgBookingValue)}`, 16, y); y += 6;
    doc.text(`Avg length of stay: ${avgLOS.toFixed(1)} nights`, 16, y); y += 10;

    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`Generated automatically by SuiteSpot PMS — ${new Date().toISOString()}`, 14, 285);

    const pdfBytes = doc.output("arraybuffer");
    const pdfFilename = `Monthly-Summary-${start.substring(0, 7)}.pdf`;

    await supabase.storage.from("reports").upload(pdfFilename, pdfBytes, { contentType: "application/pdf", upsert: true });

    // Email HTML
    const emailHTML = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#222;">
        <div style="background:#0EA5E9;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">SuiteSpot Monthly Summary</h1>
          <p style="color:rgba(255,255,255,0.9);margin:4px 0 0;font-size:14px;">${property.name} — ${monthName}</p>
        </div>
        <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <h2 style="font-size:16px;color:#0EA5E9;">📥 Check-ins: ${(checkIns || []).length}</h2>
          <p style="font-size:13px;color:#555;">${formatBreakdownWithPct(ciBreakdown, (checkIns || []).length)}</p>

          <h2 style="font-size:16px;color:#0EA5E9;margin-top:16px;">📤 Check-outs: ${(checkOuts || []).length}</h2>
          <p style="font-size:13px;color:#555;">${formatBreakdownWithPct(coBreakdown, (checkOuts || []).length)}</p>

          <h2 style="font-size:16px;color:#0EA5E9;margin-top:16px;">🏠 Occupancy</h2>
          <div style="background:#f0f9ff;padding:16px;border-radius:8px;border:1px solid #bae6fd;">
            <p style="margin:4px 0;font-size:14px;"><strong>Average:</strong> ${occupancy.avgRate.toFixed(1)}%</p>
            <p style="margin:4px 0;font-size:14px;"><strong>Room nights:</strong> ${occupancy.roomNightsSold} sold / ${occupancy.roomNightsAvailable} available</p>
            <p style="margin:4px 0;font-size:13px;color:#555;">${occVsPrior}</p>
            <p style="margin:4px 0;font-size:13px;color:#555;">${occVsLY}</p>
          </div>

          <h2 style="font-size:16px;color:#0EA5E9;margin-top:16px;">💰 Revenue</h2>
          <div style="background:#f0fdf4;padding:16px;border-radius:8px;border:1px solid #bbf7d0;">
            <table style="width:100%;">
              <tr><td style="padding:4px 0;font-size:14px;">Gross Revenue</td><td style="text-align:right;font-weight:bold;font-size:14px;">${formatCurrency(grossRevenue)}</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;">Commissions</td><td style="text-align:right;font-weight:bold;font-size:14px;color:#dc2626;">${formatCurrency(totalCommission)}</td></tr>
              <tr style="border-top:2px solid #16a34a;"><td style="padding:8px 0 4px;font-size:14px;font-weight:bold;">Net Revenue</td><td style="text-align:right;font-weight:bold;font-size:16px;color:#16a34a;">${formatCurrency(netRevenue)}</td></tr>
            </table>
            <p style="margin:8px 0 2px;font-size:12px;color:#555;">${grossVsPrior}</p>
            <p style="margin:2px 0;font-size:12px;color:#555;">${grossVsLY}</p>
            <p style="margin:2px 0;font-size:12px;color:#555;">${netVsPrior}</p>
            <p style="margin:2px 0;font-size:12px;color:#555;">${netVsLY}</p>
          </div>

          <h2 style="font-size:16px;color:#0EA5E9;margin-top:16px;">📊 New Bookings: ${(newBookings || []).length}</h2>
          <p style="font-size:13px;color:#555;">By source: ${formatBreakdown(bookingBreakdown)}</p>
          <p style="font-size:13px;color:#555;">Avg value: ${formatCurrency(avgBookingValue)} · Avg stay: ${avgLOS.toFixed(1)} nights</p>

          <p style="margin:24px 0 0;font-size:11px;color:#999;">Generated automatically by SuiteSpot PMS — ${new Date().toISOString()}</p>
        </div>
      </div>
    `;

    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    const sentEmails: string[] = [];
    let errorCount = 0;

    for (const recipient of recipients) {
      try {
        const resp = await resend.emails.send({
          from: "SuiteSpot Reports <frontdesk@bookings.suitespoteg.com>",
          to: [recipient.email],
          subject: `Monthly Summary — ${property.name} — ${monthName}`,
          html: emailHTML,
          attachments: [{ filename: pdfFilename, content: pdfBase64 }],
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

    const { data: urlData } = supabase.storage.from("reports").getPublicUrl(pdfFilename);
    await supabase.from("summary_report_log").insert({
      report_type: "monthly", property_id: property.id, report_date: todayStr,
      recipients: sentEmails, pdf_url: urlData?.publicUrl || null,
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
