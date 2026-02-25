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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find checked-in reservations where today is day 3 (check_in_date + 2 = today)
    // and stay is >= 3 nights
    const today = new Date().toISOString().split("T")[0];

    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("id, check_in_date, check_out_date, nights, guest_names")
      .eq("status", "checked-in")
      .filter("nights", "gte", 3);

    if (error) {
      console.error("Error fetching reservations:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    let skipped = 0;

    for (const res of reservations || []) {
      // Calculate if today is day 3 (check_in_date + 2 days)
      const checkInDate = new Date(res.check_in_date);
      const day3Date = new Date(checkInDate);
      day3Date.setDate(day3Date.getDate() + 2);
      const day3Str = day3Date.toISOString().split("T")[0];

      if (day3Str !== today) {
        skipped++;
        continue;
      }

      // Check if already sent for this reservation
      const { data: existing } = await supabase
        .from("whatsapp_message_log")
        .select("id")
        .eq("reservation_id", res.id)
        .eq("message_type", "midstay")
        .in("status", ["sent", "delivered"])
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Call the send-whatsapp-message function via HTTP
      const sendUrl = `${supabaseUrl}/functions/v1/send-whatsapp-message`;
      const sendResponse = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          reservationId: res.id,
          messageType: "midstay",
        }),
      });

      const result = await sendResponse.json();
      if (result.status === "sent") {
        sent++;
      } else {
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ sent, skipped, total: reservations?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-whatsapp-midstay-cron error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
