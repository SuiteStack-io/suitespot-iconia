import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@3.2.0";
import jsPDF from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function getRecipients(supabase: any): Promise<{ email: string; name: string }[]> {
  const { data: settings } = await supabase
    .from("user_notification_settings")
    .select("user_id")
    .eq("daily_summary_email", true);

  if (!settings || settings.length === 0) return [];

  const userIds = settings.map((s: any) => s.user_id);
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
  const recipients: { email: string; name: string }[] = [];

  for (const uid of userIds) {
    const user = users?.find((u: any) => u.id === uid);
    if (user?.email) {
      recipients.push({ email: user.email, name: profileMap.get(uid) || "Team Member" });
    }
  }
  return recipients;
}

function getWeekRange(today: Date): { start: string; end: string; startDate: Date; endDate: Date } {
  // Week = last Thursday to this Wednesday
  const end = new Date(today);
  // Go back to most recent Wednesday (or today if Wednesday)
  while (end.getDay() !== 3) end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6); // Thursday = Wednesday - 6
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    startDate: start,
    endDate: end,
  };
}

interface SourceBreakdown {
  [source: string]: number;
}

function breakdownBySource(data: any[]): SourceBreakdown {
  const breakdown: SourceBreakdown = {};
  for (const r of data) {
    const src = r.source || r.channel || "Unknown";
    breakdown[src] = (breakdown[src] || 0) + 1;
  }
  return breakdown;
}

