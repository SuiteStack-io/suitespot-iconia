import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { booking_id, message_type } = await req.json();

    if (!booking_id || !message_type) {
      return new Response(
        JSON.stringify({ error: "booking_id and message_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map message_type to template SID env var
    const templateMap: Record<string, string> = {
      welcome: "TWILIO_WELCOME_TEMPLATE_SID",
      midstay: "TWILIO_MIDSTAY_TEMPLATE_SID",
      checkout: "TWILIO_CHECKOUT_TEMPLATE_SID",
    };

    const templateEnvKey = templateMap[message_type];
    if (!templateEnvKey) {
      return new Response(
        JSON.stringify({ error: `Invalid message_type: ${message_type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Duplicate check
    const { data: existing } = await supabase
      .from("whatsapp_message_log")
      .select("id")
      .eq("reservation_id", booking_id)
      .eq("message_type", message_type)
      .eq("status", "sent")
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Duplicate: ${message_type} already sent for ${booking_id}`);
      return new Response(
        JSON.stringify({ status: "skipped", reason: "already sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up reservation for guest name
    const { data: reservation, error: resError } = await supabase
      .from("reservations")
      .select("guest_names, booking_reference")
      .eq("id", booking_id)
      .single();

    if (resError || !reservation) {
      await logMessage(supabase, booking_id, "", "", message_type, "failed", "Reservation not found", null);
      return new Response(
        JSON.stringify({ error: "Reservation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guestName = reservation.guest_names?.[0] || "Guest";

    // Look up phone from check_in_agreements
    const { data: agreement } = await supabase
      .from("check_in_agreements")
      .select("guest_phone")
      .eq("reservation_id", booking_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!agreement?.guest_phone) {
      await logMessage(supabase, booking_id, guestName, "", message_type, "skipped", "No phone number", null);
      console.log(`Skipped: no phone for ${booking_id}`);
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no phone number" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone: strip spaces, dashes, parens
    let phone = agreement.guest_phone.replace(/[\s\-\(\)]/g, "");

    if (!phone.startsWith("+")) {
      await logMessage(supabase, booking_id, guestName, phone, message_type, "skipped", "Invalid phone format — missing +", null);
      return new Response(
        JSON.stringify({ status: "skipped", reason: "invalid phone format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toNumber = `whatsapp:${phone}`;

    // Read Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM")!;
    const contentSid = Deno.env.get(templateEnvKey)!;

    // Call Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const body = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify({ "1": guestName }),
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (twilioResponse.ok) {
      await logMessage(
        supabase, booking_id, guestName, phone, message_type, "sent", null, twilioData.sid
      );
      console.log(`Sent ${message_type} to ${phone} for ${booking_id}`);
      return new Response(
        JSON.stringify({ status: "sent", twilio_sid: twilioData.sid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMsg = twilioData.message || JSON.stringify(twilioData);
      await logMessage(
        supabase, booking_id, guestName, phone, message_type, "failed", errorMsg, null
      );
      console.error(`Twilio error for ${booking_id}:`, errorMsg);
      return new Response(
        JSON.stringify({ status: "failed", error: errorMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("send-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function logMessage(
  supabase: any,
  reservationId: string,
  guestName: string,
  phone: string,
  messageType: string,
  status: string,
  errorMessage: string | null,
  twilioSid: string | null
) {
  try {
    await supabase.from("whatsapp_message_log").insert({
      reservation_id: reservationId,
      guest_name: guestName,
      phone_number: phone,
      message_type: messageType,
      message_body: `Template: ${messageType}`,
      status,
      error_message: errorMessage,
      twilio_message_sid: twilioSid,
    });
  } catch (e) {
    console.error("Failed to log message:", e);
  }
}
