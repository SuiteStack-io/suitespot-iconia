import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedReservation {
  guestNames: string[];
  checkInDate: string;
  checkOutDate: string;
  unitName: string;
  bookingReference: string;
  numberOfGuests: number;
  totalPrice: number;
  contactEmail?: string;
  contactPhone?: string;
  guestNationality?: string;
  notes?: string;
}

function parseBookingEmail(emailBody: string, subject: string): ParsedReservation | null {
  try {
    console.log('Parsing email with subject:', subject);
    
    // Decode base64 if needed
    let decodedBody = emailBody;
    try {
      decodedBody = atob(emailBody);
    } catch {
      // Already decoded
    }
    
    // Extract booking reference (various formats)
    const refPatterns = [
      /booking\s*(?:reference|number|#|confirmation)[:\s]*([A-Z0-9-]+)/i,
      /confirmation\s*(?:number|#|code)[:\s]*([A-Z0-9-]+)/i,
      /reservation\s*(?:number|#|code)[:\s]*([A-Z0-9-]+)/i,
    ];
    
    let bookingReference = '';
    for (const pattern of refPatterns) {
      const match = decodedBody.match(pattern) || subject.match(pattern);
      if (match) {
        bookingReference = match[1].trim();
        break;
      }
    }
    
    if (!bookingReference) {
      console.log('No booking reference found');
      return null;
    }
    
    // Extract guest names
    const namePatterns = [
      /guest\s*name[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /booked\s*by[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /name[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    ];
    
    const guestNames: string[] = [];
    for (const pattern of namePatterns) {
      const match = decodedBody.match(pattern);
      if (match) {
        guestNames.push(match[1].trim());
        break;
      }
    }
    
    if (guestNames.length === 0) {
      console.log('No guest names found');
      return null;
    }
    
    // Extract check-in date
    const checkInPatterns = [
      /check[- ]?in[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /arrival[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /from[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ];
    
    let checkInDate = '';
    for (const pattern of checkInPatterns) {
      const match = decodedBody.match(pattern);
      if (match) {
        checkInDate = parseDate(match[1]);
        break;
      }
    }
    
    // Extract check-out date
    const checkOutPatterns = [
      /check[- ]?out[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /departure[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /to[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ];
    
    let checkOutDate = '';
    for (const pattern of checkOutPatterns) {
      const match = decodedBody.match(pattern);
      if (match) {
        checkOutDate = parseDate(match[1]);
        break;
      }
    }
    
    if (!checkInDate || !checkOutDate) {
      console.log('Missing dates:', { checkInDate, checkOutDate });
      return null;
    }
    
    // Extract unit/room name
    const unitPatterns = [
      /(?:room|unit|apartment|property)[:\s]*([A-Z0-9][^\n<]{5,50})/i,
      /accommodation[:\s]*([A-Z0-9][^\n<]{5,50})/i,
    ];
    
    let unitName = 'TBD';
    for (const pattern of unitPatterns) {
      const match = decodedBody.match(pattern);
      if (match) {
        unitName = match[1].trim().replace(/<[^>]*>/g, '').substring(0, 50);
        break;
      }
    }
    
    // Extract number of guests
    const guestPatterns = [
      /(\d+)\s*guest/i,
      /(\d+)\s*adult/i,
      /guests?[:\s]*(\d+)/i,
    ];
    
    let numberOfGuests = 1;
    for (const pattern of guestPatterns) {
      const match = decodedBody.match(pattern);
      if (match) {
        numberOfGuests = parseInt(match[1]);
        break;
      }
    }
    
    // Extract total price
    const pricePatterns = [
      /total[:\s]*(?:USD|EUR|GBP|\$|€|£)\s*([0-9,]+\.?\d*)/i,
      /(?:USD|EUR|GBP|\$|€|£)\s*([0-9,]+\.?\d*)/i,
      /price[:\s]*([0-9,]+\.?\d*)/i,
    ];
    
    let totalPrice = 0;
    for (const pattern of pricePatterns) {
      const match = decodedBody.match(pattern);
      if (match) {
        totalPrice = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }
    
    // Extract email
    const emailMatch = decodedBody.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const contactEmail = emailMatch ? emailMatch[1] : undefined;
    
    // Extract phone
    const phoneMatch = decodedBody.match(/(?:phone|tel|mobile)[:\s]*([\d\s\+\-\(\)]{8,20})/i);
    const contactPhone = phoneMatch ? phoneMatch[1].trim() : undefined;
    
    console.log('Successfully parsed reservation:', bookingReference);
    
    return {
      guestNames,
      checkInDate,
      checkOutDate,
      unitName,
      bookingReference,
      numberOfGuests,
      totalPrice,
      contactEmail,
      contactPhone,
    };
  } catch (error) {
    console.error('Error parsing email:', error);
    return null;
  }
}

function parseDate(dateStr: string): string {
  // Try to parse various date formats and return YYYY-MM-DD
  const parts = dateStr.split(/[\/\-\.]/);
  
  if (parts.length !== 3) return '';
  
  let day, month, year;
  
  // Try DD/MM/YYYY or MM/DD/YYYY
  if (parts[2].length === 4) {
    year = parts[2];
    // Assume DD/MM/YYYY (European format common for Booking.com)
    day = parts[0].padStart(2, '0');
    month = parts[1].padStart(2, '0');
  } else {
    year = '20' + parts[2];
    day = parts[0].padStart(2, '0');
    month = parts[1].padStart(2, '0');
  }
  
  return `${year}-${month}-${day}`;
}

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
      await supabase
        .from('sync_status')
        .update({
          last_sync_at: new Date().toISOString(),
          status: 'idle',
        })
        .eq('sync_type', 'booking_com_gmail');
        
      return new Response(
        JSON.stringify({ message: 'No new Booking.com emails found', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    // Process each message
    for (const message of messages) {
      try {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
          }
        );

        if (!detailResponse.ok) continue;

        const detail = await detailResponse.json();
        
        // Get email body
        let emailBody = '';
        let subject = '';
        
        // Extract subject
        const subjectHeader = detail.payload?.headers?.find((h: any) => h.name === 'Subject');
        if (subjectHeader) {
          subject = subjectHeader.value;
        }
        
        // Extract body (try both text and html parts)
        if (detail.payload?.body?.data) {
          emailBody = detail.payload.body.data;
        } else if (detail.payload?.parts) {
          for (const part of detail.payload.parts) {
            if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
              emailBody = part.body?.data || '';
              if (emailBody) break;
            }
          }
        }
        
        if (!emailBody) {
          console.log('No email body found for message:', message.id);
          continue;
        }
        
        // Parse the email
        const parsed = parseBookingEmail(emailBody, subject);
        
        if (!parsed) {
          console.log('Could not parse email:', message.id);
          continue;
        }
        
        // Check if reservation already exists
        const { data: existingReservation } = await supabase
          .from('reservations')
          .select('id')
          .eq('booking_reference', parsed.bookingReference)
          .single();
          
        if (existingReservation) {
          console.log('Reservation already exists:', parsed.bookingReference);
          skippedCount++;
          continue;
        }
        
        // Find matching unit or use first available
        const { data: units } = await supabase
          .from('units')
          .select('id, name')
          .limit(1);
          
        const unitId = units?.[0]?.id || null;
        
        // Calculate nights
        const checkIn = new Date(parsed.checkInDate);
        const checkOut = new Date(parsed.checkOutDate);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        
        // Create reservation
        const { data: newReservation, error: insertError } = await supabase
          .from('reservations')
          .insert({
            booking_reference: parsed.bookingReference,
            guest_names: parsed.guestNames,
            check_in_date: parsed.checkInDate,
            check_out_date: parsed.checkOutDate,
            number_of_guests: parsed.numberOfGuests,
            adults: parsed.numberOfGuests,
            children: 0,
            total_price: parsed.totalPrice,
            price_per_night: nights > 0 ? parsed.totalPrice / nights : parsed.totalPrice,
            nights: nights,
            unit_id: unitId,
            status: 'confirmed',
            source: 'booking.com',
            channel: 'Booking.com',
            contact_email: parsed.contactEmail,
            contact_phone: parsed.contactPhone,
            guest_nationality: parsed.guestNationality,
            notes: `Auto-synced from Gmail. Unit: ${parsed.unitName}`,
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('Error creating reservation:', insertError);
          continue;
        }
        
        console.log('Created reservation:', newReservation.id);
        createdCount++;
        
        // Send notification email
        try {
          const { data: unit } = await supabase
            .from('units')
            .select('name, unit_type')
            .eq('id', unitId)
            .single();
            
          await supabase.functions.invoke('send-reservation-notification', {
            body: {
              reservationId: newReservation.id,
              guestNames: parsed.guestNames,
              checkIn: parsed.checkInDate,
              checkOut: parsed.checkOutDate,
              unitName: unit?.name || parsed.unitName,
              unitType: unit?.unit_type || '',
              totalPrice: parsed.totalPrice,
              numberOfGuests: parsed.numberOfGuests,
              adults: parsed.numberOfGuests,
              children: 0,
              source: 'Booking.com',
              notes: `Auto-synced from Gmail`,
              guestNationality: parsed.guestNationality || null,
            },
          });
          
          console.log('Notification sent for reservation:', newReservation.id);
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
          // Continue even if notification fails
        }
        
        processedCount++;
      } catch (error) {
        console.error('Error processing message:', error);
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

    console.log(`Sync completed: ${createdCount} created, ${skippedCount} skipped, ${processedCount} total emails processed`);

    return new Response(
      JSON.stringify({ 
        message: 'Sync completed', 
        processedCount,
        createdCount,
        skippedCount 
      }),
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
        last_sync_at: new Date().toISOString(),
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
