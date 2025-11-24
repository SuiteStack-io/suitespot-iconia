import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  guestName: string;
  propertyName?: string;
  completedAt: string;
  kycLinkId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guestName, propertyName, completedAt, kycLinkId }: NotificationRequest = await req.json();

    console.log("Sending KYC completion notification for:", guestName);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all admin users
    const { data: users, error: usersError } = await supabase.rpc(
      "get_all_users_with_emails"
    );

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    const adminUsers = users?.filter((user: any) => user.role === "admin") || [];

    if (adminUsers.length === 0) {
      console.log("No admin users found");
      return new Response(
        JSON.stringify({ message: "No admin users to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Found ${adminUsers.length} admin users to notify`);

    const formattedDate = new Date(completedAt).toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    });

    const typeformLink = "https://admin.typeform.com/form/HB53DCc4/results";
    const kycManagementLink = `https://${Deno.env.get("SUPABASE_URL")?.split("//")[1]?.split(".")[0]}.lovable.app/kyc-management`;

    // Send email to each admin
    const emailPromises = adminUsers.map(async (admin: any) => {
      try {
        const emailResponse = await resend.emails.send({
          from: "SuiteSpot Almaza <onboarding@resend.dev>",
          to: [admin.email],
          subject: "🎉 New KYC Questionnaire Completed",
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
                  .info-box {
                    background-color: #f7fafc;
                    padding: 20px;
                    border-radius: 6px;
                    margin: 20px 0;
                  }
                  .info-box p {
                    margin: 10px 0;
                    font-weight: 500;
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
                    margin: 10px 10px 10px 0;
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
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🎉 New Questionnaire Completed</h1>
                  </div>
                  <div class="content">
                    <h2>A guest has completed their KYC questionnaire!</h2>
                    <div class="info-box">
                      <p><strong>Guest Name:</strong> ${guestName}</p>
                      ${propertyName ? `<p><strong>Property:</strong> ${propertyName}</p>` : ''}
                      <p><strong>Completed At:</strong> ${formattedDate}</p>
                    </div>
                    <p>You can view the submission details and manage KYC links using the buttons below:</p>
                    <center>
                      <a href="${typeformLink}" class="cta-button">View Typeform Responses</a>
                      <a href="${kycManagementLink}" class="cta-button">Manage KYC Links</a>
                    </center>
                  </div>
                  <div class="footer">
                    <p>SuiteSpot Almaza Bay | Almaza Bay, North Coast, Egypt</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });

        console.log(`Email sent to ${admin.email}:`, emailResponse);
        return { success: true, email: admin.email };
      } catch (error) {
        console.error(`Failed to send email to ${admin.email}:`, error);
        return { success: false, email: admin.email, error };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.success).length;

    console.log(`Sent ${successCount}/${adminUsers.length} notifications successfully`);

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} notification(s) to admin users`,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-kyc-completion-notification function:", error);
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
