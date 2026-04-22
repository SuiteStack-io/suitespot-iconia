
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getPropertySettings } from "../_shared/property-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RoomChangeRequest {
  reservation_id: string;
  booking_reference: string;
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  old_unit_name: string;
  old_unit_number: string;
  new_unit_name: string;
  new_unit_number: string;
  nights: number;
  channel?: string;
  source?: string;
  property_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-room-change-notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const roomChangeData: RoomChangeRequest = await req.json();
    console.log("Received room change data:", JSON.stringify(roomChangeData, null, 2));

    const {
      reservation_id,
      booking_reference,
      guest_names,
      check_in_date,
      check_out_date,
      old_unit_name,
      old_unit_number,
      new_unit_name,
      new_unit_number,
      nights,
      channel,
      source,
    } = roomChangeData;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Determine property_id
    let propertyId = roomChangeData.property_id || null;
    if (!propertyId && reservation_id) {
      const { data: resData } = await supabase
        .from('reservations')
        .select('property_id')
        .eq('id', reservation_id)
        .single();
      propertyId = resData?.property_id || null;
    }
    console.log('Room change property_id:', propertyId);

    const settings = await getPropertySettings(supabase, propertyId);

    // Get all admin/manager users
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "manager", "front_desk"]);

    if (rolesError) throw rolesError;

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No admins to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = adminRoles.map((r: any) => r.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) throw authError;

    // Combine data
    const adminEmailsList = adminRoles.map((ur: any) => {
      const profile = profiles?.find((p: any) => p.id === ur.user_id);
      const authUser = authUsers.users.find((u: any) => u.id === ur.user_id);
      return {
        user_id: ur.user_id,
        email: authUser?.email,
        name: profile?.full_name || "Admin",
        role: ur.role,
      };
    }).filter((u: any) => !!u.email);

    // Filter by property access
    const adminEmails = await filterByPropertyAccess(supabase, adminEmailsList, propertyId);

    console.log("Final admins to notify:", adminEmails.map((u: any) => ({ email: u.email, name: u.name })));

    if (adminEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format dates
    const checkInFormatted = new Date(check_in_date).toLocaleDateString("en-US", {
      weekday: "short", year: "numeric", month: "short", day: "numeric",
    });
    const checkOutFormatted = new Date(check_out_date).toLocaleDateString("en-US", {
      weekday: "short", year: "numeric", month: "short", day: "numeric",
    });

    const getBookingSource = (channel?: string, source?: string): string => {
      if (channel) {
        if (channel.toLowerCase().includes("booking")) return "Booking.com";
        if (channel.toLowerCase().includes("airbnb")) return "Airbnb";
        if (channel.toLowerCase().includes("expedia")) return "Expedia";
        return channel;
      }
      if (source) {
        if (source.toLowerCase().includes("booking")) return "Booking.com";
        if (source.toLowerCase().includes("airbnb")) return "Airbnb";
        if (source.toLowerCase().includes("expedia")) return "Expedia";
        return source;
      }
      return "Direct";
    };

    const bookingSource = getBookingSource(channel, source);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Room Change Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <tr>
            <td bgcolor="#d97706" style="background-color: #d97706; padding: 32px 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">🔄</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Room Change</h1>
              <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">A reservation has been moved to a different room</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 40px 0 40px;">
              <div style="background-color: #fffbeb; border: 1px solid #fbbf24; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0 0 4px 0; color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</p>
                <p style="margin: 0; color: #78350f; font-size: 24px; font-weight: 700; font-family: 'Courier New', monospace;">${booking_reference}</p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 40px;">
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="width: 45%; text-align: center; padding: 12px;">
                      <p style="margin: 0 0 4px 0; color: #92400e; font-size: 11px; text-transform: uppercase;">Previous Room</p>
                      <p style="margin: 0; color: #78350f; font-size: 18px; font-weight: 600;">${old_unit_name || "Unknown"}</p>
                      <p style="margin: 4px 0 0 0; color: #92400e; font-size: 24px; font-weight: 700;">#${old_unit_number || "N/A"}</p>
                    </td>
                    <td style="width: 10%; text-align: center; vertical-align: middle;">
                      <div style="font-size: 32px; color: #d97706;">→</div>
                    </td>
                    <td style="width: 45%; text-align: center; padding: 12px;">
                      <p style="margin: 0 0 4px 0; color: #15803d; font-size: 11px; text-transform: uppercase;">New Room</p>
                      <p style="margin: 0; color: #166534; font-size: 18px; font-weight: 600;">${new_unit_name || "Unknown"}</p>
                      <p style="margin: 4px 0 0 0; color: #15803d; font-size: 24px; font-weight: 700;">#${new_unit_number || "N/A"}</p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                  <table role="presentation" style="width: 100%;"><tr>
                    <td style="width: 40px; vertical-align: top;"><div style="font-size: 20px;">👤</div></td>
                    <td>
                      <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Guest</p>
                      <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${guest_names?.join(", ") || "Guest"}</p>
                    </td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                  <table role="presentation" style="width: 100%;"><tr>
                    <td style="width: 40px; vertical-align: top;"><div style="font-size: 20px;">📅</div></td>
                    <td>
                      <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Check-in</p>
                      <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${checkInFormatted}</p>
                    </td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                  <table role="presentation" style="width: 100%;"><tr>
                    <td style="width: 40px; vertical-align: top;"><div style="font-size: 20px;">📅</div></td>
                    <td>
                      <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Check-out</p>
                      <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${checkOutFormatted}</p>
                    </td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                  <table role="presentation" style="width: 100%;"><tr>
                    <td style="width: 40px; vertical-align: top;"><div style="font-size: 20px;">🌙</div></td>
                    <td>
                      <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Duration</p>
                      <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${nights || 0} night${nights !== 1 ? "s" : ""}</p>
                    </td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding: 16px 0;">
                  <table role="presentation" style="width: 100%;"><tr>
                    <td style="width: 40px; vertical-align: top;"><div style="font-size: 20px;">🏷️</div></td>
                    <td>
                      <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Booking Source</p>
                      <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${bookingSource}</p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0; color: #c2410c; font-size: 14px; font-weight: 600;">
                  ⚠️ Please notify the guest about their room change
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">SuiteSpot Reservation System</p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">This is an automated notification</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    let successful = 0;
    let failed = 0;

    for (const admin of adminEmails) {
      try {
        const result = await resend.emails.send({
          from: `${settings.from_name} Reservations <${settings.from_email_reservations}>`,
          to: [admin.email as string],
          subject: `Room Change - ${guest_names?.[0] || "Guest"} (${booking_reference})`,
          html: emailHtml,
        });
        
        if (result.error) {
          console.error(`Resend error for ${admin.email}:`, JSON.stringify(result.error));
          failed++;
        } else {
          console.log(`Email sent successfully to ${admin.email}, ID: ${result.data?.id}`);
          successful++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (err: any) {
        console.error(`Exception sending email to ${admin.email}:`, err.message || err);
        failed++;
      }
    }

    console.log(`Room change emails sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Room change notification sent to ${successful} admin(s)`,
        successful, failed
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-room-change-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

Deno.serve(handler);

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

    if (userAccessEntries.length === 0 && (user.role === 'admin' || user.role === 'super_admin')) {
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
