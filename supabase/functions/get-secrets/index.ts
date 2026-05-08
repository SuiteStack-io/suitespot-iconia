// TEMPORARY admin-only secret echo for migration. Delete after use.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SECRET_NAMES = [
  "ANTHROPIC_API_KEY",
  "CHANNEX_API_KEY",
  "CHANNEX_BASE_URL",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "RESEND_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  "TWILIO_CHECKOUT_TEMPLATE_SID",
  "TWILIO_MIDSTAY_TEMPLATE_SID",
  "TWILIO_WELCOME_TEMPLATE_SID",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: "Server not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: roles, error: rolesErr } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (rolesErr) return json({ error: "Role check failed" }, 500);
  const isAdmin = (roles ?? []).some(
    (r: any) => r.role === "admin" || r.role === "super_admin",
  );
  if (!isAdmin) return json({ error: "Admin access required" }, 403);

  const out: Record<string, string | null> = {};
  for (const name of SECRET_NAMES) {
    out[name] = Deno.env.get(name) ?? null;
  }

  // Don't log values
  console.log(`get-secrets: ok user=${user.id} count=${SECRET_NAMES.length}`);

  return json({
    warning: "Sensitive — copy and then delete this function.",
    secrets: out,
  });
});
