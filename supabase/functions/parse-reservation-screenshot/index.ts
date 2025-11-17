import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedReservation {
  bookingReference: string;
  guestNames: string[];
  checkInDate: string;
  checkOutDate: string;
  roomName: string;
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      throw new Error('No image provided');
    }

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
                text: `Extract booking reservation details from this Booking.com screenshot. Return ONLY a valid JSON object with these exact fields (use null for missing values):
{
  "bookingReference": "string (booking/confirmation number)",
  "guestNames": ["string (guest names, array)"],
  "checkInDate": "YYYY-MM-DD",
  "checkOutDate": "YYYY-MM-DD",
  "roomName": "string (exact room/property name)",
  "numberOfGuests": number (TOTAL number of guests - make sure to count ALL guests),
  "contactEmail": "string or null",
  "contactPhone": "string or null",
  "totalPrice": number or null,
  "currency": "string (USD, EUR, etc) or null",
  "adults": number or null,
  "children": number or null,
  "notes": "string or null",
  "commissionableAmount": number or null (look for "Commissionable amount" - this is the net revenue),
  "commissionAmount": number or null (look for "Commission and charges" - this is the commission amount),
  "nationality": "string or null (extract full country name from country code like 'Kw' = 'Kuwait', 'Us' = 'United States', etc)",
  "preferredLanguage": "string or null (look for 'Preferred language' or 'Guest language' field)"
}

Important:
- Dates must be in YYYY-MM-DD format
- Extract the exact room/property name as shown
- Include all guest names if visible
- For numberOfGuests, count ALL guests (adults + children), not just adults
- Look for "Commissionable amount" field and extract that as commissionableAmount (this represents net revenue)
- Look for "Commission and charges" field and extract that as commissionAmount
- For nationality, convert country codes to full country names (e.g., 'Kw' → 'Kuwait', 'Us' → 'United States', 'Eg' → 'Egypt')
- Look for "Preferred language" or "Guest language" and extract the language name (e.g., 'Arabic', 'English', 'French')
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
        max_tokens: 1000,
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

    // Match room with units table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, name, booking_com_name');

    if (unitsError) {
      console.error('Error fetching units:', unitsError);
    }

    let matchedUnitId: string | null = null;
    if (units && parsedData.roomName) {
      const roomNameLower = parsedData.roomName.toLowerCase();
      const matchedUnit = units.find(unit => 
        unit.name.toLowerCase().includes(roomNameLower) ||
        roomNameLower.includes(unit.name.toLowerCase()) ||
        (unit.booking_com_name && 
          (unit.booking_com_name.toLowerCase().includes(roomNameLower) ||
           roomNameLower.includes(unit.booking_com_name.toLowerCase())))
      );
      matchedUnitId = matchedUnit?.id || null;
    }

    // Calculate nights
    const checkIn = new Date(parsedData.checkInDate);
    const checkOut = new Date(parsedData.checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...parsedData,
        unitId: matchedUnitId,
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