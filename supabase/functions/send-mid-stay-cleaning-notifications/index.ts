import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting mid-stay cleaning notification check...');

    // Call the database function to create in-app notifications
    const { error: functionError } = await supabase.rpc('notify_mid_stay_cleaning');
    
    if (functionError) {
      console.error('Error calling notify_mid_stay_cleaning:', functionError);
      throw functionError;
    }

    // Fetch reservations on their 4th day that need cleaning
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select(`
        id,
        guest_names,
        check_in_date,
        check_out_date,
        unit_id,
        units (
          name,
          unit_number
        )
      `)
      .eq('status', 'checked-in')
      .eq('mid_stay_cleaning_completed', false)
      .gte('check_in_date', new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('check_in_date', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (reservationsError) {
      console.error('Error fetching reservations:', reservationsError);
      throw reservationsError;
    }

    // Filter to only reservations that are exactly on their 4th day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const reservationsNeedingCleaning = (reservations || []).filter((r: any) => {
      const checkInDate = new Date(r.check_in_date);
      checkInDate.setHours(0, 0, 0, 0);
      const daysSinceCheckIn = Math.floor((today.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceCheckIn === 3; // 4th day (0-indexed)
    });

    console.log(`Found ${reservationsNeedingCleaning.length} rooms needing mid-stay cleaning`);

    if (reservationsNeedingCleaning.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No rooms need mid-stay cleaning today',
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

    // Get all admin and housekeeping users
    const { data: users, error: usersError } = await supabase
      .rpc('get_all_users_with_emails');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    const targetUsers = (users || []).filter((u: any) => 
      u.role === 'admin' || u.role === 'housekeeping'
    );

    console.log(`Sending emails to ${targetUsers.length} users`);

    // Build email content
    const emailSubject = `Mid-Stay Cleaning Required - ${reservationsNeedingCleaning.length} Room${reservationsNeedingCleaning.length > 1 ? 's' : ''}`;
    
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const emailHtml = `
      <h2>Mid-Stay Cleaning Notification</h2>
      <p>The following room${reservationsNeedingCleaning.length > 1 ? 's need' : ' needs'} mid-stay cleaning today (4th day of stay):</p>
      <ul style="list-style: none; padding-left: 0;">
        ${reservationsNeedingCleaning.map((r: any) => {
          const unit = Array.isArray(r.units) ? r.units[0] : r.units;
          const unitName = unit?.name || 'Unknown Unit';
          const unitNumber = unit?.unit_number || '';
          const guestName = r.guest_names?.[0] || 'Unknown Guest';
          const checkIn = formatDate(r.check_in_date);
          const checkOut = formatDate(r.check_out_date);
          const cleaningCount = cleaningCounts[r.id] || 0;
          return `
            <li style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #4CAF50;">
              <strong style="font-size: 16px;">${unitName}${unitNumber ? ` (${unitNumber})` : ''}</strong> - Guest: ${guestName}
              <br/>
              <span style="color: #666; font-size: 14px;">
                Check-in: ${checkIn} | Check-out: ${checkOut}
                <br/>
                Previous cleanings this stay: ${cleaningCount}
              </span>
            </li>
          `;
        }).join('')}
      </ul>
      <p>Please ensure these rooms receive their mid-stay cleaning service today.</p>
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
          from: 'SuiteSpot <onboarding@resend.dev>',
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

    console.log(`Completed: ${emailsSent} emails sent, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({ 
        message: 'Mid-stay cleaning notifications sent',
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
