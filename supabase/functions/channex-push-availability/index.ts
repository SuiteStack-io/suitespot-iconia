
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface AvailabilityUpdate {
  property_id: string;
  room_type_id: string;
  date_from: string;
  date_to: string;
  availability: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = user.id;

    // Admin check
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // --- Parse & normalize ---
    const body = await req.json();
    const updates: AvailabilityUpdate[] = body.updates
      ? body.updates
      : [
          {
            property_id: body.property_id,
            room_type_id: body.room_type_id,
            date_from: body.date_from,
            date_to: body.date_to,
            availability: body.availability,
          },
        ];

    // --- Validate ---
    for (let i = 0; i < updates.length; i++) {
      const u = updates[i];
      if (!u.property_id || !u.room_type_id) {
        return new Response(
          JSON.stringify({ error: `Update ${i}: property_id and room_type_id are required` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (!u.date_from || !DATE_RE.test(u.date_from) || !u.date_to || !DATE_RE.test(u.date_to)) {
        return new Response(
          JSON.stringify({ error: `Update ${i}: date_from and date_to must be YYYY-MM-DD` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (typeof u.availability !== "number" || u.availability < 0) {
        return new Response(
          JSON.stringify({ error: `Update ${i}: availability must be a non-negative number` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // --- Resolve Channex IDs ---
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const mappingCache: Record<string, string> = {};

    async function resolveChannexPropertyId(localId: string): Promise<string | null> {
      const key = `property:${localId}`;
      if (mappingCache[key]) return mappingCache[key];
      const { data } = await serviceSupabase
        .from("channex_mappings")
        .select("channex_id")
        .eq("local_id", localId)
        .eq("entity_type", "property")
        .maybeSingle();
      if (data) mappingCache[key] = data.channex_id;
      return data?.channex_id || null;
    }

    // Resolve room type via booking_com_name to handle unit ID mismatches
    async function resolveChannexRoomTypeId(unitId: string): Promise<string | null> {
      const cacheKey = `room_type:${unitId}`;
      if (mappingCache[cacheKey]) return mappingCache[cacheKey];

      // Step 1: Get booking_com_name from the provided unit ID
      const { data: unit } = await serviceSupabase
        .from("units")
        .select("booking_com_name, property_id")
        .eq("id", unitId)
        .maybeSingle();

      if (!unit?.booking_com_name) return null;

      // Step 2: Find any unit with that booking_com_name that has a channex mapping
      const { data: mapping } = await serviceSupabase
        .from("channex_mappings")
        .select("channex_id, local_id")
        .eq("entity_type", "room_type")
        .in(
          "local_id",
          (await serviceSupabase
            .from("units")
            .select("id")
            .eq("booking_com_name", unit.booking_com_name)
            .eq("property_id", unit.property_id)
          ).data?.map((u: { id: string }) => u.id) || []
        )
        .maybeSingle();

      if (mapping) mappingCache[cacheKey] = mapping.channex_id;
      return mapping?.channex_id || null;
    }

    const values: object[] = [];
    const errors: object[] = [];

    for (let i = 0; i < updates.length; i++) {
      const u = updates[i];
      const channexPropertyId = await resolveChannexPropertyId(u.property_id);
      if (!channexPropertyId) {
        errors.push({ index: i, error: "Property not synced to Channex", property_id: u.property_id });
        continue;
      }
      const channexRoomTypeId = await resolveChannexRoomTypeId(u.room_type_id);
      if (!channexRoomTypeId) {
        errors.push({ index: i, error: "Room type not synced to Channex", room_type_id: u.room_type_id });
        continue;
      }
      values.push({
        property_id: channexPropertyId,
        room_type_id: channexRoomTypeId,
        date_from: u.date_from,
        date_to: u.date_to,
        availability: u.availability,
      });
    }

    if (values.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "All updates failed mapping resolution", errors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // --- Push to Channex ---
    const channexPayload = { values };
    console.log(`[channex-push-availability] Pushing ${values.length} values to Channex`);

    const response = await channexRequest<object>("POST", "/api/v1/availability", channexPayload);

    // Log success
    await logSync(
      "channex-push-availability",
      "/api/v1/availability",
      channexPayload,
      response,
      200,
      true,
      null,
      updates[0]?.property_id || null
    );

    const result: Record<string, unknown> = {
      success: true,
      message: errors.length > 0 ? "Availability pushed with some errors" : "Availability pushed successfully",
      values_count: values.length,
    };
    if (errors.length > 0) result.errors = errors;

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("[channex-push-availability] Error:", err);

    // Log failure
    try {
      await logSync("channex-push-availability", "/api/v1/availability", null, null, null, false, err.message, null);
    } catch { /* ignore logging errors */ }

    const isChannexError = err.message?.includes("Channex API request failed");
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: isChannexError ? 502 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
