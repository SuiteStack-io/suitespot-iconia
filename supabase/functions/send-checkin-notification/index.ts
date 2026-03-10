
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

    // Get reservation details including check-in timestamp
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*, units(name, booking_com_name, unit_number)')
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation) {
      console.error('Error fetching reservation:', reservationError);
      throw new Error('Failed to fetch reservation details');
    }

    // Get all users with emails - query directly instead of using RPC (service role bypasses RLS)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw new Error('Failed to fetch profiles');
    }

    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      throw new Error('Failed to fetch user roles');
    }

    // We need auth.users emails - use admin API
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw new Error('Failed to fetch auth users');
    }

    // Combine data to get admins with emails
    const admins = profiles
      .map((profile: any) => {
        const authUser = authUsers.users.find((u: any) => u.id === profile.id);
        const roleRecord = userRoles.find((r: any) => r.user_id === profile.id);
        return {
          user_id: profile.id,
          email: authUser?.email,
          full_name: profile.full_name,
          role: roleRecord?.role
        };
      })
      .filter((u: any) => u.email && ['admin', 'front_desk'].includes(u.role));

    console.log(`Found ${admins.length} admin users`);

    if (admins.length === 0) {
      console.log('No admin users found, skipping email notification');
      return new Response(
        JSON.stringify({ message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const guestName = reservation.guest_names[0] || 'Guest';
    const unitName = reservation.units?.booking_com_name || reservation.units?.name || 'Unknown Unit';
    const roomNumber = reservation.units?.unit_number || 'N/A';
    
    // Format check-in timestamp in Cairo time
    const checkedInAt = reservation.checked_in_at 
      ? new Date(reservation.checked_in_at).toLocaleString('en-US', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : 'Not recorded';

    // Send emails sequentially with rate limiting
    const results: Array<{success: boolean; email: string | undefined; id?: string; error?: any}> = [];
    let successCount = 0;
    let failedCount = 0;

    console.log(`Starting to send check-in notification emails to ${admins.length} admins`);

    for (const admin of admins) {
      try {
        console.log(`Attempting to send check-in email to: ${admin.email}`);
        
        const result = await resend.emails.send({
          from: "SuiteSpot Reservations <reservations@bookings.suitespoteg.com>",
          to: [admin.email!],
          subject: `New Guest Checked In - ${guestName} - Room #${roomNumber}`,
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
                  <tr style="background: #dcfce7;">
                    <td style="padding: 8px; color: #166534; font-size: 14px; font-weight: 600;">Checked In At:</td>
                    <td style="padding: 8px; color: #166534; font-size: 14px; font-weight: 600;">${checkedInAt}</td>
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
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total Nights:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${reservation.nights || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Number of Guests:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.number_of_guests}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Source:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${reservation.channel || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Nationality:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.guest_nationality || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Preferred Language:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.preferred_language || 'N/A'}</td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                This is an automated notification from SuiteSpot Reservations.
              </p>
            </div>
          `,
        });
        
        console.log(`Email result for ${admin.email}:`, JSON.stringify(result));
        
        if (result.error) {
          console.error(`Resend error for ${admin.email}:`, JSON.stringify(result.error));
          results.push({ success: false, email: admin.email, error: result.error });
          failedCount++;
        } else {
          console.log(`Email sent successfully to ${admin.email}, ID: ${result.data?.id}`);
          results.push({ success: true, email: admin.email, id: result.data?.id });
          successCount++;
        }
        
        // Add delay between emails (600ms) for rate limiting
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (error: any) {
        console.error(`Exception sending email to ${admin.email}:`, error.message || error);
        results.push({ success: false, email: admin.email, error: error.message });
        failedCount++;
      }
    }

    console.log(`Check-in notification emails completed: ${successCount} sent, ${failedCount} failed out of ${admins.length}`);

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
