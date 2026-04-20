
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getPropertyName } from "../_shared/property-utils.ts";
import { getPropertySettings } from "../_shared/property-settings.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtensionNotificationRequest {
  extensionReservationId: string;
  originalBookingReference: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { extensionReservationId, originalBookingReference }: ExtensionNotificationRequest = await req.json();

    console.log('Sending extension notification for reservation:', extensionReservationId);

    // Fetch the extension reservation with unit details
    const { data: extensionRes, error: resError } = await supabase
      .from('reservations')
      .select('*, units!reservations_unit_id_fkey(name, unit_number)')
      .eq('id', extensionReservationId)
      .single();

    if (resError || !extensionRes) {
      console.error('Error fetching extension reservation:', resError);
      throw new Error('Failed to fetch extension reservation');
    }

    const propertyId = extensionRes.property_id;
    console.log('Extension property_id:', propertyId);

    const extPropertyName = await getPropertyName(supabase, propertyId);
    const settings = await getPropertySettings(supabase, propertyId);

    // Calculate nights
    const checkIn = new Date(extensionRes.check_in_date);
    const checkOut = new Date(extensionRes.check_out_date);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Get all admin users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (profilesError) throw new Error('Failed to fetch profiles');

    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) throw new Error('Failed to fetch user roles');

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) throw new Error('Failed to fetch auth users');

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
      .filter((u: any) => u.email && ['admin', 'manager', 'front_desk'].includes(u.role));

    // Filter by property access
    const filteredAdmins = await filterByPropertyAccess(supabase, admins, propertyId);

    console.log(`Found ${admins.length} admin users, ${filteredAdmins.length} after property access filter`);

    if (filteredAdmins.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Format dates
    const checkInFormatted = new Date(extensionRes.check_in_date).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
    const checkOutFormatted = new Date(extensionRes.check_out_date).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });

    const guestName = extensionRes.guest_names?.[0] || 'Unknown Guest';
    const unitName = extensionRes.units?.name || 'Unknown Room';
    const unitNumber = extensionRes.units?.unit_number || '';
    const roomInfo = unitNumber ? `${unitName} - Room #${unitNumber}` : unitName;

    const totalPrice = extensionRes.total_price || 0;
    const baseAmount = totalPrice / 1.14;
    const vatAmount = totalPrice - baseAmount;

    // Send email to all filtered admins
    const emailPromises = filteredAdmins.map(async (admin: any) => {
      try {
        const emailResponse = await resend.emails.send({
          from: `${settings.from_name} <${settings.from_email_notifications}>`,
          to: [admin.email],
          subject: `📅 Stay Extended - ${roomInfo} - ${guestName} at ${extPropertyName}`,
          html: `
            <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;">
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td bgcolor="#1d4ed8" style="background-color:#1d4ed8; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-family: Arial, sans-serif;">Stay Extended</h1>
                  </td>
                </tr>
              </table>
              
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
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Extension Ref:</td>
                      <td style="padding: 8px 0; font-family: monospace; background: #dbeafe; padding: 4px 8px; border-radius: 4px; display: inline-block; color: #1d4ed8;">${extensionRes.booking_reference}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding: 12px 0 4px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb;"></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Extension Dates:</td>
                      <td style="padding: 8px 0;">
                        <span style="color: #059669; font-weight: 600;">${checkInFormatted}</span>
                        <span style="color: #6b7280;"> → </span>
                        <span style="color: #dc2626; font-weight: 600;">${checkOutFormatted}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Additional Nights:</td>
                      <td style="padding: 8px 0; font-weight: 600; color: #3b82f6;">${nights} night${nights > 1 ? 's' : ''}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding: 12px 0 4px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb;"></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Extension Amount:</td>
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
                      <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Source:</td>
                      <td style="padding: 8px 0;">
                        <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">${extensionRes.source || 'Unknown'}</span>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px; text-align: center;">
                  This extension has been automatically linked to the original booking.
                </p>
              </div>
              
              <div style="background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                  <em>This is an automated notification from the SuiteSpot system.</em>
                </p>
              </div>
            </div>
            </body></html>
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

    console.log(`Extension notification emails sent: ${successCount}/${filteredAdmins.length}`);

    return new Response(
      JSON.stringify({
        message: 'Extension notifications sent',
        sent: successCount,
        total: filteredAdmins.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-extension-notification:', error);
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

async function filterByPropertyAccess(
  supabase: any,
  users: any[],
  propertyId: string | null
): Promise<any[]> {
  if (!propertyId) {
    console.log('No property_id — skipping property access filter');
    return users;
  }

  const userIds = users.map((u: any) => u.user_id);
  if (userIds.length === 0) return [];

  const { data: allAccess } = await supabase
    .from('user_property_access')
    .select('user_id, property_id')
    .in('user_id', userIds);

  const accessList = allAccess || [];

  const { data: propData } = await supabase
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .single();
  const propertyName = propData?.name || propertyId;

  return users.filter((user: any) => {
    const userAccessEntries = accessList.filter((a: any) => a.user_id === user.user_id);

    if (userAccessEntries.length === 0 && user.role === 'admin') {
      console.log(`${user.email} — admin with global access (no property restrictions)`);
      return true;
    }

    const hasAccess = userAccessEntries.some((a: any) => a.property_id === propertyId);
    if (!hasAccess) {
      console.log(`Skipped ${user.email} — no access to property "${propertyName}"`);
    }
    return hasAccess;
  });
}
