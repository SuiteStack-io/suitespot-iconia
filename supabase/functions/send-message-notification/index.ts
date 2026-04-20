
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getPropertyName } from "../_shared/property-utils.ts";
import { getPropertySettings } from "../_shared/property-settings.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MessageNotificationRequest {
  property_id: string | null;
  guest_name: string;
  provider: string;
  message_text: string | null;
  booking_reference: string | null;
  thread_id: string;
}

async function filterByPropertyAccess(
  supabase: any,
  users: any[],
  propertyId: string | null
): Promise<any[]> {
  if (!propertyId) return users;

  const userIds = users.map((u: any) => u.user_id);
  const { data: accessRecords } = await supabase
    .from("property_user_access")
    .select("user_id")
    .eq("property_id", propertyId)
    .in("user_id", userIds);

  const usersWithAccess = new Set(
    (accessRecords || []).map((r: any) => r.user_id)
  );

  return users.filter((u: any) => {
    if (u.role === "admin") return true;
    if (usersWithAccess.has(u.user_id)) return true;
    console.log(
      `Skipped ${u.email} — no property access for ${propertyId}`
    );
    return false;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      property_id,
      guest_name,
      provider,
      message_text,
      booking_reference,
      thread_id,
    }: MessageNotificationRequest = await req.json();

    console.log(
      "[send-message-notification] Processing for thread:",
      thread_id
    );

    const propertyName = await getPropertyName(supabase, property_id);
    const settings = await getPropertySettings(supabase, property_id);

    // Fetch admin/front_desk users
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "manager", "front_desk"]);

    if (rolesError) throw rolesError;
    if (!userRoles || userRoles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const userIds = userRoles.map((ur: any) => ur.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const { data: authUsers, error: authError } =
      await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    const users = userRoles
      .map((ur: any) => {
        const profile = profiles?.find((p: any) => p.id === ur.user_id);
        const authUser = authUsers.users.find(
          (u: any) => u.id === ur.user_id
        );
        return {
          user_id: ur.user_id,
          email: authUser?.email,
          full_name: profile?.full_name,
          role: ur.role,
        };
      })
      .filter((u: any) => !!u.email);

    // Filter by notification preferences (reuse new_booking_email for now)
    const { data: notifSettings } = await supabase
      .from("user_notification_settings")
      .select("user_id, new_booking_email")
      .in("user_id", users.map((u: any) => u.user_id));

    const prefFiltered = users.filter((u: any) => {
      const settings = notifSettings?.find(
        (s: any) => s.user_id === u.user_id
      );
      if (settings && !settings.new_booking_email) {
        console.log(`Skipped ${u.email} — notifications disabled`);
        return false;
      }
      return true;
    });

    // Filter by property access
    const filteredUsers = await filterByPropertyAccess(
      supabase,
      prefFiltered,
      property_id
    );

    if (filteredUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(
      `[send-message-notification] Sending to ${filteredUsers.length} users`
    );

    const truncatedMessage =
      message_text && message_text.length > 500
        ? message_text.substring(0, 500) + "..."
        : message_text || "(No message text)";

    const subject = `New Message from ${guest_name || "Guest"} - ${propertyName}`;

    const results = [];
    for (let i = 0; i < filteredUsers.length; i++) {
      const user = filteredUsers[i];
      if (!user.email) continue;

      try {
        const emailResult = await resend.emails.send({
          from: `${propertyName} Inbox <${settings.from_email_notifications}>`,
          to: [user.email],
          subject,
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
                    <td bgcolor="#0f172a" style="background-color: #0f172a; color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                      <div style="font-size: 40px; margin-bottom: 8px;">💬</div>
                      <h1 style="margin: 0; font-size: 22px; color: #ffffff;">New Guest Message</h1>
                      <p style="margin-top: 8px; margin-bottom: 0; font-size: 14px; color: #94a3b8;">${propertyName}</p>
                    </td>
                  </tr>
                </table>

                <div style="background: #ffffff; padding: 25px; border: 1px solid #e5e7eb; border-top: none;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; color: #374151;">
                    <tr>
                      <td style="padding: 10px 0; font-weight: 600; width: 130px; color: #6b7280; vertical-align: top;">Guest:</td>
                      <td style="padding: 10px 0;">${guest_name || "Unknown Guest"}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; font-weight: 600; color: #6b7280; vertical-align: top;">Channel:</td>
                      <td style="padding: 10px 0;">${provider || "Unknown"}</td>
                    </tr>
                    ${booking_reference ? `
                    <tr>
                      <td style="padding: 10px 0; font-weight: 600; color: #6b7280; vertical-align: top;">Booking Ref:</td>
                      <td style="padding: 10px 0;">${booking_reference}</td>
                    </tr>
                    ` : ""}
                  </table>

                  <div style="background: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0 0 6px 0; font-weight: 600; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Message</p>
                    <p style="margin: 0; font-size: 15px; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${truncatedMessage}</p>
                  </div>

                  <div style="text-align: center; margin-top: 25px;">
                    <p style="font-size: 14px; color: #6b7280; margin: 0;">
                      Reply to this message from your <strong>PMS Inbox</strong>.
                    </p>
                  </div>
                </div>

                <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
                  <p style="margin: 0;">This is an automated notification from ${propertyName}.</p>
                </div>
              </body>
            </html>
          `,
        });
        console.log(`Email sent to ${user.email}:`, JSON.stringify(emailResult));
        results.push({ success: true, email: user.email });
      } catch (sendErr: any) {
        console.error(`Failed to send to ${user.email}:`, sendErr);
        results.push({ success: false, email: user.email, error: sendErr.message });
      }

      // Rate limit: 600ms between sends
      if (i < filteredUsers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `[send-message-notification] Done: ${successCount}/${filteredUsers.length} sent`
    );

    return new Response(
      JSON.stringify({
        message: "Message notifications sent",
        sent: successCount,
        total: filteredUsers.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err: any) {
    console.error("[send-message-notification] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
