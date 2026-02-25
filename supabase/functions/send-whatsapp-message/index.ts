import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservationId, messageType } = await req.json();

    if (!reservationId || !messageType) {
      return new Response(
        JSON.stringify({ error: "reservationId and messageType required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch reservation + unit
    const { data: reservation, error: resError } = await supabase
      .from("reservations")
      .select("id, guest_names, check_in_date, check_out_date, nights, unit_id, booking_reference, units!unit_id(name, booking_com_name)")
      .eq("id", reservationId)
      .single();

    if (resError || !reservation) {
      return new Response(
        JSON.stringify({ error: "Reservation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get phone from check_in_agreements
    const { data: agreement } = await supabase
      .from("check_in_agreements")
      .select("guest_phone, guest_full_name")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const guestName = agreement?.guest_full_name || reservation.guest_names?.[0] || "Guest";
    const phoneRaw = agreement?.guest_phone || null;

    // 3. Fetch template
    const { data: template } = await supabase
      .from("whatsapp_message_templates")
      .select("*")
      .eq("template_type", messageType)
      .limit(1)
      .single();

    if (!template) {
      await logMessage(supabase, {
        reservation_id: reservationId,
        guest_name: guestName,
        phone_number: phoneRaw || "unknown",
        message_type: messageType,
        message_body: "",
        status: "skipped",
        error_message: "No template found for type: " + messageType,
      });
      return new Response(
        JSON.stringify({ status: "skipped", reason: "No template found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check if template is disabled
    if (!template.is_enabled) {
      await logMessage(supabase, {
        reservation_id: reservationId,
        guest_name: guestName,
        phone_number: phoneRaw || "unknown",
        message_type: messageType,
        message_body: "",
        status: "skipped",
        error_message: "Template is disabled",
      });
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Template disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Check phone
    if (!phoneRaw) {
      await logMessage(supabase, {
        reservation_id: reservationId,
        guest_name: guestName,
        phone_number: "none",
        message_type: messageType,
        message_body: "",
        status: "skipped",
        error_message: "No phone number available",
      });
      return new Response(
        JSON.stringify({ status: "skipped", reason: "No phone number" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number
    const cleanPhone = phoneRaw.replace(/[\s\-\(\)]/g, "");
    if (!cleanPhone.startsWith("+") || cleanPhone.length < 10) {
      await logMessage(supabase, {
        reservation_id: reservationId,
        guest_name: guestName,
        phone_number: cleanPhone,
        message_type: messageType,
        message_body: "",
        status: "skipped",
        error_message: "Invalid phone format: " + cleanPhone,
      });
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Invalid phone format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Duplicate check
    const { data: existing } = await supabase
      .from("whatsapp_message_log")
      .select("id")
      .eq("reservation_id", reservationId)
      .eq("message_type", messageType)
      .in("status", ["sent", "delivered"])
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Already sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Rate limit: 1 message per phone per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentMessages } = await supabase
      .from("whatsapp_message_log")
      .select("id")
      .eq("phone_number", cleanPhone)
      .in("status", ["sent", "delivered"])
      .gte("sent_at", oneHourAgo)
      .limit(1);

    if (recentMessages && recentMessages.length > 0) {
      await logMessage(supabase, {
        reservation_id: reservationId,
        guest_name: guestName,
        phone_number: cleanPhone,
        message_type: messageType,
        message_body: "",
        status: "skipped",
        error_message: "Rate limited: message sent to this number within the last hour",
      });
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Rate limited" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Resolve placeholders
    const unit = reservation.units as any;
    const roomName = unit?.booking_com_name || unit?.name || "Your Suite";
    const renderedBody = template.message_body
      .replace(/\{\{guest_name\}\}/g, guestName)
      .replace(/\{\{room_name\}\}/g, roomName)
      .replace(/\{\{checkin_date\}\}/g, reservation.check_in_date || "")
      .replace(/\{\{checkout_date\}\}/g, reservation.check_out_date || "")
      .replace(/\{\{property_name\}\}/g, "ICONIA Zamalek");

    // 9. Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM")!;

    // Determine ContentSid
    const contentSidMap: Record<string, string> = {
      welcome: Deno.env.get("TWILIO_WELCOME_TEMPLATE_SID") || "",
      midstay: Deno.env.get("TWILIO_MIDSTAY_TEMPLATE_SID") || "",
      checkout: Deno.env.get("TWILIO_CHECKOUT_TEMPLATE_SID") || "",
    };
    const contentSid = template.twilio_content_sid || contentSidMap[messageType] || "";

    const toNumber = `whatsapp:${cleanPhone}`;

    // 10. Build request body
    const body = new URLSearchParams();
    body.append("From", fromNumber);
    body.append("To", toNumber);
    
    if (contentSid) {
      body.append("ContentSid", contentSid);
      // Build content variables from placeholders
      const contentVars = JSON.stringify({
        "1": guestName,
        "2": roomName,
        "3": reservation.check_in_date || "",
        "4": reservation.check_out_date || "",
        "5": "ICONIA Zamalek",
      });
      body.append("ContentVariables", contentVars);
    } else {
      body.append("Body", renderedBody);
    }

    // 11. Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      await logMessage(supabase, {
        reservation_id: reservationId,
        guest_name: guestName,
        phone_number: cleanPhone,
        message_type: messageType,
        message_body: renderedBody,
        status: "failed",
        error_message: twilioResult.message || JSON.stringify(twilioResult),
      });
      return new Response(
        JSON.stringify({ status: "failed", error: twilioResult.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 12. Log success
    await logMessage(supabase, {
      reservation_id: reservationId,
      guest_name: guestName,
      phone_number: cleanPhone,
      message_type: messageType,
      message_body: renderedBody,
      status: "sent",
      twilio_message_sid: twilioResult.sid,
    });

    return new Response(
      JSON.stringify({ status: "sent", sid: twilioResult.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-whatsapp-message error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function logMessage(supabase: any, data: {
  reservation_id: string;
  guest_name: string;
  phone_number: string;
  message_type: string;
  message_body: string;
  status: string;
  error_message?: string;
  twilio_message_sid?: string;
}) {
  await supabase.from("whatsapp_message_log").insert({
    reservation_id: data.reservation_id,
    guest_name: data.guest_name,
    phone_number: data.phone_number,
    message_type: data.message_type,
    message_body: data.message_body,
    status: data.status,
    error_message: data.error_message || null,
    twilio_message_sid: data.twilio_message_sid || null,
  });
}
