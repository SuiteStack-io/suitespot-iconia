import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function getFirstName(fullName: string): string {
  if (!fullName || fullName === "Team Member") return "there";
  return fullName.split(" ")[0];
}

function isLastWorkingDayOfMonth(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  let lastWorkingDay = new Date(lastDay);
  while (lastWorkingDay.getDay() === 5 || lastWorkingDay.getDay() === 6) {
    lastWorkingDay.setDate(lastWorkingDay.getDate() - 1);
  }
  return date.getDate() === lastWorkingDay.getDate() && date.getMonth() === lastWorkingDay.getMonth();
}

function formatRoomDisplay(unit: any): string {
  if (!unit) return "Unassigned";
  const roomName = unit.booking_com_name || unit.name || "Unknown";
  const roomNum = unit.unit_number || "";
  return roomNum ? `${roomName} (#${roomNum})` : roomName;
}

async function getRecipients(supabase: any, propertyId?: string): Promise<{ email: string; name: string }[]> {
  const { data: settings } = await supabase
    .from("user_notification_settings")
    .select("user_id")
    .eq("daily_summary_email", true);

  if (!settings || settings.length === 0) {
    console.log("No recipients configured for summary reports");
    return [];
  }

  const userIds = settings.map((s: any) => s.user_id);

  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", userIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
  const roleMap = new Map((userRoles || []).map((r: any) => [r.user_id, r.role]));

  let candidates: { user_id: string; email: string; name: string; role: string }[] = [];

  for (const uid of userIds) {
    const user = users?.find((u: any) => u.id === uid);
    if (user?.email) {
      candidates.push({
        user_id: uid,
        email: user.email,
        name: profileMap.get(uid) || "Team Member",
        role: roleMap.get(uid) || "user",
      });
    } else {
      console.log(`Skipped — no email for user ${uid}`);
    }
  }

  if (propertyId && candidates.length > 0) {
    const candidateIds = candidates.map(c => c.user_id);
    const { data: allAccess } = await supabase
      .from('user_property_access')
      .select('user_id, property_id')
      .in('user_id', candidateIds);

    const accessList = allAccess || [];

    const { data: propData } = await supabase
      .from('properties')
      .select('name')
      .eq('id', propertyId)
      .single();
    const propertyName = propData?.name || propertyId;

    candidates = candidates.filter(user => {
      const userAccessEntries = accessList.filter((a: any) => a.user_id === user.user_id);
      if (userAccessEntries.length === 0 && (user.role === 'admin' || user.role === 'super_admin')) {
        console.log(`${user.email} — admin with global access for summary`);
        return true;
      }
      const hasAccess = userAccessEntries.some((a: any) => a.property_id === propertyId);
      if (!hasAccess) {
        console.log(`Skipped ${user.email} — no access to property "${propertyName}" for summary`);
      }
      return hasAccess;
    });
  }

  return candidates.map(c => ({ email: c.email, name: c.name }));
}


