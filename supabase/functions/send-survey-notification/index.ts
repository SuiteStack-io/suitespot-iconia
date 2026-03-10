
import { Resend } from "https://esm.sh/resend@3.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SurveyNotificationRequest {
  guestEmail: string;
  guestName: string;
  ticketId: string;
  ticketTitle: string;
  surveyUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guestEmail, guestName, ticketId, ticketTitle, surveyUrl }: SurveyNotificationRequest = await req.json();

    console.log("Sending survey notification to:", guestEmail);

    const emailResponse = await resend.emails.send({
      from: "SuiteSpot <feedback@bookings.suitespoteg.com>",
      to: [guestEmail],
      subject: "We'd love your feedback!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0EA5E9;">Thank you for letting us help you!</h2>
          <p>Hi ${guestName},</p>
          <p>We've resolved your ticket: <strong>${ticketTitle}</strong></p>
          <p>We'd really appreciate your feedback on how we handled your request. Your input helps us improve our service for all guests.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${surveyUrl}" 
               style="background-color: #0EA5E9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Take 2-Minute Survey
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            This survey will only take a couple of minutes and helps us serve you better.
          </p>
          <p style="margin-top: 30px;">
            Best regards,<br>
            The SuiteSpot Team
          </p>
        </div>
      `,
    });

    console.log("Survey email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-survey-notification function:", error);
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
