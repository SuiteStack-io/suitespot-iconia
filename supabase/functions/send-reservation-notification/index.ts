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
  unitId?: string;
  unitType: string;
  totalPrice: number;
  subtotal?: number;
  taxAmount?: number;
  taxPercentage?: number;
  numberOfGuests: number;
  adults: number;
  children: number;
  source: string;
  notes: string | null;
  guestNationality: string | null;
  customerEmail?: string;
  customerPhone?: string;
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
      unitId,
      unitType,
      totalPrice,
      subtotal,
      taxAmount,
      taxPercentage,
      numberOfGuests,
      adults,
      children,
      source,
      notes,
      guestNationality,
      customerEmail,
      customerPhone,
    }: ReservationNotification = await req.json();

    console.log("Processing reservation notification:", reservationId);
    
    // Fetch unit details if unitId is provided
    let matchedSuiteName = null;
    let matchedRoomNumber = null;
    
    if (unitId) {
      const { data: unitData, error: unitError } = await supabaseClient
        .from('units')
        .select('name, unit_number')
        .eq('id', unitId)
        .single();
      
      if (!unitError && unitData) {
        matchedSuiteName = unitData.name;
        matchedRoomNumber = unitData.unit_number;
        console.log("Matched unit details:", { name: matchedSuiteName, number: matchedRoomNumber });
      }
    }
    
    // Calculate proper adult/children counts if they're both 0 or undefined
    let finalAdults = adults;
    let finalChildren = children;
    
    if ((!adults || adults === 0) && (!children || children === 0) && numberOfGuests > 0) {
      // If both are 0 but we have guests, assume all are adults
      finalAdults = numberOfGuests;
      finalChildren = 0;
    }

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

    // Send customer confirmation email first
    if (customerEmail) {
      console.log(`Sending customer confirmation to: ${customerEmail}`);
      try {
        const customerResult = await resend.emails.send({
          from: "SuiteSpot Reservations <reservations@bookings.suitespoteg.com>",
          to: [customerEmail],
          subject: `Booking Confirmation - ${unitName} at ICONIA Zamalek`,
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
                    padding: 40px 30px;
                    border-radius: 10px 10px 0 0;
                    text-align: center;
                  }
                  .header h1 {
                    margin: 0;
                    font-size: 28px;
                  }
                  .check-icon {
                    font-size: 48px;
                    margin-bottom: 10px;
                  }
                  @media (prefers-color-scheme: dark) {
                    .header {
                      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
                    }
                    .header h1, .header p {
                      color: #ffffff !important;
                    }
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
                  .info-box {
                    background: #eff6ff;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #3b82f6;
                  }
                  .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    color: #6b7280;
                    font-size: 14px;
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <div class="check-icon">✓</div>
                  <h1>Booking Confirmed!</h1>
                  <p style="margin-top: 10px; margin-bottom: 0; font-size: 16px;">Your reservation at ICONIA Zamalek</p>
                </div>
                
                <div class="content">
                  <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
                    Dear ${guestNames[0] || 'Guest'},
                  </p>
                  <p style="color: #333; font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
                    Thank you for choosing SuiteSpot ICONIA Zamalek! We're delighted to confirm your reservation.
                  </p>
                  
                  <h2 style="color: #0f172a; margin-top: 0;">Your Booking Details</h2>
                  
                  <div class="detail-row">
                    <div class="detail-label">Confirmation:</div>
                    <div class="detail-value"><strong>${reservationId}</strong></div>
                  </div>
                  
                  <div class="detail-row">
                    <div class="detail-label">Guest(s):</div>
                    <div class="detail-value">${guestNames.join(", ")}</div>
                  </div>
                  
                  <div class="detail-row">
                    <div class="detail-label">Accommodation:</div>
                    <div class="detail-value"><strong>${unitName}</strong></div>
                  </div>
                  
                  <div class="detail-row">
                    <div class="detail-label">Check-in:</div>
                    <div class="detail-value">${checkInDate} at 3:00 PM</div>
                  </div>
                  
                  <div class="detail-row">
                    <div class="detail-label">Check-out:</div>
                    <div class="detail-value">${checkOutDate} by 12:00 PM</div>
                  </div>
                  
                  <div class="detail-row">
                    <div class="detail-label">Duration:</div>
                    <div class="detail-value">${nights} night${nights > 1 ? "s" : ""}</div>
                  </div>
                  
                  <div class="detail-row">
                    <div class="detail-label">Guests:</div>
                    <div class="detail-value">${numberOfGuests} guest${numberOfGuests > 1 ? "s" : ""} (${finalAdults || 0} adult${(finalAdults || 0) > 1 ? "s" : ""}, ${finalChildren || 0} child${(finalChildren || 0) !== 1 ? "ren" : ""})</div>
                  </div>
                  
                  <div class="highlight">
                    ${subtotal && taxAmount ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                      <span style="font-size: 14px; color: #6b7280;">Subtotal</span>
                      <span style="font-size: 14px; color: #374151;">$${subtotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #d1d5db;">
                      <span style="font-size: 14px; color: #6b7280;">VAT (${taxPercentage || 14}%)</span>
                      <span style="font-size: 14px; color: #374151;">$${taxAmount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 14px; color: #6b7280;">Total Amount</span>
                      <span style="font-size: 28px; font-weight: bold; color: #0f172a;">$${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <div class="info-box">
                    <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">Important Information</h3>
                    <p style="margin: 10px 0; color: #1e3a8a; font-size: 14px;">
                      <strong>Check-in Time:</strong> From 3:00 PM<br/>
                      <strong>Check-out Time:</strong> By 12:00 PM<br/>
                      <strong>Location:</strong> ICONIA Zamalek, Cairo, Egypt
                    </p>
                    <p style="margin: 15px 0 0 0; color: #1e3a8a; font-size: 14px;">
                      Please bring a valid ID or passport for check-in. Early check-in and late check-out may be available upon request, subject to availability.
                    </p>
                    ${guestNationality && ['Egypt', 'Saudi Arabia', 'United Arab Emirates', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Yemen', 'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Palestine', 'Libya', 'Tunisia', 'Algeria', 'Morocco', 'Sudan', 'Somalia', 'Djibouti', 'Mauritania', 'Comoros'].includes(guestNationality) ? `
                    <p style="margin: 15px 0 0 0; color: #dc2626; font-size: 14px; font-weight: 600;">
                      <strong>⚠️ Marriage Certificate Required:</strong> Egyptian and Arab couples/groups must present a valid marriage certificate upon check-in as per local regulations.
                    </p>
                    ` : ''}
                  </div>

                  <h3 style="color: #0f172a; margin-top: 30px;">Need Assistance?</h3>
                  <p style="color: #333; font-size: 14px; line-height: 1.6;">
                    Our team is here to help! If you have any questions or special requests, please don't hesitate to contact us:
                  </p>
                  <p style="color: #333; font-size: 14px; margin: 10px 0;">
                    📧 Email: <a href="mailto:youssef@suitespotegypt.com" style="color: #0f172a;">youssef@suitespotegypt.com</a><br/>
                    📱 Phone: +201003901516
                  </p>
                  
                  <p style="color: #333; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                    We're excited to host you and ensure you have a wonderful stay!
                  </p>
                  
                  <p style="color: #333; font-size: 14px; margin-top: 20px;">
                    Warm regards,<br/>
                    <strong>The SuiteSpot Team</strong>
                  </p>
                </div>
                
                <div class="footer">
                  <p>SuiteSpot - Your Home Away From Home</p>
                  <p style="font-size: 12px; margin-top: 10px; color: #9ca3af;">
                    ICONIA Zamalek, Cairo, Egypt
                  </p>
                </div>
              </body>
            </html>
          `,
        });
        console.log(`Customer confirmation sent successfully:`, customerResult);
        
        // Update reservation with email sent status
        if (reservationId) {
          const { error: updateError } = await supabaseClient
            .from('reservations')
            .update({
              confirmation_email_sent_at: new Date().toISOString(),
              confirmation_email_status: 'sent',
              confirmation_email_error: null
            })
            .eq('booking_reference', reservationId);
          
          if (updateError) {
            console.error('Failed to update email status:', updateError);
          } else {
            console.log('Email status updated to sent');
          }
        }
      } catch (error: any) {
        console.error(`Failed to send customer confirmation:`, error);
        
        // Update reservation with email failed status
        if (reservationId) {
          const { error: updateError } = await supabaseClient
            .from('reservations')
            .update({
              confirmation_email_status: 'failed',
              confirmation_email_error: error?.message || 'Unknown error'
            })
            .eq('booking_reference', reservationId);
          
          if (updateError) {
            console.error('Failed to update email error status:', updateError);
          }
        }
      }
      
      // Add delay before sending internal notifications
      await new Promise(resolve => setTimeout(resolve, 600));
    }

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

    console.log(`Sending internal notifications to ${users.length} team members`);

    // Send internal notification emails to all users with rate limiting (max 2 per second for Resend free tier)
    const results = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (!user.email) continue; // Skip if no email (should not happen due to filter above)
      
      console.log(`Attempting to send email to: ${user.email}`);
      
      try {
        // Build subject line with suite name and room number if available
        let subject = `New Reservation: ${guestNames.join(", ")}`;
        if (matchedSuiteName && matchedRoomNumber) {
          subject += ` - ${matchedSuiteName} - Room #${matchedRoomNumber}`;
        } else if (matchedSuiteName) {
          subject += ` - ${matchedSuiteName}`;
        } else {
          subject += ` - ${unitName}`;
        }
        
        const result = await resend.emails.send({
          from: "SuiteSpot Bookings <reservations@bookings.suitespoteg.com>",
          to: [user.email],
          subject: subject,
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
                /* Explicitly define dark mode styles to prevent Gmail iOS auto-inversion */
                @media (prefers-color-scheme: dark) {
                  .header {
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
                  }
                  .header h1, .header p {
                    color: #ffffff !important;
                  }
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
                <h1>New Reservation in ICONIA Zamalek</h1>
                <p style="margin-top: 0; margin-bottom: 0; font-size: 18px; font-weight: 400;">SuiteSpot Bookings</p>
              </div>
              
              <div class="content">
                <p style="color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                  Dear Team,
                </p>
                <p style="color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
                  A new reservation has been received. Please find the details below:
                </p>
                
                <h2 style="color: #0f172a; margin-top: 0;">Reservation Details</h2>
                
                <div class="detail-row">
                  <div class="detail-label">Guest(s):</div>
                  <div class="detail-value"><strong>${guestNames.join(", ")}</strong></div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Unit:</div>
                  <div class="detail-value"><strong>${unitName}</strong></div>
                </div>
                
                ${matchedSuiteName ? `
                <div class="detail-row">
                  <div class="detail-label">Suite:</div>
                  <div class="detail-value"><strong>${matchedSuiteName}</strong></div>
                </div>
                ` : ''}
                
                ${matchedRoomNumber ? `
                <div class="detail-row">
                  <div class="detail-label">Room #:</div>
                  <div class="detail-value"><strong>${matchedRoomNumber}</strong></div>
                </div>
                ` : ''}
                
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
                
                ${customerPhone ? `
                <div class="detail-row">
                  <div class="detail-label">Mobile Number:</div>
                  <div class="detail-value">+20 ${customerPhone}</div>
                </div>
                ` : ''}
                
                <div class="detail-row">
                  <div class="detail-label">Adults:</div>
                  <div class="detail-value">${finalAdults || 0}</div>
                </div>
                
                <div class="detail-row">
                  <div class="detail-label">Children:</div>
                  <div class="detail-value">${finalChildren || 0}</div>
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
                
                <p style="color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; font-size: 14px; line-height: 1.6; margin-top: 30px; margin-bottom: 10px;">
                  Please ensure the room is prepared according to our standard arrival checklist.<br/>
                  Front desk: kindly confirm the check-in time with the guest 24 hours before arrival.
                </p>
                
                <p style="color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; font-size: 14px; line-height: 1.6; margin-top: 20px;">
                  Best,<br/>
                  SuiteSpot Reservations System
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
