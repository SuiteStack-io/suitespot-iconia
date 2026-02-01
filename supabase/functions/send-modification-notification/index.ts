import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ModificationNotificationRequest {
  booking_reference: string;
  guest_names: string[];
  room_name: string;
  room_number: string;
  old_check_in: string;
  old_check_out: string;
  new_check_in: string;
  new_check_out: string;
  old_total_price: number;
  new_total_price: number;
  currency: string;
  channel?: string;
  source?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-modification-notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ModificationNotificationRequest = await req.json();
    console.log("Received modification data:", JSON.stringify(data, null, 2));

    const {
      booking_reference,
      guest_names,
      room_name,
      room_number,
      old_check_in,
      old_check_out,
      new_check_in,
      new_check_out,
      old_total_price,
      new_total_price,
      currency,
      channel,
      source,
    } = data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get all admin/manager/front_desk users
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager", "front_desk"]);

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

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    const adminEmails = userIds.map((userId: string) => {
      const profile = profiles?.find((p: any) => p.id === userId);
      const authUser = authUsers.users.find((u: any) => u.id === userId);
      return {
        email: authUser?.email,
        name: profile?.full_name || "Admin",
      };
    }).filter((u: any) => !!u.email);

    console.log("Final admins to notify:", adminEmails.map((u: any) => ({ email: u.email, name: u.name })));

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format dates
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    const oldCheckInFormatted = formatDate(old_check_in);
    const oldCheckOutFormatted = formatDate(old_check_out);
    const newCheckInFormatted = formatDate(new_check_in);
    const newCheckOutFormatted = formatDate(new_check_out);

    // Normalize currency code (e.g., "US$" -> "USD", "€" -> "EUR")
    const normalizeCurrency = (curr: string): string => {
      if (!curr) return "USD";
      const currencyMap: Record<string, string> = {
        "US$": "USD",
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
        "AED": "AED",
        "SAR": "SAR",
        "EGP": "EGP",
      };
      // Check if it's already a valid 3-letter code
      if (/^[A-Z]{3}$/.test(curr.toUpperCase())) {
        return curr.toUpperCase();
      }
      return currencyMap[curr] || "USD";
    };

    // Format currency
    const formatCurrency = (amount: number, curr: string) => {
      const normalizedCurrency = normalizeCurrency(curr);
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: normalizedCurrency,
      }).format(amount);
    };

    const oldAmountFormatted = formatCurrency(old_total_price, currency);
    const newAmountFormatted = formatCurrency(new_total_price, currency);

    // Check what changed
    const datesChanged = old_check_in !== new_check_in || old_check_out !== new_check_out;
    const amountChanged = old_total_price !== new_total_price;

    // Determine booking source
    const getBookingSource = (ch?: string, src?: string): string => {
      if (ch) {
        if (ch.toLowerCase().includes("booking")) return "Booking.com";
        if (ch.toLowerCase().includes("airbnb")) return "Airbnb";
        if (ch.toLowerCase().includes("expedia")) return "Expedia";
        return ch;
      }
      if (src) {
        if (src.toLowerCase().includes("booking")) return "Booking.com";
        if (src.toLowerCase().includes("airbnb")) return "Airbnb";
        if (src.toLowerCase().includes("expedia")) return "Expedia";
        return src;
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
  <title>Reservation Modified</title>
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
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Reservation Modified</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">A booking has been modified</p>
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

          <!-- Room Info -->
          <tr>
            <td style="padding: 16px 40px 0 40px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">Room</p>
              <p style="margin: 4px 0 0 0; color: #1e293b; font-size: 18px; font-weight: 600;">${room_name} (#${room_number})</p>
            </td>
          </tr>

          <!-- Changes Section -->
          <tr>
            <td style="padding: 24px 40px;">
              
              <!-- Dates Changed -->
              ${datesChanged ? `
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                <p style="margin: 0 0 12px 0; color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">📅 Dates Changed</p>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0 0 4px 0; color: #92400e; font-size: 11px; text-transform: uppercase;">Before</p>
                      <p style="margin: 0; color: #78350f; font-size: 14px; text-decoration: line-through;">${oldCheckInFormatted} → ${oldCheckOutFormatted}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0 0 4px 0; color: #15803d; font-size: 11px; text-transform: uppercase;">After</p>
                      <p style="margin: 0; color: #166534; font-size: 16px; font-weight: 600;">${newCheckInFormatted} → ${newCheckOutFormatted}</p>
                    </td>
                  </tr>
                </table>
              </div>
              ` : `
              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center;">
                <p style="margin: 0; color: #64748b; font-size: 14px;">📅 Dates: ${newCheckInFormatted} → ${newCheckOutFormatted}</p>
              </div>
              `}

              <!-- Amount Changed -->
              ${amountChanged ? `
              <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px;">
                <p style="margin: 0 0 12px 0; color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">💰 Amount Changed</p>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0 0 4px 0; color: #92400e; font-size: 11px; text-transform: uppercase;">Before</p>
                      <p style="margin: 0; color: #78350f; font-size: 14px; text-decoration: line-through;">${oldAmountFormatted}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0 0 4px 0; color: #15803d; font-size: 11px; text-transform: uppercase;">After</p>
                      <p style="margin: 0; color: #166534; font-size: 20px; font-weight: 700;">${newAmountFormatted}</p>
                    </td>
                  </tr>
                </table>
              </div>
              ` : `
              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0; color: #64748b; font-size: 14px;">💰 Amount: ${newAmountFormatted}</p>
              </div>
              `}

            </td>
          </tr>

          <!-- Guest & Booking Details -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                
                <!-- Guest -->
                <tr>
                  <td style="padding: 12px 0; border-top: 1px solid #e2e8f0;">
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

                <!-- Source -->
                <tr>
                  <td style="padding: 12px 0; border-top: 1px solid #e2e8f0;">
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

    // Send emails to all admins
    let successful = 0;
    let failed = 0;

    for (const admin of adminEmails) {
      try {
        console.log(`Attempting to send modification email to: ${admin.email}`);
        
        const result = await resend.emails.send({
          from: "SuiteSpot Reservations <reservations@bookings.suitespoteg.com>",
          to: [admin.email as string],
          subject: `Reservation Modified - ${guest_names?.[0] || "Guest"} - Room #${room_number}`,
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
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (err: any) {
        console.error(`Exception sending email to ${admin.email}:`, err.message || err);
        failed++;
      }
    }

    console.log(`Modification emails sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Modification notification sent to ${successful} admin(s)`,
        successful,
        failed
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-modification-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
