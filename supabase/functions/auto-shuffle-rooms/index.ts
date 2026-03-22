import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { Resend } from 'https://esm.sh/resend@4.0.0';
import { getPropertyName } from '../_shared/property-utils.ts';

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

    // 9. Send styled admin email notification via Resend
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
      const resend = new Resend(resendApiKey);

      // Determine property_id from the first unit
      let shufflePropertyId: string | null = null;
      if (units.length > 0) {
        const { data: unitProp } = await supabase
          .from('units')
          .select('property_id')
          .eq('id', units[0].id)
          .single();
        shufflePropertyId = unitProp?.property_id || null;
      }
      console.log('Shuffle property_id:', shufflePropertyId);

      const shufflePropertyName = await getPropertyName(supabase, shufflePropertyId);

      // Fetch admin/front_desk emails
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'front_desk']);

      const adminUserIds = (adminRoles || []).map((r: any) => r.user_id);

      if (adminUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', adminUserIds);

        const { data: authUsers } = await supabase.auth.admin.listUsers();

        // Filter by notification preferences
        const { data: notifSettings } = await supabase
          .from('user_notification_settings')
          .select('user_id, room_shuffle_email')
          .in('user_id', adminUserIds);

        // Build user objects with role info for property access filter
        const adminUsersWithInfo = adminUserIds
          .map((uid: string) => {
            const authUser = authUsers?.users?.find((u: any) => u.id === uid);
            const roleRecord = adminRoles?.find((r: any) => r.user_id === uid);
            const settings = notifSettings?.find((s: any) => s.user_id === uid);
            return {
              user_id: uid,
              email: authUser?.email,
              role: roleRecord?.role,
              prefEnabled: !settings || settings.room_shuffle_email !== false,
            };
          })
          .filter((u: any) => u.email && u.prefEnabled);

        // Filter by property access
        const filteredAdminUsers = await filterByPropertyAccess(supabase, adminUsersWithInfo, shufflePropertyId);
        const adminEmails = filteredAdminUsers.map((u: any) => u.email);

        if (adminEmails.length > 0) {
          // Format dates
          const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
          const checkInFmt = fmtDate(checkInDate);
          const checkOutFmt = fmtDate(checkOutDate);
          const nightCount = Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24));

          // Build move cards HTML
          const moveCardsHtml = solution.moves.map((m, i) => {
            const mCheckIn = fmtDate(m.check_in);
            const mCheckOut = fmtDate(m.check_out);
            const mNights = Math.ceil((new Date(m.check_out).getTime() - new Date(m.check_in).getTime()) / (1000 * 60 * 60 * 24));
            return `
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                <p style="margin: 0 0 12px 0; color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Move ${i + 1} of ${solution.moves.length}</p>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="width: 45%; text-align: center; padding: 12px;">
                      <p style="margin: 0 0 4px 0; color: #92400e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Previous Room</p>
                      <p style="margin: 0; color: #78350f; font-size: 18px; font-weight: 600;">Room</p>
                      <p style="margin: 4px 0 0 0; color: #92400e; font-size: 24px; font-weight: 700;">#${m.from_room_number}</p>
                    </td>
                    <td style="width: 10%; text-align: center; vertical-align: middle;">
                      <div style="font-size: 32px; color: #d97706;">→</div>
                    </td>
                    <td style="width: 45%; text-align: center; padding: 12px;">
                      <p style="margin: 0 0 4px 0; color: #15803d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">New Room</p>
                      <p style="margin: 0; color: #166534; font-size: 18px; font-weight: 600;">Room</p>
                      <p style="margin: 4px 0 0 0; color: #15803d; font-size: 24px; font-weight: 700;">#${m.to_room_number}</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                  <tr>
                    <td style="padding: 8px 0; border-top: 1px solid #fbbf24;">
                      <table role="presentation" style="width: 100%;">
                        <tr>
                          <td style="width: 40px;"><div style="font-size: 16px;">👤</div></td>
                          <td><p style="margin: 0; color: #78350f; font-size: 14px; font-weight: 600;">${m.guest_name}</p></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;">
                      <table role="presentation" style="width: 100%;">
                        <tr>
                          <td style="width: 40px;"><div style="font-size: 16px;">📅</div></td>
                          <td><p style="margin: 0; color: #92400e; font-size: 13px;">${mCheckIn} → ${mCheckOut} (${mNights} night${mNights !== 1 ? 's' : ''})</p></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>`;
          }).join('');

          const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Room Shuffle Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td bgcolor="#d97706" style="background-color: #d97706; padding: 32px 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">🔀</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Room Shuffle</h1>
              <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Rooms were automatically rearranged to accommodate a new booking</p>
            </td>
          </tr>

          <!-- Booking Reference -->
          <tr>
            <td style="padding: 24px 40px 0 40px;">
              <div style="background-color: #fffbeb; border: 1px solid #fbbf24; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0 0 4px 0; color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">New Booking Reference</p>
                <p style="margin: 0; color: #78350f; font-size: 24px; font-weight: 700; font-family: 'Courier New', monospace;">${bookingReference}</p>
              </div>
            </td>
          </tr>

          <!-- Triggering Booking Info -->
          <tr>
            <td style="padding: 24px 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%;"><tr>
                      <td style="width: 40px;"><div style="font-size: 20px;">👤</div></td>
                      <td>
                        <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Guest</p>
                        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${guestNames[0] || 'Unknown'}</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%;"><tr>
                      <td style="width: 40px;"><div style="font-size: 20px;">📅</div></td>
                      <td>
                        <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Check-in</p>
                        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${checkInFmt}</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%;"><tr>
                      <td style="width: 40px;"><div style="font-size: 20px;">📅</div></td>
                      <td>
                        <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Check-out</p>
                        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${checkOutFmt}</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%;"><tr>
                      <td style="width: 40px;"><div style="font-size: 20px;">🌙</div></td>
                      <td>
                        <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Duration</p>
                        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${nightCount} night${nightCount !== 1 ? 's' : ''}</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" style="width: 100%;"><tr>
                      <td style="width: 40px;"><div style="font-size: 20px;">🏷️</div></td>
                      <td>
                        <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Room Type</p>
                        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${roomType}</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Moves Section -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px; font-weight: 700;">🔀 ${solution.moves.length} Move${solution.moves.length !== 1 ? 's' : ''} Made</h2>
              ${moveCardsHtml}
            </td>
          </tr>

          <!-- Room Type Notice -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">
                  ✅ All moves were within the same room type (${roomType})
                </p>
              </div>
            </td>
          </tr>

          <!-- Freed Unit -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <div style="background-color: #eff6ff; border: 1px solid #93c5fd; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0 0 4px 0; color: #1e40af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Unit Freed for New Booking</p>
                <p style="margin: 0; color: #1e3a8a; font-size: 24px; font-weight: 700;">#${freedUnitNumber}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">SuiteSpot Reservation System</p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">This is an automated notification</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

          // Send sequentially with 600ms delay
          for (const email of adminEmails) {
            try {
              const result = await resend.emails.send({
                from: 'SuiteSpot Front Desk <frontdesk@bookings.suitespoteg.com>',
                to: [email],
                subject: `Room Shuffle Alert - ${guestNames[0] || 'Guest'} (${bookingReference}) at ${shufflePropertyName}`,
                html: emailHtml,
              });
              console.log(`Shuffle email sent to ${email}:`, JSON.stringify(result));
              await new Promise(resolve => setTimeout(resolve, 600));
            } catch (emailErr) {
              console.error(`Failed to send shuffle email to ${email}:`, emailErr);
            }
          }
        }
      }
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

async function filterByPropertyAccess(
  supabase: any,
  users: any[],
  propertyId: string | null
): Promise<any[]> {
  if (!propertyId) {
    console.log('No property_id — skipping property access filter');
    return users;
  }

  const userIds = users.map((u: any) => u.user_id);
  if (userIds.length === 0) return [];

  const { data: allAccess } = await supabase
    .from('user_property_access')
    .select('user_id, property_id')
    .in('user_id', userIds);

  const accessList = allAccess || [];

  const { data: propData } = await supabase
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .single();
  const propertyName = propData?.name || propertyId;

  return users.filter((user: any) => {
    const userAccessEntries = accessList.filter((a: any) => a.user_id === user.user_id);

    if (userAccessEntries.length === 0 && user.role === 'admin') {
      console.log(`${user.email} — admin with global access (no property restrictions)`);
      return true;
    }

    const hasAccess = userAccessEntries.some((a: any) => a.property_id === propertyId);
    if (!hasAccess) {
      console.log(`Skipped ${user.email} — no access to property "${propertyName}"`);
    }
    return hasAccess;
  });
}
