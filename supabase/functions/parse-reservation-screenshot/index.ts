
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RoomDetail {
  roomName: string;
  price: number;
}

interface ParsedReservation {
  bookingReference: string;
  guestNames: string[];
  checkInDate: string;
  checkOutDate: string;
  roomName: string; // For backward compatibility (first room)
  rooms?: RoomDetail[]; // NEW: Array of rooms for multi-room bookings
  numberOfGuests: number;
  contactEmail?: string;
  contactPhone?: string;
  totalPrice?: number;
  currency?: string;
  adults?: number;
  children?: number;
  notes?: string;
  commissionableAmount?: number;
  commissionAmount?: number;
  nationality?: string;
  preferredLanguage?: string;
  isModification?: boolean; // NEW: true if screenshot shows "Reservation changes"
  changeCount?: number; // NEW: number of changes (e.g., "(4)" from header)
}

interface MatchedRoom {
  roomName: string;
  price: number;
  unitId: string | null;
  matchedUnitName: string | null;
  status: 'available' | 'reserved' | 'blocked' | 'no_match';
  warning?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, propertyId } = await req.json();

    if (!imageBase64) {
      throw new Error('No image provided');
    }

    console.log('[ParseScreenshot] propertyId:', propertyId || 'NOT PROVIDED');

    console.log('Parsing reservation screenshot with AI...');

    // Call Lovable AI to parse the image
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract booking reservation details from this Booking.com screenshot. This may be a MULTI-ROOM booking with 2 or more rooms, or a RESERVATION MODIFICATION showing changes to an existing booking.

Return ONLY a valid JSON object with these exact fields (use null for missing values):
{
  "bookingReference": "string (booking/confirmation number)",
  "guestNames": ["string (guest names, array)"],
  "checkInDate": "YYYY-MM-DD",
  "checkOutDate": "YYYY-MM-DD",
  "rooms": [
    {"roomName": "string (exact room name)", "price": number (price for THIS room only)}
  ],
  "roomName": "string (first room name, for backward compatibility)",
  "numberOfGuests": number (TOTAL number of guests across ALL rooms),
  "contactEmail": "string or null",
  "contactPhone": "string or null",
  "totalPrice": number or null (TOTAL price for ALL rooms combined),
  "currency": "string (USD, EUR, EGP, etc) or null",
  "adults": number or null,
  "children": number or null,
  "notes": "string or null",
  "commissionableAmount": number or null (look for "Commissionable amount" - this is the net revenue for ALL rooms)",
  "commissionAmount": number or null (look for "Commission and charges" - this is the commission amount for ALL rooms)",
  "nationality": "string or null (extract full country name from country code like 'Kw' = 'Kuwait', 'Us' = 'United States', etc)",
  "preferredLanguage": "string or null (ONLY extract if explicitly shown as 'Preferred language' or 'Guest language' field - do NOT infer from nationality)",
  "isModification": boolean (true if you see "Reservation changes" header, "Modified", "Changed", or any modification indicators at the top of the screenshot),
  "changeCount": number or null (if you see "Reservation changes (4)" or similar, extract the number in parentheses)
}

IMPORTANT FOR RESERVATION MODIFICATIONS:
- Look for "Reservation changes" header text at the top of the screenshot
- Look for "(X)" number after "Reservation changes" indicating the number of changes
- If this is a modification, extract the NEW/UPDATED values (dates, prices, guests) shown in the screenshot
- The modification screenshot will show the updated booking details - extract these new values

IMPORTANT FOR MULTI-ROOM BOOKINGS:
- Look for multiple room entries in the screenshot (e.g., "2 rooms", "Room 1:", "Room 2:", or multiple room type listings)
- Each room in the "rooms" array should have its OWN roomName and price
- If you see a price per room (like "$683.10" for one room and "$776.25" for another), extract them separately
- If only a total price is shown for multiple rooms, try to split it evenly OR extract what's available
- The "totalPrice" field should be the sum of ALL room prices

