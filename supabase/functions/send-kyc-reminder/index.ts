import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface KYCReminderRequest {
  guestName: string;
  guestEmail: string;
  kycLink: string;
  propertyName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guestName, guestEmail, kycLink, propertyName }: KYCReminderRequest = await req.json();

    console.log("Sending KYC reminder to:", guestEmail);

    const emailResponse = await resend.emails.send({
      from: "SuiteSpot Almaza <onboarding@resend.dev>",
      to: [guestEmail],
      subject: "Complete Your SuiteSpot Almaza Questionnaire",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: 'Playfair Display', Georgia, serif;
                background-color: #f5f5f0;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                background: linear-gradient(135deg, #d4af37 0%, #f4e4c1 100%);
                padding: 40px 20px;
                text-align: center;
              }
              .header h1 {
                color: #2c3e50;
                margin: 0;
                font-size: 32px;
                font-weight: 600;
                letter-spacing: -0.02em;
              }
              .content {
                padding: 40px 30px;
              }
              .content h2 {
                color: #2c3e50;
                font-size: 24px;
                font-weight: 500;
                margin-top: 0;
              }
              .content p {
                color: #4a5568;
                font-size: 16px;
                line-height: 1.6;
                margin: 20px 0;
              }
              .cta-button {
                display: inline-block;
                background-color: #d4af37;
                color: #ffffff;
                text-decoration: none;
                padding: 16px 48px;
                border-radius: 6px;
                font-size: 18px;
                font-weight: 500;
                margin: 30px 0;
                text-align: center;
              }
              .cta-button:hover {
                background-color: #c09d2e;
              }
              .footer {
                background-color: #f7fafc;
                padding: 30px;
                text-align: center;
                color: #718096;
                font-size: 14px;
              }
              .property-info {
                background-color: #f7fafc;
                padding: 20px;
                border-radius: 6px;
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to SuiteSpot Almaza</h1>
              </div>
              <div class="content">
                <h2>Hello ${guestName},</h2>
                <p>We're excited to guide you through the next step in finding your perfect home at Almaza Bay.</p>
                ${propertyName ? `
                  <div class="property-info">
                    <p style="margin: 0; font-weight: 500;">Property: ${propertyName}</p>
                  </div>
                ` : ''}
                <p>To help us tailor the perfect home options for your stay, please complete our short questionnaire:</p>
                <center>
                  <a href="${kycLink}" class="cta-button">Complete Questionnaire</a>
                </center>
                <p>This will only take a few minutes, and we'll get back to you within 3 hours with personalized options.</p>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #d4af37;">${kycLink}</p>
              </div>
              <div class="footer">
                <p>SuiteSpot Almaza Bay | Almaza Bay, North Coast, Egypt</p>
                <p>If you have any questions, feel free to reach out to us.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-kyc-reminder function:", error);
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