function generateEmailHTML(
  propertyName: string,
  dateStr: string,
  checkIns: any[],
  checkOuts: any[],
  inHouseGuests: { guest_name: string; room: string; source: string; nights_remaining: number; nationality: string }[],
  occupancy: { occupied: number; vacant: number; total: number; rate: number },
  blockedRooms: { room: string; reason: string }[]
): { headerHTML: string; bodyContentHTML: string } {
  const tableStyle = 'style="width:100%;border-collapse:collapse;margin:8px 0 16px 0;"';
  const thStyle = (extra = '') => `bgcolor="#1e293b" style="background-color:#1e293b;color:#ffffff;padding:8px 12px;text-align:left;font-size:13px;${extra}"`;
  const tdStyle = (i: number) => `style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;background:${i % 2 === 0 ? '#f9fafb' : '#fff'};"`;

  const checkInRows = checkIns.length > 0
    ? checkIns.map((ci, i) => {
        const nights = ci.check_in_date && ci.check_out_date
          ? Math.round((new Date(ci.check_out_date + "T00:00:00").getTime() - new Date(ci.check_in_date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24))
          : "—";
        const nationality = ci.guest_nationality || "—";
        return `<tr><td ${tdStyle(i)}>${ci.guest_names?.[0] || "N/A"}</td><td ${tdStyle(i)}>${formatRoomDisplay(ci.units)}</td><td ${tdStyle(i)}>${ci.source || ci.channel || "N/A"}</td><td ${tdStyle(i)}>${nights}</td><td ${tdStyle(i)}>${nationality}</td></tr>`;
      }).join("")
    : `<tr><td colspan="5" style="padding:12px;color:#888;">No check-ins today</td></tr>`;

  const checkOutRows = checkOuts.length > 0
    ? checkOuts.map((co, i) => `<tr><td ${tdStyle(i)}>${co.guest_names?.[0] || "N/A"}</td><td ${tdStyle(i)}>${formatRoomDisplay(co.units)}</td><td ${tdStyle(i)}>${co.source || co.channel || "N/A"}</td></tr>`).join("")
    : `<tr><td colspan="3" style="padding:12px;color:#888;">No check-outs today</td></tr>`;

  const inHouseRows = inHouseGuests.length > 0
    ? inHouseGuests.map((g, i) => `<tr><td ${tdStyle(i)}>${g.guest_name}</td><td ${tdStyle(i)}>${g.room}</td><td ${tdStyle(i)}>${g.source}</td><td ${tdStyle(i)}>${g.nights_remaining}</td><td ${tdStyle(i)}>${g.nationality}</td></tr>`).join("")
    : `<tr><td colspan="5" style="padding:12px;color:#888;">No in-house guests currently</td></tr>`;

  const blockedSection = blockedRooms.length > 0
    ? `
        <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">🚫 Blocked Rooms (${blockedRooms.length})</h2>
        <table ${tableStyle}>
          <tr><th ${thStyle()}>Room</th><th ${thStyle()}>Reason</th></tr>
          ${blockedRooms.map((br, i) => `<tr><td ${tdStyle(i)}>${br.room}</td><td ${tdStyle(i)}>${br.reason || "—"}</td></tr>`).join("")}
        </table>
      `
    : "";

  const headerHTML = `
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#222;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td bgcolor="#0f172a" style="background-color:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-family:Arial,sans-serif;">SuiteSpot Daily Summary</h1>
            <p style="color:#ffffff;margin:4px 0 0;font-size:14px;font-family:Arial,sans-serif;">${propertyName} — ${dateStr}</p>
          </td>
        </tr>
      </table>`;

  const bodyContentHTML = `
        <h2 style="font-size:16px;color:#1e293b;margin:0 0 8px;">📥 Today's Check-ins (${checkIns.length})</h2>
        <table ${tableStyle}>
          <tr><th ${thStyle()}>Guest Name</th><th ${thStyle()}>Room</th><th ${thStyle()}>Source</th><th ${thStyle()}>Nights</th><th ${thStyle()}>Nationality</th></tr>
          ${checkInRows}
        </table>

        <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">🏨 In-House Guests (${inHouseGuests.length})</h2>
        <table ${tableStyle}>
          <tr><th ${thStyle()}>Guest Name</th><th ${thStyle()}>Room</th><th ${thStyle()}>Source</th><th ${thStyle()}>Nights Remaining</th><th ${thStyle()}>Nationality</th></tr>
          ${inHouseRows}
        </table>

        <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">📤 Today's Check-outs (${checkOuts.length})</h2>
        <table ${tableStyle}>
          <tr><th ${thStyle()}>Guest Name</th><th ${thStyle()}>Room</th><th ${thStyle()}>Source</th></tr>
          ${checkOutRows}
        </table>

        ${blockedSection}

        <h2 style="font-size:16px;color:#1e293b;margin:20px 0 8px;">🏠 Today's Occupancy</h2>
        <div style="background:#f1f5f9;padding:16px;border-radius:8px;border:1px solid #cbd5e1;">
          <table style="width:100%;">
            <tr><td style="padding:4px 0;font-size:14px;">Occupied</td><td style="text-align:right;font-weight:bold;font-size:14px;">${occupancy.occupied} rooms</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;">Vacant</td><td style="text-align:right;font-weight:bold;font-size:14px;">${occupancy.vacant} rooms</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;">Total</td><td style="text-align:right;font-weight:bold;font-size:14px;">${occupancy.total} rooms</td></tr>
            <tr><td colspan="2" style="padding:8px 0 0;text-align:center;font-size:22px;font-weight:bold;color:#0f172a;">${occupancy.rate.toFixed(1)}% Occupancy</td></tr>
          </table>
        </div>

        <p style="margin:24px 0 0;font-size:11px;color:#999;">Generated automatically by SuiteSpot PMS — ${new Date().toISOString()}</p>`;

  return { headerHTML, bodyContentHTML };
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
    const dateDisplay = formatDate(today);

    // Get default property
    const { data: property } = await supabase
      .from("properties")
      .select("id, name")
      .eq("is_default", true)
      .single();

    if (!property) {
      console.log("No default property found");
      return new Response(JSON.stringify({ error: "No default property" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recipients filtered by property access
    const recipients = await getRecipients(supabase, property.id);
    if (recipients.length === 0) {
      await supabase.from("summary_report_log").insert({
        report_type: "daily",
        property_id: property.id,
        report_date: todayStr,
        status: "sent",
        error_message: "No recipients configured",
        sent_at: new Date().toISOString(),
      });
      console.log("No recipients configured, skipping daily summary");
      await triggerAdditionalReports(supabaseUrl, supabaseKey, today);
      return new Response(JSON.stringify({ success: true, message: "No recipients" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch check-ins today (with room details + booking_reference to filter extensions)
    const { data: rawCheckIns } = await supabase
      .from("reservations")
      .select("guest_names, source, channel, booking_reference, check_in_date, check_out_date, guest_nationality, units!unit_id(name, booking_com_name, unit_number)")
      .eq("check_in_date", todayStr)
      .in("status", ["confirmed", "checked-in"])
      .eq("property_id", property.id);

    // Filter out extension bookings — they are NOT new arrivals
    const checkIns = (rawCheckIns || []).filter(
      (r: any) => !r.booking_reference || !r.booking_reference.toUpperCase().includes("EXT")
    );

    // Fetch check-outs today (with room details)
    const { data: checkOuts } = await supabase
      .from("reservations")
      .select("guest_names, source, channel, units!unit_id(name, booking_com_name, unit_number)")
      .eq("check_out_date", todayStr)
      .in("status", ["confirmed", "checked-in", "checked-out", "completed"])
      .eq("property_id", property.id);

    // Fetch in-house guests (checked in before today, checking out after today)
    const { data: inHouseData } = await supabase
      .from("reservations")
      .select("guest_names, source, channel, check_out_date, guest_nationality, booking_reference, units!unit_id(name, booking_com_name, unit_number)")
      .lt("check_in_date", todayStr)
      .gt("check_out_date", todayStr)
      .eq("status", "checked-in")
      .eq("property_id", property.id);

    // Fetch extension bookings checking in TODAY (these guests are already in-house)
    const { data: extensionCheckIns } = await supabase
      .from("reservations")
      .select("guest_names, source, channel, check_out_date, guest_nationality, booking_reference, unit_id, units!unit_id(name, booking_com_name, unit_number)")
      .eq("check_in_date", todayStr)
      .in("status", ["confirmed", "checked-in"])
      .eq("property_id", property.id)
      .ilike("booking_reference", "%EXT%");

    // Helper: extract base booking reference by stripping -EXT, -EXT2, -EXT3 suffixes
    function getBaseReference(ref: string): string {
      if (!ref) return ref;
      return ref.replace(/-EXT\d*$/i, "");
    }

    // Collect base references from extensions to look up original booking sources
    const extBaseRefs = (extensionCheckIns || [])
      .map((e: any) => getBaseReference(e.booking_reference))
      .filter((r: string) => r);
    const uniqueBaseRefs = [...new Set(extBaseRefs)];

    // Fetch original bookings for source resolution
    let originalSourceMap = new Map<string, string>();
    if (uniqueBaseRefs.length > 0) {
      const { data: originals } = await supabase
        .from("reservations")
        .select("booking_reference, source, channel")
        .in("booking_reference", uniqueBaseRefs)
        .eq("property_id", property.id);
      for (const orig of originals || []) {
        originalSourceMap.set(orig.booking_reference, orig.source || orig.channel || "N/A");
      }
    }

    // Merge regular in-house + extension check-ins, deduplicating by base reference
    const seenBaseRefs = new Set<string>();
    const mergedInHouse: any[] = [];

    // First add regular in-house guests
    for (const g of inHouseData || []) {
      const baseRef = g.booking_reference ? getBaseReference(g.booking_reference) : null;
      if (baseRef) seenBaseRefs.add(baseRef);
      mergedInHouse.push(g);
    }

    // Then add extension check-ins, but check if guest is already listed
    for (const ext of extensionCheckIns || []) {
      const baseRef = getBaseReference(ext.booking_reference);
      if (seenBaseRefs.has(baseRef)) {
        // Guest already in list — update their checkout date if extension is later
        const existing = mergedInHouse.find((g: any) => 
          g.booking_reference && getBaseReference(g.booking_reference) === baseRef
        );
        if (existing && ext.check_out_date > existing.check_out_date) {
          existing.check_out_date = ext.check_out_date;
        }
      } else {
        // New entry — use original source
        seenBaseRefs.add(baseRef);
        const origSource = originalSourceMap.get(baseRef);
        mergedInHouse.push({
          ...ext,
          source: origSource || ext.source,
          channel: origSource ? undefined : ext.channel,
        });
      }
    }

    // Process and sort in-house guests
    const inHouseGuests = mergedInHouse.map((g: any) => {
      const checkOutDate = new Date(g.check_out_date + "T00:00:00");
      const todayDate = new Date(todayStr + "T00:00:00");
      const nightsRemaining = Math.round((checkOutDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      const source = g.source || g.channel || "N/A";
      return {
        guest_name: g.guest_names?.[0] || "N/A",
        room: formatRoomDisplay(g.units),
        source,
        nights_remaining: nightsRemaining,
        nationality: g.guest_nationality || "—",
      };
    }).sort((a: any, b: any) => a.nights_remaining - b.nights_remaining || a.guest_name.localeCompare(b.guest_name));

    // Occupancy: count in-house guests
    const { data: inHouse } = await supabase
      .from("reservations")
      .select("id", { count: "exact" })
      .lte("check_in_date", todayStr)
      .gt("check_out_date", todayStr)
      .in("status", ["confirmed", "checked-in"])
      .eq("property_id", property.id);

    const occupied = inHouse?.length || 0;

    // Total units for property
    const { data: allUnits } = await supabase
      .from("units")
      .select("id")
      .eq("property_id", property.id);

    // Fetch blocked dates for today to get blocked unit IDs and details
    const { data: blockedToday } = await supabase
      .from("blocked_dates")
      .select("unit_id, reason, units(name, booking_com_name, unit_number)")
      .eq("blocked_date", todayStr);

    // Filter blocked dates to only include units belonging to this property
    const propertyUnitIds = new Set((allUnits || []).map((u: any) => u.id));
    const propertyBlockedToday = (blockedToday || []).filter(
      (b: any) => b.unit_id && propertyUnitIds.has(b.unit_id)
    );

    // Deduplicate blocked unit IDs
    const blockedUnitIds = new Set(propertyBlockedToday.map((b: any) => b.unit_id));

    // Build blocked rooms display data (deduplicated by unit)
    const blockedRoomsMap = new Map<string, { room: string; reason: string }>();
    for (const b of propertyBlockedToday) {
      if (!blockedRoomsMap.has(b.unit_id)) {
        blockedRoomsMap.set(b.unit_id, {
          room: formatRoomDisplay(b.units),
          reason: b.reason || "—",
        });
      }
    }
    const blockedRooms = Array.from(blockedRoomsMap.values());

    // Total rooms = all units minus blocked units
    const totalRooms = (allUnits?.length || 0) - blockedUnitIds.size;
    const vacant = Math.max(0, totalRooms - occupied);
    const occupancyRate = totalRooms > 0 ? (occupied / totalRooms) * 100 : 0;

    const occupancy = { occupied, vacant, total: totalRooms, rate: occupancyRate };

    // Generate email HTML
    const { headerHTML, bodyContentHTML } = generateEmailHTML(property.name, dateDisplay, checkIns || [], checkOuts || [], inHouseGuests, occupancy, blockedRooms);

    // Send emails with 600ms delay between recipients
    const sentEmails: string[] = [];
    let errorCount = 0;

    for (const recipient of recipients) {
      try {
        const firstName = getFirstName(recipient.name);
        const greeting = `<p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.5;">Hi ${firstName}, here's your daily summary for ${property.name} — ${dateDisplay}.</p>`;
        const dmHead = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;">`;
        const personalizedHTML = `${dmHead}${headerHTML}<div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">${greeting}${bodyContentHTML}</div></div></body></html>`;

        const emailResponse = await resend.emails.send({
          from: "Mia — SuiteSpot AI <ai-assistant@bookings.suitespoteg.com>",
          to: [recipient.email],
          subject: `Daily Summary — ${property.name} — ${dateDisplay}`,
          html: personalizedHTML,
        });
        console.log(`Email sent to ${recipient.email}:`, JSON.stringify(emailResponse));
        sentEmails.push(recipient.email);
      } catch (emailError) {
        console.error(`Error sending to ${recipient.email}:`, emailError);
        errorCount++;
      }

      if (recipients.indexOf(recipient) < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    // Log result
    await supabase.from("summary_report_log").insert({
      report_type: "daily",
      property_id: property.id,
      report_date: todayStr,
      recipients: sentEmails,
      pdf_url: null,
      status: errorCount === 0 ? "sent" : errorCount < recipients.length ? "partial" : "failed",
      error_message: errorCount > 0 ? `${errorCount} emails failed` : null,
      sent_at: new Date().toISOString(),
    });

    // Trigger weekly/monthly if needed
    await triggerAdditionalReports(supabaseUrl, supabaseKey, today);

    return new Response(
      JSON.stringify({ success: true, sent: sentEmails.length, errors: errorCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in generate-daily-summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

async function triggerAdditionalReports(supabaseUrl: string, serviceKey: string, today: Date) {
  const dayOfWeek = today.getDay();

  if (dayOfWeek === 4) {
    console.log("Today is Thursday — triggering weekly summary");
    try {
      await fetch(`${supabaseUrl}/functions/v1/generate-weekly-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ triggered_by: "daily-orchestrator" }),
      });
    } catch (e) {
      console.error("Error triggering weekly summary:", e);
    }
  }

  if (isLastWorkingDayOfMonth(today)) {
    console.log("Today is last working day of month — triggering monthly summary");
    try {
      await fetch(`${supabaseUrl}/functions/v1/generate-monthly-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ triggered_by: "daily-orchestrator" }),
      });
    } catch (e) {
      console.error("Error triggering monthly summary:", e);
    }
  }
}

Deno.serve(handler);
