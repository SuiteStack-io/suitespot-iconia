
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
  checkedOutAt?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reservationId, userId, checkedOutAt: checkedOutAtParam }: CheckOutNotificationRequest = await req.json();

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

    // Get reservation details including checkout timestamp
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*, units!reservations_unit_id_fkey(name, booking_com_name, unit_number, estimated_cleaning_minutes)')
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

    // Get admins and front desk for notification
    const admins = userData.filter((user: any) => ['admin', 'front_desk'].includes(user.role));
    console.log(`Found ${admins.length} admin users`);

    // Get housekeeping staff for cleaning notification
    const housekeepingStaff = userData.filter((user: any) => user.role === 'housekeeping');
    console.log(`Found ${housekeepingStaff.length} housekeeping staff`);

    // Filter admins by notification preferences
    const allStaffIds = [...admins, ...housekeepingStaff].map((u: any) => u.user_id);
    const { data: notifSettings } = await supabase
      .from('user_notification_settings')
      .select('user_id, checkout_email')
      .in('user_id', allStaffIds);

    const filterByPref = (list: any[]) => list.filter((staff: any) => {
      const settings = notifSettings?.find((s: any) => s.user_id === staff.user_id);
      if (settings && !settings.checkout_email) {
        console.log(`Skipped ${staff.email} — checkout notifications disabled`);
        return false;
      }
      return true;
    });

    const filteredAdmins = filterByPref(admins);
    const filteredHousekeeping = filterByPref(housekeepingStaff);
    const allRecipients = [...filteredAdmins, ...filteredHousekeeping];

    if (allRecipients.length === 0) {
      console.log('No staff to notify (all disabled or none found)');
      return new Response(
        JSON.stringify({ message: 'No staff to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const guestName = reservation.guest_names[0] || 'Guest';
    const unitName = reservation.units?.booking_com_name || reservation.units?.name || 'Unknown Unit';
    const roomNumber = reservation.units?.unit_number || 'N/A';
    const estimatedMinutes = reservation.units?.estimated_cleaning_minutes || 45;
    
    // Format check-out timestamp in Cairo time - use passed param first, then DB value
    const checkedOutTimestamp = checkedOutAtParam || reservation.checked_out_at;
    const checkedOutAt = checkedOutTimestamp 
      ? new Date(checkedOutTimestamp).toLocaleString('en-US', {
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

    console.log(`Starting to send check-out notification emails to ${allRecipients.length} recipients (${admins.length} admins, ${housekeepingStaff.length} housekeeping)`);

    for (const staff of allRecipients) {
      try {
        console.log(`Attempting to send check-out email to: ${staff.email}`);
        
        const result = await resend.emails.send({
          from: "SuiteSpot Front Desk <frontdesk@bookings.suitespoteg.com>",
          to: [staff.email!],
          subject: `Guest Checked Out - ${guestName} - Room #${roomNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ea580c;">Guest Checked Out - Room Ready for Cleaning</h2>
              <p style="color: #374151; font-size: 16px;">A guest has checked out and the room is ready for cleaning.</p>
              
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
                  <tr style="background: #fde68a;">
                    <td style="padding: 8px; color: #92400e; font-size: 14px; font-weight: 600;">Checked Out At:</td>
                    <td style="padding: 8px; color: #92400e; font-size: 14px; font-weight: 600;">${checkedOutAt}</td>
                  </tr>
                  <tr style="background: #fde68a;">
                    <td style="padding: 8px; color: #92400e; font-size: 14px; font-weight: 600;">Checked Out By:</td>
                    <td style="padding: 8px; color: #92400e; font-size: 14px; font-weight: 600;">${performedByName}</td>
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
        
        console.log(`Email result for ${staff.email}:`, JSON.stringify(result));
        
        if (result.error) {
          console.error(`Resend error for ${staff.email}:`, JSON.stringify(result.error));
          results.push({ success: false, email: staff.email, error: result.error });
          failedCount++;
        } else {
          console.log(`Email sent successfully to ${staff.email}, ID: ${result.data?.id}`);
          results.push({ success: true, email: staff.email, id: result.data?.id });
          successCount++;
        }
        
        // Add delay between emails (600ms) for rate limiting
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (error: any) {
        console.error(`Exception sending email to ${staff.email}:`, error.message || error);
        results.push({ success: false, email: staff.email, error: error.message });
        failedCount++;
      }
    }

    console.log(`Check-out notification emails completed: ${successCount} sent, ${failedCount} failed out of ${allRecipients.length}`);

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
