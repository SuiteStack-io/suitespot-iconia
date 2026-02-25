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

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM")!;
  const contentSid = Deno.env.get("TWILIO_MIDSTAY_TEMPLATE_SID")!;

  try {
    // Get today's date in YYYY-MM-DD
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Find checked-in reservations where check_in_date + 2 = today (day 3)
    // and nights >= 3
    const { data: reservations, error: resError } = await supabase
      .from("reservations")
      .select("id, guest_names, check_in_date, check_out_date, nights")
      .eq("status", "checked-in")
      .is("cancelled_at", null);

    if (resError) {
      console.error("Error fetching reservations:", resError);
      return new Response(JSON.stringify({ error: resError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const res of reservations || []) {
      // Calculate day of stay
      const checkIn = new Date(res.check_in_date + "T00:00:00Z");
      const diffMs = today.getTime() - checkIn.getTime();
      const dayOfStay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Day 3 = check_in_date + 2 days
      if (dayOfStay !== 2) continue;

      // Skip short stays (less than 3 nights)
      const totalNights = res.nights || Math.floor(
        (new Date(res.check_out_date + "T00:00:00Z").getTime() - checkIn.getTime()) /
        (1000 * 60 * 60 * 24)
      );
      if (totalNights < 3) {
        skippedCount++;
        continue;
      }

      // Duplicate check
      const { data: existing } = await supabase
        .from("whatsapp_message_log")
        .select("id")
        .eq("reservation_id", res.id)
        .eq("message_type", "midstay")
        .eq("status", "sent")
        .limit(1);

      if (existing && existing.length > 0) {
        skippedCount++;
        continue;
      }

      // Get phone from check_in_agreements
      const { data: agreement } = await supabase
        .from("check_in_agreements")
        .select("guest_phone")
        .eq("reservation_id", res.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const guestName = res.guest_names?.[0] || "Guest";

      if (!agreement?.guest_phone) {
        await logMessage(supabase, res.id, guestName, "", "midstay", "skipped", "No phone number", null);
        skippedCount++;
        continue;
      }

      let phone = agreement.guest_phone.replace(/[\s\-\(\)]/g, "");
      if (!phone.startsWith("+")) {
        await logMessage(supabase, res.id, guestName, phone, "midstay", "skipped", "Invalid phone format", null);
        skippedCount++;
        continue;
      }

      // Send via Twilio
      const toNumber = `whatsapp:${phone}`;
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      const body = new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        ContentSid: contentSid,
        ContentVariables: JSON.stringify({ "1": guestName }),
      });

      try {
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
          await logMessage(supabase, res.id, guestName, phone, "midstay", "sent", null, twilioData.sid);
          sentCount++;
        } else {
          const errorMsg = twilioData.message || JSON.stringify(twilioData);
          await logMessage(supabase, res.id, guestName, phone, "midstay", "failed", errorMsg, null);
          skippedCount++;
        }
      } catch (fetchError) {
        await logMessage(supabase, res.id, guestName, phone, "midstay", "failed", "Connection error", null);
        skippedCount++;
      }
    }

    console.log(`Mid-stay check complete: ${sentCount} sent, ${skippedCount} skipped`);
    return new Response(
      JSON.stringify({ sent: sentCount, skipped: skippedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-whatsapp-midstay error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
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
