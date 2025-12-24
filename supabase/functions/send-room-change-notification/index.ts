import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

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
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-room-change-notification function called");

  // Handle CORS preflight requests
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

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get all admin/manager users
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw rolesError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admin/manager users found");
      return new Response(
        JSON.stringify({ success: true, message: "No admins to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = adminRoles.map((r: any) => r.user_id);
    console.log("Admin user IDs found:", userIds);

    // Get profiles for names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    // Get emails from auth.users using service role - listUsers() gets all at once
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    console.log("Total auth users fetched:", authUsers.users.length);
    console.log("User IDs we need emails for:", userIds);

    // Combine the data - match by user ID
    const adminEmails = userIds.map((userId: string) => {
      const profile = profiles?.find((p: any) => p.id === userId);
      const authUser = authUsers.users.find((u: any) => u.id === userId);
      
      console.log(`Processing user ${userId}:`, {
        hasProfile: !!profile,
        hasAuthUser: !!authUser,
        email: authUser?.email,
        full_name: profile?.full_name
      });
      
      return {
        email: authUser?.email,
        name: profile?.full_name || "Admin",
      };
    }).filter((u: any) => {
      const hasEmail = !!u.email;
      if (!hasEmail) {
        console.log(`User filtered out - no email found`);
      }
      return hasEmail;
    });

    console.log("Final admins to notify:", adminEmails.map((u: any) => ({ email: u.email, name: u.name })));

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending room change notification to ${adminEmails.length} admin(s)`);

    // Format dates
    const checkInFormatted = new Date(check_in_date).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const checkOutFormatted = new Date(check_out_date).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    // Determine booking source for display
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

    // Create email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Room Change Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">🔄</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Room Change</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">A reservation has been moved to a different room</p>
            </td>
          </tr>

          <!-- Booking Reference -->
          <tr>
            <td style="padding: 24px 40px 0 40px;">
              <div style="background-color: #fffbeb; border: 1px solid #fbbf24; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0 0 4px 0; color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</p>
                <p style="margin: 0; color: #78350f; font-size: 24px; font-weight: 700; font-family: 'Courier New', monospace;">${booking_reference}</p>
              </div>
            </td>
          </tr>

          <!-- Room Change Details -->
          <tr>
            <td style="padding: 24px 40px;">
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="width: 45%; text-align: center; padding: 12px;">
                      <p style="margin: 0 0 4px 0; color: #92400e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Previous Room</p>
                      <p style="margin: 0; color: #78350f; font-size: 18px; font-weight: 600;">${old_unit_name || "Unknown"}</p>
                      <p style="margin: 4px 0 0 0; color: #92400e; font-size: 24px; font-weight: 700;">#${old_unit_number || "N/A"}</p>
                    </td>
                    <td style="width: 10%; text-align: center; vertical-align: middle;">
                      <div style="font-size: 32px; color: #d97706;">→</div>
                    </td>
                    <td style="width: 45%; text-align: center; padding: 12px;">
                      <p style="margin: 0 0 4px 0; color: #15803d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">New Room</p>
                      <p style="margin: 0; color: #166534; font-size: 18px; font-weight: 600;">${new_unit_name || "Unknown"}</p>
                      <p style="margin: 4px 0 0 0; color: #15803d; font-size: 24px; font-weight: 700;">#${new_unit_number || "N/A"}</p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Guest & Booking Details -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                
                <!-- Guest -->
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="font-size: 20px;">👤</div>
                        </td>
                        <td>
                          <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Guest</p>
                          <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${guest_names?.join(", ") || "Guest"}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Check-in -->
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="font-size: 20px;">📅</div>
                        </td>
                        <td>
                          <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-in</p>
                          <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${checkInFormatted}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Check-out -->
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="font-size: 20px;">📅</div>
                        </td>
                        <td>
                          <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-out</p>
                          <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${checkOutFormatted}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Duration -->
                <tr>
                  <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="font-size: 20px;">🌙</div>
                        </td>
                        <td>
                          <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Duration</p>
                          <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${nights || 0} night${nights !== 1 ? "s" : ""}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Source -->
                <tr>
                  <td style="padding: 16px 0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="font-size: 20px;">🏷️</div>
                        </td>
                        <td>
                          <p style="margin: 0 0 2px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Booking Source</p>
                          <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${bookingSource}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Action Required Notice -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0; color: #c2410c; font-size: 14px; font-weight: 600;">
                  ⚠️ Please notify the guest about their room change
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
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

    // Send emails to all admins sequentially with detailed logging
    let successful = 0;
    let failed = 0;

    for (const admin of adminEmails) {
      try {
        console.log(`Attempting to send room change email to: ${admin.email}`);
        
        const result = await resend.emails.send({
          from: "SuiteSpot Reservations <reservations@bookings.suitespoteg.com>",
          to: [admin.email as string],
          subject: `Room Change - ${guest_names?.[0] || "Guest"} (${booking_reference})`,
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
        
        // Add delay between emails (600ms) for rate limiting
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
        successful,
        failed
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

serve(handler);
