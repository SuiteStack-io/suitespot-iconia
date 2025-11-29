import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketNotificationRequest {
  email: string;
  guestName: string;
  ticketTitle: string;
  ticketStatus: string;
  ticketId: string;
  resolutionNotes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email,
      guestName,
      ticketTitle,
      ticketStatus,
      ticketId,
      resolutionNotes,
    }: TicketNotificationRequest = await req.json();

    console.log("Sending ticket notification to:", email);

    const statusMessages: Record<string, { subject: string; message: string; color: string }> = {
      open: {
        subject: "Ticket Received",
        message: "We've received your request and will address it shortly.",
        color: "#FFA500",
      },
      in_progress: {
        subject: "Ticket In Progress",
        message: "Our team is currently working on your request.",
        color: "#2196F3",
      },
      resolved: {
        subject: "Ticket Resolved",
        message: "Your request has been resolved!",
        color: "#4CAF50",
      },
      closed: {
        subject: "Ticket Closed",
        message: "Your ticket has been closed.",
        color: "#9E9E9E",
      },
    };

    const statusInfo = statusMessages[ticketStatus] || statusMessages.open;

    const emailResponse = await resend.emails.send({
      from: "SuiteSpot Support <support@bookings.suitespoteg.com>",
      to: [email],
      subject: `${statusInfo.subject} - ${ticketTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${statusInfo.color}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusInfo.color}; }
              .status-badge { display: inline-block; background: ${statusInfo.color}; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${statusInfo.subject}</h1>
              </div>
              <div class="content">
                <h2>Hello ${guestName},</h2>
                <p>${statusInfo.message}</p>
                
                <div class="ticket-info">
                  <h3>${ticketTitle}</h3>
                  <p>
                    <strong>Status:</strong> 
                    <span class="status-badge">${ticketStatus.toUpperCase().replace("_", " ")}</span>
                  </p>
                  <p><strong>Ticket ID:</strong> ${ticketId.slice(0, 8)}</p>
                  ${resolutionNotes ? `
                    <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 5px;">
                      <strong>Resolution Notes:</strong>
                      <p style="margin-top: 10px;">${resolutionNotes}</p>
                    </div>
                  ` : ''}
                </div>

                <p>
                  You can view the full details and status of your ticket by logging into your guest portal.
                </p>

                <div style="text-align: center;">
                  <a href="${Deno.env.get("SUPABASE_URL")?.replace('/auth/v1', '')}/guest/login" class="button">
                    View Ticket Details
                  </a>
                </div>

                <p style="margin-top: 30px;">
                  If you have any questions, please don't hesitate to reach out through the guest portal.
                </p>
                
                <p style="margin-top: 20px;">
                  Best regards,<br>
                  <strong>The SuiteSpot Team</strong>
                </p>
              </div>
              <div class="footer">
                <p>This is an automated notification from SuiteSpot Guest Portal</p>
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
