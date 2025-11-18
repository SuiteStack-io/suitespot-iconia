import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Testing Gmail connection...');

    // Get the sync status with refresh token
    const { data: syncStatus, error: syncError } = await supabase
      .from('sync_status')
      .select('*')
      .eq('sync_type', 'booking_com_gmail')
      .single();

    if (syncError) {
      console.error('Error fetching sync status:', syncError);
      return new Response(
        JSON.stringify({
          connected: false,
          error: 'Failed to fetch sync status',
          details: syncError
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (!syncStatus.refresh_token) {
      console.log('No refresh token found');
      return new Response(
        JSON.stringify({
          connected: false,
          message: 'Gmail not connected. Please connect your Gmail account.',
          last_sync_at: syncStatus.last_sync_at,
          status: syncStatus.status
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Try to refresh the token
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Gmail OAuth credentials not configured');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: syncStatus.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token refresh failed:', errorData);
      
      return new Response(
        JSON.stringify({
          connected: false,
          error: 'Token refresh failed. Please reconnect your Gmail account.',
          details: errorData,
          last_sync_at: syncStatus.last_sync_at
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Token refresh successful');

    return new Response(
      JSON.stringify({
        connected: true,
        message: 'Gmail connection is healthy',
        last_sync_at: syncStatus.last_sync_at,
        status: syncStatus.status,
        token_expires_in: tokenData.expires_in
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error testing Gmail connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        connected: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
