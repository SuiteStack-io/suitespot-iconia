import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'error' | 'warning' | 'success' | 'info';
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

    // Send email to all admins
    const emailPromises = admins.map(async (admin: any) => {
      try {
        const emailResponse = await resend.emails.send({
          from: "SuiteSpot Notifications <onboarding@resend.dev>",
          to: [admin.email],
          subject: `🚨 ${title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${type === 'error' ? '#ef4444' : '#f59e0b'};">${title}</h2>
              <p style="color: #374151; font-size: 16px;">${message}</p>
              ${metadata ? `
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">Details:</h3>
                  <pre style="margin: 0; font-size: 12px; color: #374151;">${JSON.stringify(metadata, null, 2)}</pre>
                </div>
              ` : ''}
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                Please log in to your admin dashboard to review and resolve this issue.
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
