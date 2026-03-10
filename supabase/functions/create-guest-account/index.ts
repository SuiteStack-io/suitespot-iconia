
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { reservationId, firstName, lastName } = await req.json();

    if (!reservationId || !firstName || !lastName) {
      throw new Error('Missing required fields: reservationId, firstName, and lastName');
    }

    console.log('Creating guest account for reservation:', reservationId);

    // Check number of active guest accounts for this reservation
    const { count, error: countError } = await supabaseClient
      .from('guest_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('reservation_id', reservationId)
      .eq('is_active', true);

    if (countError) {
      console.error('Error checking existing accounts:', countError);
      throw new Error('Failed to check existing accounts');
    }

    if (count && count >= 4) {
      throw new Error('Maximum of 4 active guest accounts per reservation reached');
    }

    // Generate username using database function
    const { data: usernameData, error: usernameError } = await supabaseClient
      .rpc('generate_guest_username', { 
        p_first_name: firstName,
        p_last_name: lastName 
      });

    if (usernameError) {
      console.error('Error generating username:', usernameError);
      throw new Error('Failed to generate username');
    }

    const username = usernameData;

    // Generate random password (8 characters, alphanumeric)
    const password = generatePassword();

    // Hash password using Web Crypto API (compatible with edge functions)
    const passwordHash = await hashPassword(password);

    // Get current user (admin creating the account)
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    // Create guest account
    const { data: guestAccount, error: createError } = await supabaseClient
      .from('guest_accounts')
      .insert({
        reservation_id: reservationId,
        username: username,
        password_hash: passwordHash,
        created_by: user?.id,
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating guest account:', createError);
      throw new Error('Failed to create guest account');
    }

    console.log('Guest account created successfully:', guestAccount.id);

    return new Response(
      JSON.stringify({
        success: true,
        username: username,
        password: password,
        accountId: guestAccount.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-guest-account function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}
