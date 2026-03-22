
import { Resend } from "https://esm.sh/resend@3.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuestCredentialsRequest {
  email: string;
  guestName: string;
  username: string;
  password: string;
  checkInDate: string;
  checkOutDate: string;
  unitName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email,
      guestName,
      username,
      password,
      checkInDate,
      checkOutDate,
      unitName,
    }: GuestCredentialsRequest = await req.json();

    console.log("Sending credentials to:", email);

    const emailResponse = await resend.emails.send({
      from: "SuiteSpot <welcome@bookings.suitespoteg.com>",
      to: [email],
      subject: "Welcome to SuiteSpot - Your Guest Portal Access",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="color-scheme" content="light">
            <meta name="supported-color-schemes" content="light">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td bgcolor="#764ba2" style="background-color: #764ba2; color: #ffffff; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-family: Arial, sans-serif;">Welcome to SuiteSpot!</h1>
                    <p style="color: #ffffff; margin: 8px 0 0 0; font-family: Arial, sans-serif;">Your stay is about to begin</p>
                  </td>
                </tr>
              </table>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2>Hello ${guestName},</h2>
                <p>We're excited to welcome you to <strong>${unitName}</strong>!</p>
                
                <div class="info-box">
                  <strong>Your Stay Details:</strong><br>
                  Check-in: ${new Date(checkInDate).toLocaleDateString()}<br>
                  Check-out: ${new Date(checkOutDate).toLocaleDateString()}
                </div>

                <p>We've created your guest portal account where you can:</p>
                <ul>
                  <li>View property amenities and their locations</li>
                  <li>Submit maintenance or housekeeping requests</li>
                  <li>Access important property information</li>
                  <li>Contact our team for assistance</li>
                </ul>

                <div class="credentials">
                  <h3>Your Login Credentials</h3>
                  <p><strong>Username:</strong> ${username}</p>
                  <p><strong>Password:</strong> ${password}</p>
                  <p style="color: #666; font-size: 14px; margin-top: 10px;">
                    Please keep these credentials safe and do not share them with others.
                  </p>
                </div>

                <div style="text-align: center;">
                  <a href="${Deno.env.get("SUPABASE_URL")?.replace('/auth/v1', '')}/guest/login" class="button">
                    Access Guest Portal
                  </a>
                </div>

                <p style="margin-top: 30px;">
                  If you have any questions or need assistance, please don't hesitate to reach out to our team through the guest portal.
                </p>

                <p>We look forward to making your stay comfortable and memorable!</p>
                
                <p style="margin-top: 20px;">
                  Best regards,<br>
                  <strong>The SuiteSpot Team</strong>
                </p>
              </div>
              <div class="footer">
                <p>This is an automated message from SuiteSpot Guest Portal</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
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
