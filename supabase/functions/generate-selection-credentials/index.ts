import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  kycLinkId: string;
  guestName: string;
  selectedUnitIds: string[];
}

const generatePassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const generateToken = (): string => {
  return crypto.randomUUID();
};

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { kycLinkId, guestName, selectedUnitIds }: RequestBody = await req.json();

    console.log("Generating credentials for:", { kycLinkId, guestName, unitCount: selectedUnitIds.length });

    // Generate username (firstname_lastname)
    const nameParts = guestName.trim().toLowerCase().split(" ");
    let baseUsername = nameParts.join("_");
    let username = baseUsername;
    let counter = 1;

    // Ensure username is unique
    while (true) {
      const { data: existing } = await supabase
        .from("selection_accounts")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (!existing) break;
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Generate password and token
    const password = generatePassword();
    const token = generateToken();
    const passwordHash = await hashPassword(password);

    // Get current user ID
    const authHeader = req.headers.get("Authorization");
    const userToken = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(userToken);

    // Create selection account
    const { data: account, error: accountError } = await supabase
      .from("selection_accounts")
      .insert({
        kyc_link_id: kycLinkId,
        username,
        password_hash: passwordHash,
        landing_page_token: token,
        created_by: user?.id
      })
      .select()
      .single();

    if (accountError) {
      console.error("Error creating selection account:", accountError);
      throw accountError;
    }

    console.log("Selection account created:", account.id);

    // Delete existing inventory access for this KYC link
    await supabase
      .from("guest_inventory_access")
      .delete()
      .eq("kyc_link_id", kycLinkId);

    // Insert new inventory access records
    const accessRecords = selectedUnitIds.map(unitId => ({
      kyc_link_id: kycLinkId,
      unit_id: unitId,
      created_by: user?.id
    }));

    const { error: accessError } = await supabase
      .from("guest_inventory_access")
      .insert(accessRecords);

    if (accessError) {
      console.error("Error creating inventory access:", accessError);
      throw accessError;
    }

    console.log("Inventory access created for", selectedUnitIds.length, "units");

    // Update KYC link outcome to 'accepted'
    const { error: outcomeError } = await supabase
      .from("kyc_links")
      .update({
        outcome: "accepted",
        outcome_at: new Date().toISOString(),
        outcome_by: user?.id
      })
      .eq("id", kycLinkId);

    if (outcomeError) {
      console.error("Error updating KYC outcome:", outcomeError);
      // Don't throw - credentials were generated successfully
    }

    console.log("KYC link outcome updated to 'accepted'");

    return new Response(
      JSON.stringify({
        username,
        password,
        token
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error: any) {
    console.error("Error in generate-selection-credentials:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
