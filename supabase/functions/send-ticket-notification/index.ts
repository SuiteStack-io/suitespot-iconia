
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
            <meta name="color-scheme" content="light">
            <meta name="supported-color-schemes" content="light">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td bgcolor="${statusInfo.color}" style="background-color: ${statusInfo.color}; color: #ffffff; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-family: Arial, sans-serif;">${statusInfo.subject}</h1>
                  </td>
                </tr>
              </table>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2>Hello ${guestName},</h2>
                <p>${statusInfo.message}</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusInfo.color};">
                  <h3>${ticketTitle}</h3>
                  <p>
                    <strong>Status:</strong> 
                    <span style="display: inline-block; background: ${statusInfo.color}; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px;">${ticketStatus.toUpperCase().replace("_", " ")}</span>
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
                  <a href="${Deno.env.get("SUPABASE_URL")?.replace('/auth/v1', '')}/guest/login" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
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
              <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
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

Deno.serve(handler);