Other important notes:
- Dates must be in YYYY-MM-DD format
- Extract the exact room/property name as shown
- Include all guest names if visible
- For numberOfGuests, count ALL guests (adults + children), not just adults
- For nationality, convert country codes to full country names (e.g., 'Kw' → 'Kuwait', 'Us' → 'United States', 'Eg' → 'Egypt')
- For preferredLanguage, ONLY extract if the screenshot explicitly shows a 'Preferred language' or 'Guest language' field. Do NOT infer or guess a language based on nationality or country. Return null if not explicitly shown.
- Extract numeric values only (remove currency symbols)
- Return ONLY the JSON, no markdown or extra text`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI response:', content);

    // Parse the JSON response
    let parsedData: ParsedReservation;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', content);
      throw new Error('Invalid JSON response from AI');
    }

    // Ensure rooms array exists - if not, create it from single room data
    if (!parsedData.rooms || parsedData.rooms.length === 0) {
      parsedData.rooms = [{
        roomName: parsedData.roomName,
        price: parsedData.totalPrice || 0
      }];
    }

    // Ensure backward compatibility - set roomName to first room if not set
    if (!parsedData.roomName && parsedData.rooms.length > 0) {
      parsedData.roomName = parsedData.rooms[0].roomName;
    }

    console.log(`Detected ${parsedData.rooms.length} room(s) in booking`);

    // Match rooms with units table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let unitsQuery = supabase
      .from('units')
      .select('id, name, booking_com_name, status, unit_type');
    
    if (propertyId) {
      unitsQuery = unitsQuery.eq('property_id', propertyId);
    } else {
      console.log('[ParseScreenshot] No propertyId — skipping unit matching');
    }

    const { data: units, error: unitsError } = await unitsQuery;

    if (unitsError) {
      console.error('Error fetching units:', unitsError);
    }

    const matchedRooms: MatchedRoom[] = [];
    const usedUnitIds: string[] = []; // Track assigned units to avoid duplicates

    // Process each room
    for (const room of parsedData.rooms) {
      const matchedRoom: MatchedRoom = {
        roomName: room.roomName,
        price: room.price,
        unitId: null,
        matchedUnitName: null,
        status: 'no_match'
      };

      if (units && room.roomName) {
        const roomNameLower = room.roomName.toLowerCase();
        
        // Find all matching units (excluding already assigned ones)
        const matchingUnits = units.filter(unit => 
          !usedUnitIds.includes(unit.id) && (
            unit.name.toLowerCase().includes(roomNameLower) ||
            roomNameLower.includes(unit.name.toLowerCase()) ||
            (unit.booking_com_name && 
              (unit.booking_com_name.toLowerCase().includes(roomNameLower) ||
               roomNameLower.includes(unit.booking_com_name.toLowerCase())))
          )
        );
        
        console.log(`Found ${matchingUnits.length} matching units for room: ${room.roomName}`);
        
        // Check each matching unit for blocked dates and conflicts
        for (const unit of matchingUnits) {
          // Check if unit has blocked dates during the reservation period
          const { data: blockedDates, error: blockedError } = await supabase
            .from('blocked_dates')
            .select('id, blocked_date, reason')
            .eq('unit_id', unit.id)
            .gte('blocked_date', parsedData.checkInDate)
            .lt('blocked_date', parsedData.checkOutDate);
          
          if (blockedError) {
            console.error('Error checking blocked dates:', blockedError);
            continue;
          }
          
          // Check for conflicting reservations
          const { data: conflicts, error: conflictError } = await supabase
            .rpc('check_reservation_overlap', {
              p_unit_id: unit.id,
              p_check_in_date: parsedData.checkInDate,
              p_check_out_date: parsedData.checkOutDate
            });
          
          if (conflictError) {
            console.error('Error checking conflicts:', conflictError);
            continue;
          }
          
          const hasBlockedDates = blockedDates && blockedDates.length > 0;
          const hasConflicts = conflicts && conflicts.length > 0;
          
          if (!hasBlockedDates && !hasConflicts && unit.status === 'available') {
            // Found an available unit with no issues
            matchedRoom.unitId = unit.id;
            matchedRoom.matchedUnitName = unit.name;
            matchedRoom.status = 'available';
            usedUnitIds.push(unit.id); // Mark as used
            console.log(`Selected available unit: ${unit.name} (${unit.id}) for room: ${room.roomName}`);
            break;
          } else if (hasBlockedDates) {
            matchedRoom.status = 'blocked';
            matchedRoom.warning = `Unit ${unit.name} has blocked dates during this period`;
          } else if (hasConflicts) {
            matchedRoom.status = 'reserved';
            matchedRoom.warning = `Unit ${unit.name} has conflicting reservations`;
          }
        }
        
        // If no available unit found but matches exist, try auto-shuffle
        if (!matchedRoom.unitId && matchingUnits.length > 0) {
          console.log(`No available unit for room: ${room.roomName}, attempting auto-shuffle...`);
          
          const roomType = matchingUnits[0].booking_com_name || room.roomName;
          
          try {
            const shuffleResponse = await fetch(
              `${supabaseUrl}/functions/v1/auto-shuffle-rooms`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  roomType,
                  checkInDate: parsedData.checkInDate,
                  checkOutDate: parsedData.checkOutDate,
                  bookingReference: parsedData.bookingReference,
                  guestNames: parsedData.guestNames,
                  triggerSource: 'allocate-unit',
                }),
              }
            );
            
            const shuffleData = await shuffleResponse.json();
            console.log('Auto-shuffle response:', JSON.stringify(shuffleData));
            
            if (shuffleData.success && shuffleData.freedUnitId) {
              matchedRoom.unitId = shuffleData.freedUnitId;
              matchedRoom.matchedUnitName = shuffleData.freedUnitNumber || roomType;
              matchedRoom.status = 'available';
              usedUnitIds.push(shuffleData.freedUnitId);
              console.log(`Auto-shuffle freed unit ${shuffleData.freedUnitNumber} (${shuffleData.freedUnitId}) for room: ${room.roomName}`);
            } else {
              console.log(`Auto-shuffle could not free a unit for room: ${room.roomName}, will require manual assignment`);
            }
          } catch (shuffleError) {
            console.error('Auto-shuffle error:', shuffleError);
            console.log(`Auto-shuffle failed for room: ${room.roomName}, will require manual assignment`);
          }
        }
      }

      matchedRooms.push(matchedRoom);
    }

    // Calculate nights
    const checkIn = new Date(parsedData.checkInDate);
    const checkOut = new Date(parsedData.checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // For backward compatibility with single room bookings
    const firstRoom = matchedRooms[0];
    const isMultiRoom = matchedRooms.length > 1;

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...parsedData,
        // Backward compatibility fields (first room)
        unitId: firstRoom?.unitId || null,
        blockedUnitWarning: firstRoom?.warning || null,
        // Multi-room fields
        matchedRooms,
        isMultiRoom,
        nights,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in parse-reservation-screenshot:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
