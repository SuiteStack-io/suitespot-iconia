import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReservationNotification {
  reservationId: string;
  guestNames: string[];
  checkIn: string;
  checkOut: string;
  unitName: string;
  totalPrice: number;
  numberOfGuests: number;
  source: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      reservationId,
      guestNames,
      checkIn,
      checkOut,
      unitName,
      totalPrice,
      numberOfGuests,
      source,
    }: ReservationNotification = await req.json();

    console.log("Processing reservation notification:", reservationId);

    // Fetch all admin and manager users
    const { data: users, error: usersError } = await supabaseClient.rpc(
      "get_all_users_with_emails"
    );

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    if (!users || users.length === 0) {
      console.log("No users found to notify");
      return new Response(
        JSON.stringify({ message: "No users to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending notifications to ${users.length} users`);

    // Format the dates nicely
    const checkInDate = new Date(checkIn).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const checkOutDate = new Date(checkOut).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Calculate nights
    const nights = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Send emails to all users
    const emailPromises = users.map((user: any) =>
      resend.emails.send({
        from: "SuiteSpot Bookings <onboarding@resend.dev>",
        to: [user.email],
        subject: `New Reservation: ${guestNames.join(", ")} - ${unitName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .header {
                  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 10px 10px 0 0;
                  text-align: center;
                }
                .header h1 {
                  margin: 0;
                  font-size: 24px;
                }
                .content {
                  background: #ffffff;
                  padding: 30px;
                  border: 1px solid #e5e7eb;
                  border-top: none;
                }
                .detail-row {
                  display: flex;
                  padding: 12px 0;
                  border-bottom: 1px solid #f3f4f6;
                }
                .detail-label {
                  font-weight: 600;
                  width: 150px;
                  color: #6b7280;
                }
                .detail-value {
                  flex: 1;
                  color: #111827;
                }
                .highlight {
                  background: #f0fdf4;
                  padding: 20px;
                  border-radius: 8px;
                  margin: 20px 0;
                  border-left: 4px solid #22c55e;
                }
                .footer {
                  text-align: center;
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
                }
                .button {
                  display: inline-block;
                  padding: 12px 24px;
                  background: #0f172a;
                  color: white;
                  text-decoration: none;
                  border-radius: 6px;
                  margin-top: 20px;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>🏨 New Reservation</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">SuiteSpot Bookings</p>
              </div>
              
              <div class="content">
                <h2 style="color: #0f172a; margin-top: 0;">Reservation Details</h2>
                
                <div class="detail-row">
                  <div class="detail-label">Guest(s):</div>
                  <div class="detail-value"><strong>${guestNames.join(", ")}</strong></div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Unit:</div>
                  <div class="detail-value"><strong>${unitName}</strong></div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Check-in:</div>
                  <div class="detail-value">${checkInDate}</div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Check-out:</div>
                  <div class="detail-value">${checkOutDate}</div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Duration:</div>
                  <div class="detail-value">${nights} night${nights > 1 ? "s" : ""}</div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Guests:</div>
                  <div class="detail-value">${numberOfGuests} guest${numberOfGuests > 1 ? "s" : ""}</div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Source:</div>
                  <div class="detail-value">${source}</div>
                </div>
                
                <div class="highlight">
                  <div style="font-size: 14px; color: #6b7280; margin-bottom: 5px;">Total Amount</div>
                  <div style="font-size: 28px; font-weight: bold; color: #0f172a;">$${totalPrice.toFixed(2)}</div>
                </div>
                
                <p style="color: #6b7280; margin-top: 20px;">
                  This is an automated notification. The reservation has been added to your system.
                </p>
              </div>
              
              <div class="footer">
                <p>SuiteSpot Bookings Management System</p>
                <p style="font-size: 12px; margin-top: 10px;">
                  Reservation ID: ${reservationId}
                </p>
              </div>
            </body>
          </html>
        `,
      })
    );

    const results = await Promise.allSettled(emailPromises);

    // Log results
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`Email notifications sent: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      console.error("Some emails failed:", results.filter((r) => r.status === "rejected"));
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-reservation-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
