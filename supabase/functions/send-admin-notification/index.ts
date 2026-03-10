
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, title, message, metadata }: NotificationRequest = await req.json();

    console.log('Sending admin notification:', { type, title });

    // Get all users with emails - query directly (service role bypasses RLS)
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

    // Get auth.users emails using admin API
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw new Error('Failed to fetch auth users');
    }

    // Combine data to get admin users with emails
    const admins = (profiles || [])
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
      .filter((u: any) => u.email && ['admin', 'front_desk'].includes(u.role));

    console.log(`Found ${admins.length} admin users`);

    if (admins.length === 0) {
      console.log('No admin users found, skipping email notification');
      return new Response(
        JSON.stringify({ message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Build email content based on notification type
    const isHousekeepingIssue = type === 'housekeeping_issue';
    const emailColor = type === 'error' || isHousekeepingIssue ? '#ef4444' : '#f59e0b';
    
    let detailsHtml = '';
    if (metadata && isHousekeepingIssue) {
      // Special formatting for housekeeping issues
      detailsHtml = `
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ef4444;">
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr>
              <td style="padding: 4px 0; font-weight: bold; width: 120px;">Room:</td>
              <td>${metadata.room_name || 'Unknown'} (#${metadata.room_number || 'N/A'})</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold;">Guest:</td>
              <td>${metadata.guest_name || 'Unknown'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold;">Issue Type:</td>
              <td style="color: #ef4444; font-weight: bold;">${metadata.issue_type || 'Not specified'}</td>
            </tr>
            ${metadata.notes ? `
            <tr>
              <td style="padding: 4px 0; font-weight: bold;">Details:</td>
              <td>${metadata.notes}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 4px 0; font-weight: bold;">Reported:</td>
              <td>${metadata.reported_at ? new Date(metadata.reported_at).toLocaleString() : 'Just now'}</td>
            </tr>
          </table>
        </div>
      `;
    } else if (metadata) {
      detailsHtml = `
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">Details:</h3>
          <pre style="margin: 0; font-size: 12px; color: #374151;">${JSON.stringify(metadata, null, 2)}</pre>
        </div>
      `;
    }

    // Send email to all admins
    const emailPromises = admins.map(async (admin: any) => {
      try {
        const emailResponse = await resend.emails.send({
          from: "SuiteSpot Notifications <notifications@bookings.suitespoteg.com>",
          to: [admin.email],
          subject: `🚨 ${title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${emailColor};">${title}</h2>
              <p style="color: #374151; font-size: 16px;">${message}</p>
              ${detailsHtml}
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                Please log in to your admin dashboard to review and resolve this issue.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
                <em>This is an automated notification from the SuiteSpot system.</em>
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

    console.log(`Notification emails sent: ${successCount}/${admins.length}`);

    return new Response(
      JSON.stringify({
        message: 'Admin notifications sent',
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
    console.error('Error in send-admin-notification:', error);
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
