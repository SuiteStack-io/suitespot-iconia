import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

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

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: CancellationRequest = await req.json();
    console.log("Received cancellation data:", JSON.stringify(data, null, 2));

    const {
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch admin users
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);

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

    // Get admin/manager user IDs
    const userIds = userRoles.map((ur) => ur.user_id);

    // Get profiles for names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    // Fetch emails directly from auth.users using admin API
    const adminEmails: { email: string; name: string }[] = [];

    for (const userId of userIds) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (user?.email) {
          const profile = profiles?.find(p => p.id === userId);
          adminEmails.push({
            email: user.email,
            name: profile?.full_name || "Admin",
          });
        }
      } catch (err) {
        console.error(`Failed to fetch user ${userId}:`, err);
      }
    }

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending cancellation notification to ${adminEmails.length} admin(s)`);

    // Format dates
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

    // Get cancellation source
    const cancellationSource = getCancellationSource(channel, source);

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      
      <!-- Header -->
      <div style="background-color: #dc2626; padding: 30px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">🚫</div>
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
          Reservation Cancelled
        </h1>
      </div>

      <!-- Cancellation Source Banner -->
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 24px; margin: 0;">
        <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 500;">
          Cancellation Source
        </p>
        <p style="margin: 4px 0 0 0; color: #dc2626; font-size: 20px; font-weight: 700;">
          ${cancellationSource}
        </p>
      </div>

      <!-- Content -->
      <div style="padding: 30px;">
        
        <!-- Booking Reference -->
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            Booking Reference
          </p>
          <p style="margin: 4px 0 0 0; color: #111827; font-size: 20px; font-weight: 700; font-family: monospace;">
            ${booking_reference}
          </p>
        </div>

        <!-- Guest Info -->
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

        <!-- Accommodation -->
        <div style="margin-bottom: 24px;">
          <h3 style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            Accommodation
          </h3>
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
            <p style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">
              <strong>🏠 Suite:</strong> ${unit_name || "N/A"}
            </p>
            ${unit_number ? `
            <p style="margin: 0; color: #111827; font-size: 16px;">
              <strong>🚪 Unit:</strong> #${unit_number}
            </p>
            ` : ""}
          </div>
        </div>

        <!-- Stay Details -->
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

        <!-- Total -->
        <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0; color: #991b1b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            Lost Revenue
          </p>
          <p style="margin: 4px 0 0 0; color: #dc2626; font-size: 28px; font-weight: 700;">
            ${currency || "USD"} ${total_price?.toFixed(2) || "0.00"}
          </p>
        </div>

        <!-- Footer Note -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
            These dates are now available for new bookings.
          </p>
        </div>

      </div>

      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          SuiteSpot • ICONIA Zamalek
        </p>
      </div>

    </div>
  </div>
</body>
</html>
    `;

    // Send emails to all admins
    const emailPromises = adminEmails.map((admin) =>
      resend.emails.send({
        from: "SuiteSpot Reservations <reservations@bookings.suitespoteg.com>",
        to: [admin.email],
        subject: `Cancelled Booking - ${guest_names?.[0] || "Guest"} (${booking_reference})`,
        html: emailHtml,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

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

serve(handler);
