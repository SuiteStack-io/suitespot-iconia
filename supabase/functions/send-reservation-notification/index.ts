
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getPropertyName } from "../_shared/property-utils.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RoomInfo {
  roomName: string;
  roomNumber: string;
  price: number;
}

interface SplitStaySegment {
  roomName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  price: number;
}

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
  isMultiRoom?: boolean;
  rooms?: RoomInfo[];
  isSplitStay?: boolean;
  splitStaySegments?: SplitStaySegment[];
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
      isMultiRoom,
      rooms,
      isSplitStay,
      splitStaySegments,
    }: ReservationNotification = await req.json();

    console.log("Processing reservation notification:", reservationId);
    
    // Fetch unit details if unitId is provided
    let matchedRoomName = null;
    let matchedRoomNumber = null;
    let unitPropertyId: string | null = null;
    
    if (unitId) {
      const { data: unitData, error: unitError } = await supabaseClient
        .from('units')
        .select('name, booking_com_name, unit_number, property_id')
        .eq('id', unitId)
        .single();
      
      if (!unitError && unitData) {
        matchedRoomName = unitData.booking_com_name || unitData.name;
        matchedRoomNumber = unitData.unit_number;
        unitPropertyId = unitData.property_id || null;
        console.log("Matched unit details:", { name: matchedRoomName, number: matchedRoomNumber });
      }
    }

    // Fetch dynamic property name
    const propertyName = await getPropertyName(supabaseClient, unitPropertyId);
    console.log("Dynamic property name:", propertyName);
    
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

    // Format short dates for subject line (e.g., "Feb 4")
    const checkInShort = new Date(checkIn).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const checkOutShort = new Date(checkOut).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    // Send customer confirmation email first
    if (customerEmail) {
      console.log(`Sending customer confirmation to: ${customerEmail}`);
      try {
        const customerResult = await resend.emails.send({
          from: "SuiteSpot Reservations <reservations@bookings.suitespoteg.com>",
          to: [customerEmail],
          subject: `Booking Confirmation - ${unitName} at ${propertyName}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="color-scheme" content="light">
                <meta name="supported-color-schemes" content="light">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                  <tr>
                    <td bgcolor="#0f172a" style="background-color: #0f172a; color: white; padding: 40px 30px; border-radius: 10px 10px 0 0; text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
                      <h1 style="margin: 0; font-size: 28px; color: #ffffff;">Booking Confirmed!</h1>
                      <p style="margin-top: 10px; margin-bottom: 0; font-size: 16px; color: #ffffff;">Your reservation at ${propertyName}</p>
                    </td>
                  </tr>
                </table>
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
                  <p style="margin-top: 10px; margin-bottom: 0; font-size: 16px;">Your reservation at ${propertyName}</p>
                </div>
                
                <div class="content">
                  <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
                    Dear ${guestNames[0] || 'Guest'},
                  </p>
                  <p style="color: #333; font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
                    Thank you for choosing SuiteSpot ${propertyName}! We're delighted to confirm your reservation.
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
                      <strong>Location:</strong> ${propertyName}
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
                    ${propertyName}
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

    // Determine property_id from unitId or reservation
    let notifPropertyId: string | null = null;
    if (unitId) {
      const { data: unitProp } = await supabaseClient
        .from('units')
        .select('property_id')
        .eq('id', unitId)
        .single();
      notifPropertyId = unitProp?.property_id || null;
    }
    console.log('Reservation notification property_id:', notifPropertyId);

    // Fetch all admin and manager users directly using service role
    const { data: userRoles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "manager", "front_desk"]);

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
    });

    // Filter by notification preferences
    const staffUserIds = users.map((u: any) => u.user_id);
    const { data: notifSettings } = await supabaseClient
      .from('user_notification_settings')
      .select('user_id, new_booking_email')
      .in('user_id', staffUserIds);

    const prefFilteredUsers = users.filter((u: any) => {
      const settings = notifSettings?.find((s: any) => s.user_id === u.user_id);
      if (settings && !settings.new_booking_email) {
        console.log(`Skipped ${u.email} — new booking notifications disabled`);
        return false;
      }
      return true;
    });

    // Filter by property access
    const filteredUsers = await filterByPropertyAccess(supabaseClient, prefFilteredUsers, notifPropertyId);

    console.log("Final users to notify:", filteredUsers.map((u: any) => ({ email: u.email, name: u.full_name })));

    if (!filteredUsers || filteredUsers.length === 0) {
      console.log("No users found to notify");
      return new Response(
        JSON.stringify({ message: "No users to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending internal notifications to ${filteredUsers.length} team members`);

    // Send internal notification emails to all users with rate limiting (max 2 per second for Resend free tier)
    const results = [];
    for (let i = 0; i < filteredUsers.length; i++) {
      const user = filteredUsers[i];
      if (!user.email) continue; // Skip if no email (should not happen due to filter above)
      
      console.log(`Attempting to send email to: ${user.email}`);
      
      try {
        // Build subject line with dates and room number
        let subject = `New Reservation: ${guestNames.join(", ")}`;
        if (isSplitStay && splitStaySegments && splitStaySegments.length > 1) {
          subject = `Split-Stay Reservation: ${guestNames.join(", ")} - ${checkInShort} to ${checkOutShort} - ${splitStaySegments.length} Rooms`;
        } else if (isMultiRoom && rooms && rooms.length > 1) {
          subject = `New Multi-Room Reservation: ${guestNames.join(", ")} - ${checkInShort} to ${checkOutShort} - ${rooms.length} Rooms`;
        } else if (matchedRoomNumber) {
          subject += ` - ${checkInShort} to ${checkOutShort} - Room #${matchedRoomNumber}`;
        } else {
          subject += ` - ${checkInShort} to ${checkOutShort}`;
        }
        
        // Build rooms HTML for multi-room bookings
        const multiRoomHtml = isMultiRoom && rooms && rooms.length > 1 ? `
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">🏨 Multi-Room Booking (${rooms.length} Rooms)</strong>
          </div>
          ${rooms.map((room, index) => `
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e2e8f0;">
              <strong style="color: #0f172a;">Room ${index + 1}: ${room.roomName}</strong>
              <div style="margin-top: 8px;">
                <span style="color: #6b7280;">Room #:</span> <strong>${room.roomNumber}</strong><br/>
                <span style="color: #6b7280;">Price:</span> <strong>$${room.price.toFixed(2)}</strong>
              </div>
            </div>
          `).join('')}
        ` : '';
        
        // Build split-stay HTML for room transfer bookings
        const splitStayHtml = isSplitStay && splitStaySegments && splitStaySegments.length > 1 ? `
          <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
            <strong style="color: #1e40af;">🔄 Split-Stay Reservation (${splitStaySegments.length} Segments)</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #1e3a8a;">Guest will change rooms during their stay</p>
          </div>
          ${splitStaySegments.map((segment, index) => {
            const segmentCheckIn = new Date(segment.checkIn).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const segmentCheckOut = new Date(segment.checkOut).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            return `
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e2e8f0; border-left: 4px solid ${index === 0 ? '#22c55e' : '#3b82f6'};">
                <div style="margin-bottom: 10px;">
                  <strong style="color: #0f172a; font-size: 16px;">Segment ${index + 1}: ${segment.roomName}</strong>
                  <span style="background: ${index === 0 ? '#dcfce7' : '#dbeafe'}; color: ${index === 0 ? '#166534' : '#1e40af'}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 10px;">
                    ${segment.nights} night${segment.nights !== 1 ? 's' : ''}
                  </span>
                </div>
                <table style="width: 100%; font-size: 14px;">
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0; width: 100px;">Room #:</td>
                    <td style="color: #111827; font-weight: 500;">${segment.roomNumber}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Dates:</td>
                    <td style="color: #111827; font-weight: 500;">${segmentCheckIn} → ${segmentCheckOut}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Price:</td>
                    <td style="color: #111827; font-weight: 500;">$${segment.price.toFixed(2)}</td>
                  </tr>
                </table>
              </div>
            `;
          }).join('')}
        ` : '';
        
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
                <h1>New Reservation in ${propertyName}</h1>
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
                
                ${isSplitStay && splitStaySegments && splitStaySegments.length > 1 ? splitStayHtml : 
                  (isMultiRoom && rooms && rooms.length > 1 ? multiRoomHtml : `
                <div class="detail-row">
                  <div class="detail-label">Room:</div>
                  <div class="detail-value"><strong>${matchedRoomName || unitName}</strong></div>
                </div>
                
                ${matchedRoomNumber ? `
                <div class="detail-row">
                  <div class="detail-label">Room #:</div>
                  <div class="detail-value"><strong>${matchedRoomNumber}</strong></div>
                </div>
                ` : ''}
                `)}
                
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
                
                ${isSplitStay && splitStaySegments && splitStaySegments.length > 1 ? (() => {
                  const transfers = splitStaySegments.slice(0, -1).map((segment, index) => {
                    const transferDate = new Date(segment.checkOut).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    });
                    const fromRoom = segment.roomName + ' (#' + segment.roomNumber + ')';
                    const toRoom = splitStaySegments[index + 1].roomName + ' (#' + splitStaySegments[index + 1].roomNumber + ')';
                    return { date: transferDate, from: fromRoom, to: toRoom };
                  });
                  
                  return `
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                      <strong style="color: #92400e; font-size: 16px;">⚠️ Room Transfer Reminder</strong>
                      ${transfers.map(t => `
                        <div style="margin-top: 12px; padding: 12px; background: #fffbeb; border-radius: 6px;">
                          <div style="color: #78350f; font-weight: 600; font-size: 15px;">
                            📅 ${t.date}
                          </div>
                          <div style="color: #92400e; font-size: 14px; margin-top: 6px;">
                            Guest moves from <strong>${t.from}</strong> → <strong>${t.to}</strong>
                          </div>
                        </div>
                      `).join('')}
                      <p style="margin: 15px 0 0 0; font-size: 13px; color: #92400e;">
                        Please coordinate with housekeeping to ensure both rooms are ready for the transfer.
                      </p>
                    </div>
                  `;
                })() : ''}
                
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
      if (i < filteredUsers.length - 1) {
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
