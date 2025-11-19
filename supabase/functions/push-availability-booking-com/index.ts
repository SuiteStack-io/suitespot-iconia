import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AvailabilityPushRequest {
  bookingComRoomId: string;
  dateFrom: string;
  dateTo: string;
  available: number; // 0 = unavailable, 1 = available
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Booking.com API credentials
    const hotelId = Deno.env.get('BOOKING_COM_HOTEL_ID');
    const apiUsername = Deno.env.get('BOOKING_COM_API_USERNAME');
    const apiPassword = Deno.env.get('BOOKING_COM_API_PASSWORD');

    if (!hotelId || !apiUsername || !apiPassword) {
      console.error('Missing Booking.com API credentials');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'MISSING_CREDENTIALS',
          message: 'Booking.com API credentials not configured',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { bookingComRoomId, dateFrom, dateTo, available }: AvailabilityPushRequest = await req.json();

    console.log('Pushing availability to Booking.com:', { 
      hotelId, 
      roomId: bookingComRoomId, 
      dateFrom, 
      dateTo, 
      available 
    });

    // Build XML payload for Booking.com ARI (Availability, Rates, Inventory) API
    const dates = generateDateRange(dateFrom, dateTo);
    const roomAvailabilityXml = dates.map(date => 
      `    <date value="${date}">
      <avail>${available}</avail>
    </date>`
    ).join('\n');

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <username>${apiUsername}</username>
  <password>${apiPassword}</password>
  <hotel_id>${hotelId}</hotel_id>
  <room id="${bookingComRoomId}">
${roomAvailabilityXml}
  </room>
</request>`;

    console.log('XML Payload:', xmlPayload);

    // Call Booking.com API
    const bookingComResponse = await fetch('https://supply-xml.booking.com/hotels/ari/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: xmlPayload,
    });

    const responseText = await bookingComResponse.text();
    console.log('Booking.com API Response:', responseText);

    // Log the sync operation
    const { error: logError } = await supabase
      .from('booking_com_sync_log')
      .insert({
        operation_type: 'push_availability',
        direction: 'outbound',
        booking_com_room_id: bookingComRoomId,
        status: bookingComResponse.ok ? 'success' : 'error',
        request_payload: { 
          dateFrom, 
          dateTo, 
          available,
          roomId: bookingComRoomId 
        },
        response_payload: { 
          statusCode: bookingComResponse.status,
          response: responseText 
        },
        error_message: bookingComResponse.ok ? null : responseText,
      });

    if (logError) {
      console.error('Error logging sync operation:', logError);
    }

    if (!bookingComResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'BOOKING_COM_API_ERROR',
          message: 'Failed to push availability to Booking.com',
          details: responseText,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully pushed availability (${available}) for ${dates.length} dates`,
        datesUpdated: dates.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Push availability error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Helper function to generate array of dates between two dates
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
