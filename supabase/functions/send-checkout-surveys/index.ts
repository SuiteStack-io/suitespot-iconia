
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@3.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Checking for recent checkouts...");

    // Get reservations that checked out in the last 24 hours and haven't received a survey
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: reservations, error: fetchError } = await supabase
      .from("reservations")
      .select("id, booking_reference, contact_email, guest_names, check_out_date")
      .eq("status", "confirmed")
      .lte("check_out_date", new Date().toISOString().split("T")[0])
      .gte("check_out_date", yesterday.toISOString().split("T")[0])
      .is("survey_sent_at", null)
      .not("contact_email", "is", null);

    if (fetchError) {
      console.error("Error fetching reservations:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${reservations?.length || 0} reservations to send surveys to`);

    let sentCount = 0;
    let errorCount = 0;

    // Send surveys in background
    const sendSurveys = async () => {
      for (const reservation of reservations || []) {
        try {
          const surveyUrl = `${Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "")}/guest/stay-survey/${reservation.id}`;
          
          console.log(`Sending survey to ${reservation.contact_email} for reservation ${reservation.booking_reference}`);

          // Send email
          const emailResponse = await resend.emails.send({
            from: "SuiteSpot <feedback@bookings.suitespoteg.com>",
            to: [reservation.contact_email],
            subject: "How was your stay with us?",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0EA5E9;">Thank you for staying with us!</h2>
                <p>Hi ${reservation.guest_names[0] || "Guest"},</p>
                <p>We hope you enjoyed your stay at SuiteSpot. Your feedback is incredibly valuable to us and helps us improve our service for future guests.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${surveyUrl}" 
                     style="background-color: #0EA5E9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Share Your Feedback
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                  This quick survey will only take 2-3 minutes and helps us serve you better on your next visit.
                </p>
                <p style="margin-top: 30px;">
                  Best regards,<br>
                  The SuiteSpot Team
                </p>
              </div>
            `,
          });

          console.log("Email sent:", emailResponse);

          // Mark survey as sent
          await supabase
            .from("reservations")
            .update({ survey_sent_at: new Date().toISOString() })
            .eq("id", reservation.id);

          sentCount++;
        } catch (error) {
          console.error(`Error sending survey for reservation ${reservation.id}:`, error);
          errorCount++;
        }
      }

      console.log(`Survey sending completed: ${sentCount} sent, ${errorCount} errors`);
    };

    // Run surveys asynchronously
    sendSurveys().catch(console.error);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processing ${reservations?.length || 0} survey emails`,
        reservationsFound: reservations?.length || 0,
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
    console.error("Error in send-checkout-surveys function:", error);
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
