import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckInNotificationRequest {
  reservationId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reservationId }: CheckInNotificationRequest = await req.json();

    console.log('Sending check-in notification for reservation:', reservationId);

    // Get reservation details
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*, units(name, unit_number)')
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation) {
      console.error('Error fetching reservation:', reservationError);
      throw new Error('Failed to fetch reservation details');
    }

    // Get all admin users with emails
    const { data: adminData, error: adminError } = await supabase
      .rpc('get_all_users_with_emails');

    if (adminError) {
      console.error('Error fetching admins:', adminError);
      throw new Error('Failed to fetch admin users');
    }

    const admins = adminData.filter((user: any) => user.role === 'admin');
    console.log(`Found ${admins.length} admin users`);

    if (admins.length === 0) {
      console.log('No admin users found, skipping email notification');
      return new Response(
        JSON.stringify({ message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const guestName = reservation.guest_names[0] || 'Guest';
    const unitName = reservation.units?.name || 'Unknown Unit';
    const roomNumber = reservation.units?.unit_number || 'N/A';

    // Send email to all admins
    const emailPromises = admins.map(async (admin: any) => {
      try {
        const emailResponse = await resend.emails.send({
          from: "SuiteSpot Reservations <reservations@bookings.suitespoteg.com>",
          to: [admin.email],
          subject: `New Guest Checked In - ${unitName} - Room #${roomNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">Guest Checked In</h2>
              <p style="color: #374151; font-size: 16px;">A guest has successfully checked in.</p>
              
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1f2937;">Reservation Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Guest Name:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${guestName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Room:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${unitName} - Room #${roomNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Booking Reference:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${reservation.booking_reference}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Check-in Date:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.check_in_date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Check-out Date:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.check_out_date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Number of Guests:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.number_of_guests}</td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                This is an automated notification from SuiteSpot Reservations.
              </p>
            </div>
          `,
        });
        console.log(`Email sent to ${admin.email}:`, emailResponse);
        return { success: true, email: admin.email };
      } catch (error) {
        console.error(`Failed to send email to ${admin.email}:`, error);
        return { success: false, email: admin.email, error };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`Check-in notification emails sent: ${successCount}/${admins.length}`);

    return new Response(
      JSON.stringify({
        message: 'Check-in notifications sent',
        sent: successCount,
        total: admins.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-checkin-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
