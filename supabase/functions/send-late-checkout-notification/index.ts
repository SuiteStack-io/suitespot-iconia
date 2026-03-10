
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LateCheckoutNotificationRequest {
  lateCheckoutReservationId: string;
  originalBookingReference: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { lateCheckoutReservationId, originalBookingReference }: LateCheckoutNotificationRequest = await req.json();

    console.log('Sending late checkout notification for reservation:', lateCheckoutReservationId);

    // Fetch the late checkout reservation with unit details
    const { data: lateCheckoutRes, error: resError } = await supabase
      .from('reservations')
      .select('*, units(name, unit_number)')
      .eq('id', lateCheckoutReservationId)
      .single();

    if (resError || !lateCheckoutRes) {
      console.error('Error fetching late checkout reservation:', resError);
      throw new Error('Failed to fetch late checkout reservation');
    }

    // Get all admin users
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

    console.log(`Found ${admins.length} admin users to notify`);

    if (admins.length === 0) {
      console.log('No admin users found, skipping email notification');
      return new Response(
        JSON.stringify({ message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Format date
    const checkoutDateFormatted = new Date(lateCheckoutRes.check_out_date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const guestName = lateCheckoutRes.guest_names?.[0] || 'Unknown Guest';
    const unitName = lateCheckoutRes.units?.name || 'Unknown Room';
    const unitNumber = lateCheckoutRes.units?.unit_number || '';
    const roomInfo = unitNumber ? `${unitName} - Room #${unitNumber}` : unitName;

    // Calculate VAT breakdown
    const totalPrice = lateCheckoutRes.total_price || 0;
    const baseAmount = totalPrice / 1.14;
    const vatAmount = totalPrice - baseAmount;

    // Send email to all admins
    const emailPromises = admins.map(async (admin: any) => {
      try {
        const emailResponse = await resend.emails.send({
          from: "SuiteSpot Notifications <notifications@bookings.suitespoteg.com>",
          to: [admin.email],
          subject: `⏰ Late Checkout Added - ${roomInfo} - ${guestName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Late Checkout Added</h1>
              </div>
              
              <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                  <table style="width: 100%; font-size: 14px; color: #374151;">
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; width: 140px; color: #6b7280;">Guest Name:</td>
                      <td style="padding: 8px 0; font-weight: 600;">${guestName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Room:</td>
                      <td style="padding: 8px 0;">${roomInfo}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Original Booking:</td>
                      <td style="padding: 8px 0; font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; display: inline-block;">${originalBookingReference}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Late Checkout Ref:</td>
                      <td style="padding: 8px 0; font-family: monospace; background: #fef3c7; padding: 4px 8px; border-radius: 4px; display: inline-block; color: #92400e;">${lateCheckoutRes.booking_reference}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding: 12px 0 4px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb;"></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Checkout Date:</td>
                      <td style="padding: 8px 0;">
                        <span style="color: #dc2626; font-weight: 600;">${checkoutDateFormatted}</span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding: 12px 0 4px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb;"></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Late Checkout Fee:</td>
                      <td style="padding: 8px 0;">
                        <span style="font-size: 18px; font-weight: bold; color: #059669;">$${totalPrice.toFixed(2)}</span>
                        <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">(incl. VAT)</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280; font-size: 12px;"></td>
                      <td style="padding: 4px 0; color: #6b7280; font-size: 12px;">
                        Base: $${baseAmount.toFixed(2)} + VAT: $${vatAmount.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Added By:</td>
                      <td style="padding: 8px 0;">
                        <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">${lateCheckoutRes.source || 'Unknown'}</span>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px; text-align: center;">
                  This late checkout fee has been automatically linked to the original booking.
                </p>
              </div>
              
              <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                  <em>This is an automated notification from the SuiteSpot system.</em>
                </p>
              </div>
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

    console.log(`Late checkout notification emails sent: ${successCount}/${admins.length}`);

    return new Response(
      JSON.stringify({
        message: 'Late checkout notifications sent',
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
    console.error('Error in send-late-checkout-notification:', error);
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
