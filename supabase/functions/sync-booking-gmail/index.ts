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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get stored refresh token
    const { data: syncStatus, error: fetchError } = await supabase
      .from('sync_status')
      .select('error_message')
      .eq('sync_type', 'booking_com_gmail')
      .single();

    if (fetchError || !syncStatus?.error_message) {
      throw new Error('Gmail not authenticated. Please connect Gmail first.');
    }

    const refreshToken = syncStatus.error_message;
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

    // Get new access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh access token');
    }

    const { access_token } = await tokenResponse.json();

    // Search for Booking.com confirmation emails
    const query = 'from:noreply@booking.com subject:(confirmation OR booking)';
    const gmailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    if (!gmailResponse.ok) {
      throw new Error('Failed to fetch Gmail messages');
    }

    const { messages } = await gmailResponse.json();
    
    if (!messages || messages.length === 0) {
      console.log('No Booking.com emails found');
      return new Response(
        JSON.stringify({ message: 'No new Booking.com emails found', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;

    // Process each message
    for (const message of messages) {
      const detailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      if (detailResponse.ok) {
        const detail = await detailResponse.json();
        // TODO: Parse email and extract reservation data
        console.log('Email received:', detail.snippet);
        processedCount++;
      }
    }

    // Update last sync time
    await supabase
      .from('sync_status')
      .update({
        last_sync_at: new Date().toISOString(),
        status: 'idle',
      })
      .eq('sync_type', 'booking_com_gmail');

    console.log(`Processed ${processedCount} Booking.com emails`);

    return new Response(
      JSON.stringify({ message: 'Sync completed', processedCount }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error syncing Gmail:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update status with error
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase
      .from('sync_status')
      .update({
        status: 'error',
        error_message: errorMessage,
      })
      .eq('sync_type', 'booking_com_gmail');

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
