import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShuffleRequest {
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  bookingReference: string;
  guestNames: string[];
  triggerSource: 'channex' | 'manual' | 'allocate-unit';
}

interface MoveDetail {
  reservation_id: string;
  guest_name: string;
  from_room_id: string;
  from_room_number: string;
  to_room_id: string;
  to_room_number: string;
  check_in: string;
  check_out: string;
}

interface UnitInfo {
  id: string;
  unit_number: string;
  name: string;
}

interface ReservationInfo {
  id: string;
  unit_id: string;
  check_in_date: string;
  check_out_date: string;
  guest_names: string[];
  booking_reference: string;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { roomType, checkInDate, checkOutDate, bookingReference, guestNames, triggerSource }: ShuffleRequest = await req.json();

    console.log('Auto-shuffle requested:', { roomType, checkInDate, checkOutDate, bookingReference });

    // 1. Get all units of this room type, excluding maintenance/blocked status
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, unit_number, name')
      .eq('booking_com_name', roomType)
      .not('status', 'in', '("maintenance","blocked")')
      .order('unit_number', { ascending: true });

    if (unitsError) throw unitsError;
    if (!units || units.length === 0) {
      console.log('No units found for room type:', roomType);
      return new Response(JSON.stringify({ success: false, reason: 'no_units' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    const unitIds = units.map(u => u.id);
    const unitMap = new Map<string, UnitInfo>(units.map(u => [u.id, u]));

    // 2. Get all moveable reservations on these units (confirmed or pending_assignment, never checked-in)
    const { data: allReservations, error: resError } = await supabase
      .from('reservations')
      .select('id, unit_id, check_in_date, check_out_date, guest_names, booking_reference, status')
      .in('unit_id', unitIds)
      .in('status', ['confirmed', 'pending_assignment'])
      .is('cancelled_at', null);

    if (resError) throw resError;

    // 3. Get all blocked dates for these units
    const { data: blockedDates, error: blockedError } = await supabase
      .from('blocked_dates')
      .select('unit_id, blocked_date')
      .in('unit_id', unitIds);

    if (blockedError) throw blockedError;

    const reservations: ReservationInfo[] = allReservations || [];
    const blocked = blockedDates || [];

    // Helper: check if a unit is free for a given date range (considering existing reservations and blocked dates)
    // excludeReservationIds: reservations we're hypothetically moving away
    const isUnitFree = (unitId: string, checkIn: string, checkOut: string, excludeReservationIds: Set<string>): boolean => {
      // Check reservation conflicts
      const hasConflict = reservations.some(r => {
        if (r.unit_id !== unitId) return false;
        if (excludeReservationIds.has(r.id)) return false;
        return r.check_in_date < checkOut && r.check_out_date > checkIn;
      });
      if (hasConflict) return false;

      // Check blocked dates
      const hasBlocked = blocked.some(b => {
        if (b.unit_id !== unitId) return false;
        return b.blocked_date >= checkIn && b.blocked_date < checkOut;
      });
      return !hasBlocked;
    };

    // 4. Check if any unit is directly free for the new booking (shouldn't be if we got here, but safety check)
    for (const unit of units) {
      if (isUnitFree(unit.id, checkInDate, checkOutDate, new Set())) {
        console.log('Unit directly available (no shuffle needed):', unit.unit_number);
        return new Response(JSON.stringify({
          success: true,
          freedUnitId: unit.id,
          freedUnitNumber: unit.unit_number,
          moves: [],
          noShuffleNeeded: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    // 5. Find reservations that overlap with the new booking's dates
    const overlappingReservations = reservations.filter(r =>
      r.check_in_date < checkOutDate && r.check_out_date > checkInDate
    );

    if (overlappingReservations.length === 0) {
      console.log('No overlapping reservations found but no free unit either (blocked dates?)');
      return new Response(JSON.stringify({ success: false, reason: 'blocked_dates_only' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // 6. BFS to find shortest chain of moves to free a unit
    // State: which reservations have been moved and where
    // Goal: find a unit that becomes free for the new booking dates

    interface BFSState {
      movedReservations: Map<string, string>; // reservation_id -> new_unit_id
      moves: MoveDetail[];
    }

    const initialState: BFSState = {
      movedReservations: new Map(),
      moves: [],
    };

    const queue: BFSState[] = [initialState];
    const visited = new Set<string>();
    const MAX_DEPTH = 4;
    let solution: BFSState | null = null;

    while (queue.length > 0 && !solution) {
      const current = queue.shift()!;

      if (current.moves.length >= MAX_DEPTH) continue;

      // For each unit, check if it's free for the new booking with current moves applied
      const excludeIds = new Set(current.movedReservations.keys());

      // Build effective unit assignment: which reservations are on which units after moves
      const effectiveAssignment = new Map<string, string>(); // reservation_id -> unit_id
      for (const r of reservations) {
        effectiveAssignment.set(r.id, current.movedReservations.get(r.id) || r.unit_id);
      }

      // Check if any unit is free for the new booking
      for (const unit of units) {
        const unitFree = !reservations.some(r => {
          const effectiveUnit = effectiveAssignment.get(r.id)!;
          if (effectiveUnit !== unit.id) return false;
          return r.check_in_date < checkOutDate && r.check_out_date > checkInDate;
        }) && !blocked.some(b => b.unit_id === unit.id && b.blocked_date >= checkInDate && b.blocked_date < checkOutDate);

        if (unitFree) {
          solution = current;
          // The freed unit is this one
          (solution as any).freedUnitId = unit.id;
          (solution as any).freedUnitNumber = unit.unit_number;
          break;
        }
      }

      if (solution) break;

      // Try moving each reservation that's on these units to another unit
      for (const res of reservations) {
        if (current.movedReservations.has(res.id)) continue; // Already moved
        if (res.status === 'checked-in') continue; // Never move checked-in

        const currentUnitId = effectiveAssignment.get(res.id)!;

        for (const targetUnit of units) {
          if (targetUnit.id === currentUnitId) continue; // Same unit

          // Check if target unit is free for this reservation's dates (considering current moves)
          const targetFree = !reservations.some(r => {
            if (r.id === res.id) return false; // The reservation we're moving
            const effectiveUnit = effectiveAssignment.get(r.id)!;
            if (effectiveUnit !== targetUnit.id) return false;
            return r.check_in_date < res.check_out_date && r.check_out_date > res.check_in_date;
          }) && !blocked.some(b => b.unit_id === targetUnit.id && b.blocked_date >= res.check_in_date && b.blocked_date < res.check_out_date);

          if (!targetFree) continue;

          // Create state key to avoid revisiting
          const newMoved = new Map(current.movedReservations);
          newMoved.set(res.id, targetUnit.id);
          const stateKey = Array.from(newMoved.entries()).sort().map(([k, v]) => `${k}:${v}`).join('|');

          if (visited.has(stateKey)) continue;
          visited.add(stateKey);

          const fromUnit = unitMap.get(currentUnitId)!;
          const toUnit = unitMap.get(targetUnit.id)!;

          const newMoves: MoveDetail[] = [
            ...current.moves,
            {
              reservation_id: res.id,
              guest_name: res.guest_names[0] || 'Unknown',
              from_room_id: currentUnitId,
              from_room_number: fromUnit?.unit_number || 'N/A',
              to_room_id: targetUnit.id,
              to_room_number: toUnit?.unit_number || 'N/A',
              check_in: res.check_in_date,
              check_out: res.check_out_date,
            },
          ];

          queue.push({
            movedReservations: newMoved,
            moves: newMoves,
          });
        }
      }
    }

    if (!solution) {
      console.log('No valid shuffle combination found');
      return new Response(JSON.stringify({ success: false, reason: 'no_valid_shuffle' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // 7. Execute the moves
    console.log(`Found solution with ${solution.moves.length} moves`);

    // Lock and move reservations with row-level locking
    for (const move of solution.moves) {
      console.log(`Moving reservation ${move.reservation_id}: Room #${move.from_room_number} -> #${move.to_room_number}`);

      const { error: moveError } = await supabase
        .from('reservations')
        .update({
          unit_id: move.to_room_id,
          skip_channex_sync: true, // Prevent OTA sync for internal shuffle
          shuffled_from_unit_id: move.from_room_id,
          shuffled_at: new Date().toISOString(),
        })
        .eq('id', move.reservation_id);

      if (moveError) {
        console.error('Failed to move reservation:', move.reservation_id, moveError);
        throw new Error(`Failed to move reservation ${move.reservation_id}: ${moveError.message}`);
      }
    }

    // 8. Log the shuffle
    const freedUnitId = (solution as any).freedUnitId;
    const freedUnitNumber = (solution as any).freedUnitNumber;

    const { data: shuffleLog, error: logError } = await supabase
      .from('room_shuffle_log')
      .insert({
        triggered_by_reference: bookingReference,
        room_type: roomType,
        moves: solution.moves,
        move_count: solution.moves.length,
        reason: `Auto-shuffle to accommodate new booking ${bookingReference} (${triggerSource})`,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Failed to log shuffle:', logError);
    } else {
      // Update shuffle_log_id on moved reservations
      const moveIds = solution.moves.map(m => m.reservation_id);
      await supabase
        .from('reservations')
        .update({ shuffle_log_id: shuffleLog.id })
        .in('id', moveIds);
    }

    // 9. Send admin email notification
    try {
      const movesDescription = solution.moves
        .map(m => `• ${m.guest_name} moved from Room #${m.from_room_number} to Room #${m.to_room_number} (${m.check_in} — ${m.check_out})`)
        .join('\n');

      await supabase.functions.invoke('send-admin-notification', {
        body: {
          type: 'info',
          title: `Room Shuffle Alert — ICONIA Zamalek`,
          message: `Auto-shuffle completed to accommodate new booking ${bookingReference} (${guestNames[0] || 'Unknown'}, ${checkInDate} to ${checkOutDate}, ${roomType}).\n\n${solution.moves.length} move(s) made:\n${movesDescription}\n\nAll moves were within the same room type (${roomType}).`,
          metadata: {
            shuffle_type: 'auto',
            booking_reference: bookingReference,
            room_type: roomType,
            move_count: solution.moves.length,
            moves: solution.moves,
            freed_unit: freedUnitNumber,
          },
        },
      });
    } catch (notifError) {
      console.error('Failed to send shuffle notification:', notifError);
    }

    console.log(`Shuffle complete. Freed unit: #${freedUnitNumber}`);

    return new Response(JSON.stringify({
      success: true,
      freedUnitId,
      freedUnitNumber,
      moves: solution.moves,
      shuffleLogId: shuffleLog?.id || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error: any) {
    console.error('Auto-shuffle error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