function formatBreakdown(bd: SourceBreakdown): string {
  return Object.entries(bd).map(([k, v]) => `${k}: ${v}`).join(", ");
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
    const { start, end, startDate, endDate } = getWeekRange(today);
    const todayStr = today.toISOString().split("T")[0];

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
        report_type: "weekly", property_id: property.id, report_date: todayStr,
        status: "sent", error_message: "No recipients configured", sent_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ success: true, message: "No recipients" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check-ins for the week
    const { data: checkIns } = await supabase
      .from("reservations")
      .select("guest_names, source, channel")
      .gte("check_in_date", start)
      .lte("check_in_date", end)
      .in("status", ["confirmed", "checked-in"])
      .eq("property_id", property.id);

    // Check-outs for the week
    const { data: checkOuts } = await supabase
      .from("reservations")
      .select("guest_names, source, channel")
      .gte("check_out_date", start)
      .lte("check_out_date", end)
      .in("status", ["confirmed", "checked-in", "checked-out", "completed"])
      .eq("property_id", property.id);

    // Total units
    const { data: units } = await supabase
      .from("units")
      .select("id")
      .eq("property_id", property.id);
    const totalRooms = units?.length || 1;

    // Daily occupancy for each day of the week
    const dailyOccupancy: { date: string; occupied: number; rate: number }[] = [];
    const d = new Date(startDate);
    while (d <= endDate) {
      const ds = d.toISOString().split("T")[0];
      const { data: inHouse } = await supabase
        .from("reservations")
        .select("id")
        .lte("check_in_date", ds)
        .gt("check_out_date", ds)
        .in("status", ["confirmed", "checked-in"])
        .eq("property_id", property.id);
      const occ = inHouse?.length || 0;
      dailyOccupancy.push({ date: ds, occupied: occ, rate: (occ / totalRooms) * 100 });
      d.setDate(d.getDate() + 1);
    }

    const avgOccupancy = dailyOccupancy.reduce((s, d) => s + d.rate, 0) / dailyOccupancy.length;
    const highestDay = dailyOccupancy.reduce((a, b) => a.rate > b.rate ? a : b);
    const lowestDay = dailyOccupancy.reduce((a, b) => a.rate < b.rate ? a : b);
    const totalRoomNightsSold = dailyOccupancy.reduce((s, d) => s + d.occupied, 0);
    const totalRoomNightsAvailable = totalRooms * dailyOccupancy.length;

    // New bookings created during the week
    const { data: newBookings } = await supabase
      .from("reservations")
      .select("source, channel")
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`)
      .eq("property_id", property.id);

    const ciBreakdown = breakdownBySource(checkIns || []);
    const coBreakdown = breakdownBySource(checkOuts || []);
    const bookingBreakdown = breakdownBySource(newBookings || []);

    // Generate PDF
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(20);
    doc.setTextColor(14, 165, 233);
    doc.text("SuiteSpot", 14, y); y += 8;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Weekly Summary — ${property.name}`, 14, y); y += 7;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Week of ${formatDateShort(startDate)} to ${formatDateShort(endDate)}`, 14, y); y += 12;

    // Check-ins
    doc.setFontSize(13); doc.setTextColor(0,0,0);
    doc.text(`Week's Check-ins: ${(checkIns || []).length}`, 14, y); y += 7;
    doc.setFontSize(10);
    doc.text(`By source: ${formatBreakdown(ciBreakdown)}`, 16, y); y += 10;

    // Check-outs
    doc.setFontSize(13);
    doc.text(`Week's Check-outs: ${(checkOuts || []).length}`, 14, y); y += 7;
    doc.setFontSize(10);
    doc.text(`By source: ${formatBreakdown(coBreakdown)}`, 16, y); y += 10;

    // Occupancy
    doc.setFontSize(13);
    doc.text("Week's Occupancy", 14, y); y += 7;
    doc.setFontSize(10);
    doc.text(`Average occupancy: ${avgOccupancy.toFixed(1)}%`, 16, y); y += 6;
    doc.text(`Highest: ${highestDay.date} (${highestDay.rate.toFixed(1)}%)`, 16, y); y += 6;
    doc.text(`Lowest: ${lowestDay.date} (${lowestDay.rate.toFixed(1)}%)`, 16, y); y += 6;
    doc.text(`Room nights sold: ${totalRoomNightsSold} / ${totalRoomNightsAvailable} available`, 16, y); y += 10;

    // New bookings
    doc.setFontSize(13);
    doc.text(`Week's New Bookings: ${(newBookings || []).length}`, 14, y); y += 7;
    doc.setFontSize(10);
    doc.text(`By source: ${formatBreakdown(bookingBreakdown)}`, 16, y); y += 10;

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated automatically by SuiteSpot PMS — ${new Date().toISOString()}`, 14, 285);

    const pdfBytes = doc.output("arraybuffer");
    const pdfFilename = `Weekly-Summary-${start}-to-${end}.pdf`;

    await supabase.storage.from("reports").upload(pdfFilename, pdfBytes, { contentType: "application/pdf", upsert: true });

    // Email HTML
    const emailHTML = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#222;">
        <div style="background:#0EA5E9;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">SuiteSpot Weekly Summary</h1>
          <p style="color:rgba(255,255,255,0.9);margin:4px 0 0;font-size:14px;">${property.name} — Week of ${formatDateShort(startDate)} to ${formatDateShort(endDate)}</p>
        </div>
        <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <h2 style="font-size:16px;color:#0EA5E9;">📥 Check-ins: ${(checkIns || []).length}</h2>
          <p style="font-size:13px;color:#555;">By source: ${formatBreakdown(ciBreakdown)}</p>

          <h2 style="font-size:16px;color:#0EA5E9;margin-top:16px;">📤 Check-outs: ${(checkOuts || []).length}</h2>
          <p style="font-size:13px;color:#555;">By source: ${formatBreakdown(coBreakdown)}</p>

          <h2 style="font-size:16px;color:#0EA5E9;margin-top:16px;">🏠 Occupancy</h2>
          <div style="background:#f0f9ff;padding:16px;border-radius:8px;border:1px solid #bae6fd;">
            <p style="margin:4px 0;font-size:14px;"><strong>Average:</strong> ${avgOccupancy.toFixed(1)}%</p>
            <p style="margin:4px 0;font-size:14px;"><strong>Highest:</strong> ${highestDay.date} (${highestDay.rate.toFixed(1)}%)</p>
            <p style="margin:4px 0;font-size:14px;"><strong>Lowest:</strong> ${lowestDay.date} (${lowestDay.rate.toFixed(1)}%)</p>
            <p style="margin:4px 0;font-size:14px;"><strong>Room nights:</strong> ${totalRoomNightsSold} sold / ${totalRoomNightsAvailable} available</p>
          </div>

          <h2 style="font-size:16px;color:#0EA5E9;margin-top:16px;">📊 New Bookings: ${(newBookings || []).length}</h2>
          <p style="font-size:13px;color:#555;">By source: ${formatBreakdown(bookingBreakdown)}</p>

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
          from: "Mia — SuiteSpot AI <ai-assistant@bookings.suitespoteg.com>",
          to: [recipient.email],
          subject: `Weekly Summary — ${property.name} — Week of ${formatDateShort(startDate)} to ${formatDateShort(endDate)}`,
          html: emailHTML,
          attachments: [{ filename: pdfFilename, content: pdfBase64 }],
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

    const { data: urlData } = supabase.storage.from("reports").getPublicUrl(pdfFilename);
    await supabase.from("summary_report_log").insert({
      report_type: "weekly", property_id: property.id, report_date: todayStr,
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
    console.error("Error in generate-weekly-summary:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

Deno.serve(handler);
