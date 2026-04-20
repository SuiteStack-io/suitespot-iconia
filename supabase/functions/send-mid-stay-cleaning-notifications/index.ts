
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getPropertySettings } from "../_shared/property-settings.ts";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting scheduled cleaning notification check...');

    // Call the database function to create in-app notifications
    const { error: functionError } = await supabase.rpc('notify_mid_stay_cleaning');
    
    if (functionError) {
      console.error('Error calling notify_mid_stay_cleaning:', functionError);
      // Don't throw - continue with email notifications even if in-app notifications fail
    }

    // Fetch checked-in reservations that need cleaning today (every 4 days)
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select(`
        id,
        guest_names,
        check_in_date,
        check_out_date,
        unit_id,
        last_cleaning_notification_date,
        units (
          name,
          booking_com_name,
          unit_number
        )
      `)
      .eq('status', 'checked-in');

    if (reservationsError) {
      console.error('Error fetching reservations:', reservationsError);
      throw reservationsError;
    }

    console.log(`Found ${reservations?.length || 0} checked-in reservations`);

    // Filter to reservations that need cleaning today OR have overdue cleanings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const reservationsNeedingCleaning = (reservations || []).filter((r: any) => {
      const checkInDate = new Date(r.check_in_date);
      checkInDate.setHours(0, 0, 0, 0);
      
      // Calculate day of stay (1-indexed: day 1 is check-in day)
      const daysSinceCheckIn = Math.floor((today.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      const dayOfStay = daysSinceCheckIn + 1;
      
      // Calculate cleaning schedule (every 4 days: day 4, 8, 12, 16...)
      const cleaningInterval = 4;
      const totalCleaningsExpected = Math.floor(dayOfStay / cleaningInterval);
      const needsCleaning = totalCleaningsExpected > 0;
      
      // Check if we already sent notification today
      const lastNotificationDate = r.last_cleaning_notification_date ? new Date(r.last_cleaning_notification_date) : null;
      const alreadyNotifiedToday = lastNotificationDate && 
        lastNotificationDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
      
      console.log(`Reservation ${r.id}: Day ${dayOfStay}, cleanings expected: ${totalCleaningsExpected}, already notified today: ${alreadyNotifiedToday}`);
      
      return needsCleaning && !alreadyNotifiedToday;
    }).map((r: any) => {
      const checkInDate = new Date(r.check_in_date);
      checkInDate.setHours(0, 0, 0, 0);
      const daysSinceCheckIn = Math.floor((today.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      const dayOfStay = daysSinceCheckIn + 1;
      const cleaningNumber = Math.floor(dayOfStay / 4);
      const isOverdue = dayOfStay % 4 !== 0; // Not exactly on a cleaning day = overdue
      
      return {
        ...r,
        dayOfStay,
        cleaningNumber,
        isOverdue
      };
    });

    console.log(`Found ${reservationsNeedingCleaning.length} rooms needing scheduled cleaning`);

    if (reservationsNeedingCleaning.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No rooms need scheduled cleaning today',
          emailsSent: 0 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Get previous cleaning counts for each reservation
    const reservationIds = reservationsNeedingCleaning.map((r: any) => r.id);
    const { data: cleaningLogs, error: logsError } = await supabase
      .from('housekeeping_logs')
      .select('reservation_id')
      .in('reservation_id', reservationIds);

    if (logsError) {
      console.error('Error fetching cleaning logs:', logsError);
    }

    // Count cleanings per reservation
    const cleaningCounts = (cleaningLogs || []).reduce((acc: Record<string, number>, log: any) => {
      acc[log.reservation_id] = (acc[log.reservation_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get all users with emails - query directly instead of using RPC (service role bypasses RLS)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw new Error('Failed to fetch profiles');
    }

    console.log(`Found ${profiles?.length || 0} profiles`);

    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      throw new Error('Failed to fetch user roles');
    }

    console.log(`Found ${userRoles?.length || 0} user roles`);

    // We need auth.users emails - use admin API
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw new Error('Failed to fetch auth users');
    }

    console.log(`Found ${authUsers.users?.length || 0} auth users`);

    // Combine data to get admins and housekeeping users with emails
    const targetUsers = (profiles || [])
      .map((profile: any) => {
        const authUser = authUsers.users.find((u: any) => u.id === profile.id);
        const roleRecord = userRoles?.find((r: any) => r.user_id === profile.id);
        return {
          user_id: profile.id,
          email: authUser?.email,
          full_name: profile.full_name,
          role: roleRecord?.role
        };
      })
      .filter((u: any) => u.email && (u.role === 'admin' || u.role === 'manager' || u.role === 'housekeeping'));

    // Resolve per-property settings — this function processes multiple reservations potentially
    // across properties; use the property of the first reservation as the sender, fallback to generic.
    const firstResPropId = (reservationsNeedingCleaning[0] as any)?.property_id || null;
    const settings = await getPropertySettings(supabase, firstResPropId);

    console.log(`Sending emails to ${targetUsers.length} users (admins and housekeeping)`);

    if (targetUsers.length === 0) {
      console.log('No target users found, skipping email notification');
      return new Response(
        JSON.stringify({ message: 'No users to notify', emailsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Build email content
    const emailSubject = `Scheduled Cleaning Required - ${reservationsNeedingCleaning.length} Room${reservationsNeedingCleaning.length > 1 ? 's' : ''}`;
    
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const emailHtml = `
      <h2>Scheduled Cleaning Notification</h2>
      <p>The following room${reservationsNeedingCleaning.length > 1 ? 's need' : ' needs'} scheduled cleaning today (every 4 days of stay):</p>
      <ul style="list-style: none; padding-left: 0;">
        ${reservationsNeedingCleaning.map((r: any) => {
          const unit = Array.isArray(r.units) ? r.units[0] : r.units;
          const unitName = unit?.booking_com_name || unit?.name || 'Unknown Unit';
          const unitNumber = unit?.unit_number || '';
          const guestName = r.guest_names?.[0] || 'Unknown Guest';
          const checkIn = formatDate(r.check_in_date);
          const checkOut = formatDate(r.check_out_date);
          const cleaningCount = cleaningCounts[r.id] || 0;
          const overdueText = r.isOverdue ? ' <span style="color: #dc2626; font-weight: bold;">[OVERDUE]</span>' : '';
          return `
            <li style="margin-bottom: 20px; padding: 15px; background-color: ${r.isOverdue ? '#fef2f2' : '#f9f9f9'}; border-left: 4px solid ${r.isOverdue ? '#dc2626' : '#4CAF50'};">
              <strong style="font-size: 16px;">Room #${unitNumber} - ${unitName}</strong>${overdueText} - Guest: ${guestName}
              <br/>
              <span style="color: #666; font-size: 14px;">
                <strong>Cleaning #${r.cleaningNumber}</strong> (Day ${r.dayOfStay} of stay)
                <br/>
                Check-in: ${checkIn} | Check-out: ${checkOut}
                <br/>
                Previous cleanings completed this stay: ${cleaningCount}
              </span>
            </li>
          `;
        }).join('')}
      </ul>
      <p>Please ensure these rooms receive their scheduled cleaning service today.</p>
      <p><em>This is an automated notification sent by the SuiteSpot system.</em></p>
    `;

    // Send emails to all target users
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const user of targetUsers) {
      if (!user.email) {
        console.log(`Skipping user ${user.user_id} - no email address`);
        continue;
      }

      try {
        const { error: emailError } = await resend.emails.send({
          from: `${settings.from_name} Housekeeping <${settings.from_email_housekeeping}>`,
          to: [user.email],
          subject: emailSubject,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
          emailsFailed++;
        } else {
          console.log(`Email sent successfully to ${user.email}`);
          emailsSent++;
        }
      } catch (error) {
        console.error(`Error sending email to ${user.email}:`, error);
        emailsFailed++;
      }
    }

    // Update last_cleaning_notification_date for all notified reservations
    for (const reservation of reservationsNeedingCleaning) {
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ last_cleaning_notification_date: today.toISOString().split('T')[0] })
        .eq('id', reservation.id);
      
      if (updateError) {
        console.error(`Failed to update last_cleaning_notification_date for reservation ${reservation.id}:`, updateError);
      }
    }

    console.log(`Completed: ${emailsSent} emails sent, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({ 
        message: 'Scheduled cleaning notifications sent',
        roomsNeedingCleaning: reservationsNeedingCleaning.length,
        emailsSent,
        emailsFailed
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-mid-stay-cleaning-notifications:', error);
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
