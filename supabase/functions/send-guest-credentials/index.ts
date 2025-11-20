import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

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
      from: "SuiteSpot <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to SuiteSpot - Your Guest Portal Access",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              .info-box { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to SuiteSpot!</h1>
                <p>Your stay is about to begin</p>
              </div>
              <div class="content">
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

serve(handler);
