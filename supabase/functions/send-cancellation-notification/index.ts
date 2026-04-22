
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getPropertyName } from "../_shared/property-utils.ts";
import { getPropertySettings } from "../_shared/property-settings.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancellationRequest {
  reservation_id: string;
  booking_reference: string;
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  nights: number;
  total_price: number;
  currency: string;
  channel: string;
  source: string;
  unit_name?: string;
  unit_number?: string;
  property_id?: string;
}

const getCancellationSource = (channel: string, source: string): string => {
  const channelLower = (channel || '').toLowerCase();
  const sourceLower = (source || '').toLowerCase();
  
  if (channelLower.includes('booking') || sourceLower.includes('booking')) {
    return 'Booking.com';
  }
  if (sourceLower.includes('direct')) {
    return 'Direct Website';
  }
  if (sourceLower.includes('airbnb') || channelLower.includes('airbnb')) {
    return 'Airbnb';
  }
  return source || channel || 'Manual';
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-cancellation-notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: CancellationRequest = await req.json();
    console.log("Received cancellation data:", JSON.stringify(data, null, 2));

    const {
      reservation_id,
      booking_reference,
      guest_names,
      check_in_date,
      check_out_date,
      nights,
      total_price,
      currency,
      channel,
      source,
      unit_name,
      unit_number,
    } = data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine property_id - from payload or look it up from reservation
    let propertyId = data.property_id || null;
    if (!propertyId && reservation_id) {
      const { data: resData } = await supabase
        .from('reservations')
        .select('property_id')
        .eq('id', reservation_id)
        .single();
      propertyId = resData?.property_id || null;
    }
    console.log('Cancellation property_id:', propertyId);

    // Dynamic property name lookup + settings
    const cancellationPropertyName = await getPropertyName(supabase, propertyId);
    const settings = await getPropertySettings(supabase, propertyId);

    // Fetch admin users
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "manager", "front_desk"]);

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      throw new Error("Failed to fetch admin users");
    }

    if (!userRoles || userRoles.length === 0) {
      console.log("No admin/manager users found");
      return new Response(
        JSON.stringify({ success: true, message: "No admin users to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = userRoles.map((ur: any) => ur.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    // Combine data
    const adminEmails = userRoles.map((ur: any) => {
      const profile = profiles?.find((p: any) => p.id === ur.user_id);
      const authUser = authUsers.users.find((u: any) => u.id === ur.user_id);
      return {
        user_id: ur.user_id,
        email: authUser?.email,
        name: profile?.full_name || "Admin",
        role: ur.role,
      };
    }).filter((u: any) => !!u.email);

    // Filter by notification preferences
    const { data: notifSettings } = await supabase
      .from('user_notification_settings')
      .select('user_id, cancelled_booking_email')
      .in('user_id', adminEmails.map((a: any) => a.user_id));

    const prefFiltered = adminEmails.filter((admin: any) => {
      const settings = notifSettings?.find((s: any) => s.user_id === admin.user_id);
      if (settings && !settings.cancelled_booking_email) {
        console.log(`Skipped ${admin.email} — cancellation notifications disabled`);
        return false;
      }
      return true;
    });

    // Filter by property access
    const filteredAdminEmails = await filterByPropertyAccess(supabase, prefFiltered, propertyId);

    console.log("Final admins to notify:", filteredAdminEmails.map((u: any) => ({ email: u.email, name: u.name })));

    if (filteredAdminEmails.length === 0) {
      console.log("No admin emails found after filtering");
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending cancellation notification to ${filteredAdminEmails.length} admin(s)`);

    // Format dates
    const checkInShort = new Date(check_in_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const checkOutShort = new Date(check_out_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const checkInFormatted = new Date(check_in_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const checkOutFormatted = new Date(check_out_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const cancellationSource = getCancellationSource(channel, source);

    // Build email HTML (same as before)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td bgcolor="#dc2626" style="background-color: #dc2626; padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🚫</div>
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              Reservation Cancelled
            </h1>
          </td>
        </tr>
      </table>

      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 24px; margin: 0;">
        <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 500;">
          Cancellation Source
        </p>
        <p style="margin: 4px 0 0 0; color: #dc2626; font-size: 20px; font-weight: 700;">
          ${cancellationSource}
        </p>
      </div>

      <div style="padding: 30px;">
        
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            Booking Reference
          </p>
          <p style="margin: 4px 0 0 0; color: #111827; font-size: 20px; font-weight: 700; font-family: monospace;">
            ${booking_reference}
          </p>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            Guest Details
          </h3>
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
            <p style="margin: 0; color: #111827; font-size: 16px;">
              <strong>👤 Guest:</strong> ${guest_names?.join(", ") || "N/A"}
            </p>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            Accommodation
          </h3>
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
            <p style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">
              <strong>🏠 Room:</strong> ${unit_name || "N/A"}
            </p>
            ${unit_number ? `
            <p style="margin: 0; color: #111827; font-size: 16px;">
              <strong>🚪 Room #:</strong> ${unit_number}
            </p>
            ` : ""}
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            Stay Details
          </h3>
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
            <p style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">
              <strong>📅 Check-in:</strong> ${checkInFormatted}
            </p>
            <p style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">
              <strong>📅 Check-out:</strong> ${checkOutFormatted}
            </p>
            <p style="margin: 0; color: #111827; font-size: 16px;">
              <strong>🌙 Duration:</strong> ${nights} night(s)
            </p>
          </div>
        </div>

        <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0; color: #991b1b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            Lost Revenue
          </p>
          <p style="margin: 4px 0 0 0; color: #dc2626; font-size: 28px; font-weight: 700;">
            ${currency || "USD"} ${total_price?.toFixed(2) || "0.00"}
          </p>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
            These dates are now available for new bookings.
          </p>
        </div>

      </div>

      <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          SuiteSpot • ${cancellationPropertyName}
        </p>
      </div>

    </div>
  </div>
</body>
</html>
    `;

    // Send emails to all admins sequentially
    let successful = 0;
    let failed = 0;

    for (const admin of filteredAdminEmails) {
      try {
        console.log(`Attempting to send cancellation email to: ${admin.email}`);
        
        const result = await resend.emails.send({
          from: `${settings.from_name} Reservations <${settings.from_email_reservations}>`,
          to: [admin.email as string],
          subject: `Cancelled Booking - ${guest_names?.[0] || "Guest"} - ${checkInShort} to ${checkOutShort}${unit_number ? ` - Room #${unit_number}` : ''} at ${cancellationPropertyName}`,
          html: emailHtml,
        });
        
        console.log(`Email result for ${admin.email}:`, JSON.stringify(result));
        
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

    console.log(`Emails sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cancellation notification sent to ${successful} admin(s)`,
        sent: successful,
        failed: failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-cancellation-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
