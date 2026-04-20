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

    // IDEMPOTENCY CHECK: Prevent duplicate processing if Booking.com sends same webhook twice
    const { data: existingReservation, error: checkError } = await supabase
      .from('reservations')
      .select('id, unit_id, status')
      .eq('booking_reference', bookingReference)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing reservation:', checkError);
      throw checkError;
    }

    if (existingReservation) {
      console.log('Reservation already exists (idempotency):', existingReservation.id);
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          message: 'Reservation already processed',
          reservation: existingReservation,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

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

    // Use database transaction with row-level locking to prevent race conditions
    // Check each unit for availability (First Available strategy)
    for (const unit of units) {
      // Use FOR UPDATE SKIP LOCKED to lock the unit row during conflict check
      // This prevents two concurrent allocations from selecting the same unit
      const { data: lockedUnit, error: lockError } = await supabase
        .rpc('check_and_lock_unit_availability', {
          p_unit_id: unit.id,
          p_check_in_date: checkInDate,
          p_check_out_date: checkOutDate,
        });

      if (lockError) {
        console.error('Error locking/checking unit:', unit.unit_number, lockError);
        continue; // Try next unit
      }

      // If unit is available (no conflicts), allocate it
      if (lockedUnit && lockedUnit.length > 0 && lockedUnit[0].is_available) {
        console.log(`Unit ${unit.unit_number} is available and locked - allocating`);

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
        console.log(`Unit ${unit.unit_number} has conflict or is locked - checking next`);
      }
    }

    // No directly available units — attempt auto-shuffle before creating pending assignment
    console.log('No direct availability — attempting auto-shuffle...');

    // Get room type name from the first unit
    const { data: unitDetail } = await supabase
      .from('units')
      .select('booking_com_name')
      .eq('booking_com_id', bookingComRoomId)
      .limit(1)
      .single();

    const roomTypeName = unitDetail?.booking_com_name;

    if (roomTypeName) {
      try {
        const shuffleResponse = await supabase.functions.invoke('auto-shuffle-rooms', {
          body: {
            roomType: roomTypeName,
            checkInDate,
            checkOutDate,
            bookingReference,
            guestNames,
            triggerSource: 'allocate-unit',
          },
        });

        const shuffleResult = shuffleResponse.data;
        console.log('Shuffle result:', shuffleResult);

        if (shuffleResult?.success && shuffleResult.freedUnitId) {
          console.log(`Auto-shuffle freed unit #${shuffleResult.freedUnitNumber} — allocating`);
          return new Response(
            JSON.stringify({
              success: true,
              allocatedUnit: {
                id: shuffleResult.freedUnitId,
                unit_number: shuffleResult.freedUnitNumber,
                name: roomTypeName,
              },
              strategy: 'auto_shuffle',
              moves: shuffleResult.moves,
              shuffleLogId: shuffleResult.shuffleLogId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        console.log('Auto-shuffle could not free a unit:', shuffleResult?.reason);
      } catch (shuffleError) {
        console.error('Auto-shuffle invocation failed:', shuffleError);
      }
    }

    // No available units found - create pending assignment reservation
    console.warn('All units are booked and shuffle failed - creating pending assignment reservation');
    const { data: pendingReservation, error: reservationError } = await supabase
      .from('reservations')
      .insert({
        unit_id: null, // No unit assigned yet
        booking_reference: bookingReference,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guest_names: guestNames,
        number_of_guests: guestNames.length,
        status: 'pending_assignment',
        channel: 'Booking.com',
        source: 'booking.com',
        notes: `CONFLICT: All ${units.length} units with Booking.com Room ID ${bookingComRoomId} are booked. Manual assignment required.`,
        payment_method: 'booking_com',
        settled: 'booking_com',
        currency: 'USD',
      })
      .select()
      .single();

    if (reservationError) {
      console.error('Error creating pending reservation:', reservationError);
      throw reservationError;
    }

    console.log('Created pending assignment reservation:', pendingReservation.id);

    // Push availability = 0 to Booking.com to prevent more bookings (background task)
    console.log('Pushing availability = 0 to Booking.com for room:', bookingComRoomId);
    supabase.functions.invoke('push-availability-booking-com', {
      body: {
        bookingComRoomId,
        dateFrom: checkInDate,
        dateTo: checkOutDate,
        available: 0, // Mark as unavailable
      },
    }).then(({ error: pushError }) => {
      if (pushError) {
        console.error('Failed to push availability to Booking.com:', pushError);
      } else {
        console.log('Successfully pushed availability = 0 to Booking.com');
      }
    }).catch(err => console.error('Error invoking push function:', err));

    // Create notifications for all admin users
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'manager', 'front_desk']);

    if (adminRoles && adminRoles.length > 0) {
      const notifications = adminRoles.map(admin => ({
        user_id: admin.user_id,
        type: 'conflict',
        title: '🚨 Over-Booking Conflict',
        message: `All units for "${units[0]?.name || 'room type'}" are booked. Reservation ${bookingReference} requires manual unit assignment.`,
        metadata: {
          source: 'Booking.com',
          channel: 'Booking.com',
          booking_reference: bookingReference,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          booking_com_room_id: bookingComRoomId,
          units_checked: units.length,
        },
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Error creating notifications:', notifError);
      } else {
        console.log(`Created ${notifications.length} admin notifications`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        requiresManualAssignment: true,
        reservation: {
          id: pendingReservation.id,
          booking_reference: bookingReference,
          status: 'pending_assignment',
        },
        message: 'No units available - reservation created for manual assignment',
        unitsChecked: units.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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
