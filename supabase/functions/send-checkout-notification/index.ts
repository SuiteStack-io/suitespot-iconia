import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckOutNotificationRequest {
  reservationId: string;
  userId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reservationId, userId }: CheckOutNotificationRequest = await req.json();

    console.log('Sending check-out notification for reservation:', reservationId);

    // Get user who performed the check-out (if provided)
    let performedByName = 'Staff member';
    if (userId) {
      const { data: userData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      if (userData?.full_name) {
        performedByName = userData.full_name;
      }
    }

    // Get reservation details
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*, units(name, unit_number, estimated_cleaning_minutes)')
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

    // Combine data
    const userData = profiles.map((profile: any) => {
      const authUser = authUsers.users.find((u: any) => u.id === profile.id);
      const roleRecord = userRoles.find((r: any) => r.user_id === profile.id);
      return {
        user_id: profile.id,
        email: authUser?.email,
        full_name: profile.full_name,
        role: roleRecord?.role
      };
    }).filter((u: any) => u.email); // Only users with emails

    // Get admins for notification
    const admins = userData.filter((user: any) => user.role === 'admin');
    console.log(`Found ${admins.length} admin users`);

    // Get housekeeping staff for cleaning notification
    const housekeepingStaff = userData.filter((user: any) => user.role === 'housekeeping');
    console.log(`Found ${housekeepingStaff.length} housekeeping staff`);

    // Combine both groups for notification
    const allRecipients = [...admins, ...housekeepingStaff];

    if (allRecipients.length === 0) {
      console.log('No staff found, skipping email notification');
      return new Response(
        JSON.stringify({ message: 'No staff to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const guestName = reservation.guest_names[0] || 'Guest';
    const unitName = reservation.units?.name || 'Unknown Unit';
    const roomNumber = reservation.units?.unit_number || 'N/A';
    const estimatedMinutes = reservation.units?.estimated_cleaning_minutes || 45;

    // Send email to all recipients
    const emailPromises = allRecipients.map(async (staff: any) => {
      try {
        const emailResponse = await resend.emails.send({
          from: "SuiteSpot Housekeeping <housekeeping@bookings.suitespoteg.com>",
          to: [staff.email],
          subject: `Guest Checked Out - ${unitName} - Room #${roomNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ea580c;">Guest Checked Out - Room Ready for Cleaning</h2>
              <p style="color: #374151; font-size: 16px;">A guest has checked out and the room is ready for cleaning.</p>
              <p style="color: #6b7280; font-size: 14px; font-style: italic;">Checked out by: ${performedByName}</p>
              
              <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #92400e;">Room Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #78350f; font-size: 14px;">Room:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${unitName} - Room #${roomNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #78350f; font-size: 14px;">Previous Guest:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${guestName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #78350f; font-size: 14px;">Check-out Date:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.check_out_date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #78350f; font-size: 14px;">Estimated Cleaning Time:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${estimatedMinutes} minutes</td>
                  </tr>
                </table>
              </div>
              
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1f2937;">Previous Stay Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Booking Reference:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.booking_reference}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Number of Guests:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.number_of_guests}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Check-in Date:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.check_in_date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Nights Stayed:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${reservation.nights || 'N/A'}</td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                Please proceed with cleaning this room at your earliest convenience. Log in to the housekeeping dashboard to mark the room as cleaned once completed.
              </p>
              
              <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
                This is an automated notification from SuiteSpot Reservations.
              </p>
            </div>
          `,
        });
        console.log(`Email sent to ${staff.email}:`, emailResponse);
        return { success: true, email: staff.email };
      } catch (error) {
        console.error(`Failed to send email to ${staff.email}:`, error);
        return { success: false, email: staff.email, error };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`Check-out notification emails sent: ${successCount}/${allRecipients.length}`);

    return new Response(
      JSON.stringify({
        message: 'Check-out notifications sent to admins and housekeeping',
        sent: successCount,
        total: allRecipients.length,
        admins: admins.length,
        housekeeping: housekeepingStaff.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-checkout-notification:', error);
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
