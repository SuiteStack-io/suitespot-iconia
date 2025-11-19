import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AllocationRequest {
  bookingComRoomId: string;
  checkInDate: string;
  checkOutDate: string;
  guestNames: string[];
  bookingReference: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bookingComRoomId, checkInDate, checkOutDate, guestNames, bookingReference }: AllocationRequest = await req.json();

    console.log('Allocating unit for:', { bookingComRoomId, checkInDate, checkOutDate, bookingReference });

    // Get all units with this Booking.com Room ID
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, unit_number, name')
      .eq('booking_com_id', bookingComRoomId)
      .neq('status', 'maintenance')
      .order('unit_number', { ascending: true });

    if (unitsError) {
      console.error('Error fetching units:', unitsError);
      throw unitsError;
    }

    if (!units || units.length === 0) {
      console.error('No units found for Booking.com Room ID:', bookingComRoomId);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NO_UNITS_FOUND',
          message: `No units configured for Booking.com Room ID: ${bookingComRoomId}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log(`Found ${units.length} units with Room ID ${bookingComRoomId}:`, units.map(u => u.unit_number));

    // Check each unit for availability (First Available strategy)
    for (const unit of units) {
      // Check if unit has any conflicting reservations
      const { data: conflicts, error: conflictError } = await supabase.rpc(
        'has_reservation_conflict',
        {
          p_unit_id: unit.id,
          p_check_in_date: checkInDate,
          p_check_out_date: checkOutDate,
        }
      );

      if (conflictError) {
        console.error('Error checking conflicts for unit:', unit.unit_number, conflictError);
        continue; // Try next unit
      }

      // If no conflict, this unit is available - allocate it!
      if (!conflicts) {
        console.log(`Unit ${unit.unit_number} is available - allocating`);

        return new Response(
          JSON.stringify({
            success: true,
            allocatedUnit: {
              id: unit.id,
              unit_number: unit.unit_number,
              name: unit.name,
            },
            strategy: 'first_available',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } else {
        console.log(`Unit ${unit.unit_number} has conflict - checking next`);
      }
    }

    // No available units found
    console.error('All units are booked for the requested dates');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'NO_AVAILABILITY',
        message: 'All units are booked for the requested dates',
        unitsChecked: units.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
    );

  } catch (error: any) {
    console.error('Allocation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
