import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

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
  unitType: string;
  totalPrice: number;
  numberOfGuests: number;
  adults: number;
  children: number;
  source: string;
  notes: string | null;
  guestNationality: string | null;
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
      unitType,
      totalPrice,
      numberOfGuests,
      adults,
      children,
      source,
      notes,
      guestNationality,
    }: ReservationNotification = await req.json();

    console.log("Processing reservation notification:", reservationId);

    // Fetch all admin and manager users directly using service role
    const { data: userRoles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "manager"]);

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      throw rolesError;
    }

    if (!userRoles || userRoles.length === 0) {
      console.log("No admin or manager users found");
      return new Response(
        JSON.stringify({ message: "No users to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Fetch profiles and auth emails for these users
    const userIds = userRoles.map((ur: any) => ur.user_id);
    
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Get emails from auth.users using service role
    const { data: authUsers, error: authError } = await supabaseClient.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    console.log("Total auth users fetched:", authUsers.users.length);
    console.log("User IDs we need emails for:", userIds);

    // Combine the data
    const users = userRoles.map((ur: any) => {
      const profile = profiles?.find((p: any) => p.id === ur.user_id);
      const authUser = authUsers.users.find((u: any) => u.id === ur.user_id);
      
      console.log(`Processing user ${ur.user_id}:`, {
        hasProfile: !!profile,
        hasAuthUser: !!authUser,
        email: authUser?.email,
        full_name: profile?.full_name
      });
      
      return {
        user_id: ur.user_id,
        email: authUser?.email,
        full_name: profile?.full_name,
        role: ur.role,
      };
    }).filter((u: any) => {
      const hasEmail = !!u.email;
      if (!hasEmail) {
        console.log(`User ${u.user_id} filtered out - no email found`);
      }
      return hasEmail;
    }); // Only include users with emails

    console.log("Final users to notify:", users.map((u: any) => ({ email: u.email, name: u.full_name })));

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

    // Send emails to all users with rate limiting (max 2 per second for Resend free tier)
    const results = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (!user.email) continue; // Skip if no email (should not happen due to filter above)
      
      console.log(`Attempting to send email to: ${user.email}`);
      
      try {
        const result = await resend.emails.send({
          from: "SuiteSpot Bookings <reservations@bookings.suitespoteg.com>",
          to: [user.email],
          subject: `New Reservation: ${guestNames.join(", ")} - ${unitName.split(' ')[0]} ${unitName.split(' ')[1] || ''}`,
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
                <h1 style="margin-bottom: 15px;">New Reservation in Iconia Zamalek</h1>
                <img src="https://phvduifvymozqiqwvajj.supabase.co/storage/v1/object/public/assets/suitespot-logo.png" alt="SuiteSpot Logo" style="max-width: 150px; height: auto;" />
              </div>
              
              <div class="content">
                <h2 style="color: #0f172a; margin-top: 0;">Reservation Details</h2>
                
                <div class="detail-row">
                  <div class="detail-label">Guest(s):</div>
                  <div class="detail-value"><strong>${guestNames.join(", ")}</strong></div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Unit:</div>
                  <div class="detail-value"><strong>${unitName.split(' ')[0]} ${unitName.split(' ')[1] || ''}</strong> ${unitType || ''}</div>
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
                
                ${guestNationality ? `
                <div class="detail-row">
                  <div class="detail-label">Nationality:</div>
                  <div class="detail-value">${guestNationality}</div>
                </div>
                ` : ''}
                
                <div class="detail-row">
                  <div class="detail-label">Adults:</div>
                  <div class="detail-value">${adults || 0}</div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Children:</div>
                  <div class="detail-value">${children || 0}</div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Source:</div>
                  <div class="detail-value">${source}</div>
                </div>
                
                ${notes ? `
                <div class="detail-row">
                  <div class="detail-label">Notes:</div>
                  <div class="detail-value">${notes}</div>
                </div>
                ` : ''}
                
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
        });
        console.log(`Email sent successfully to ${user.email}:`, result);
        results.push({ status: 'fulfilled', value: result });
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
        results.push({ status: 'rejected', reason: error });
      }
      
      // Add delay between emails to respect rate limit (2 emails/second = 500ms delay)
      if (i < users.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

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
