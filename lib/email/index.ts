import 'server-only';
import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'InternDocs <onboarding@resend.dev>';

/**
 * Sends an invitation email to a newly enrolled user with 7-day expiry.
 * PRD FR-1 & FR-18 / 12-backend-security-rules.md §7
 */
export async function sendInviteEmail(to: string, role: string, inviteUrl: string) {
  const resend = getResendClient();

  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not configured in .env.local. Email not sent. Invite URL:', inviteUrl);
    return { success: false, reason: 'RESEND_API_KEY missing' };
  }

  const subject = 'You have been invited to InternDocs (Makerspace)';
  const formattedRole = role.charAt(0).toUpperCase() + role.slice(1);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .logo { display: inline-block; background: #1e3a8a; color: #ffffff; font-weight: bold; padding: 6px 12px; border-radius: 8px; font-size: 14px; margin-bottom: 20px; }
          h1 { font-size: 20px; font-weight: bold; margin-top: 0; margin-bottom: 12px; color: #0f172a; }
          p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px; }
          .role-badge { display: inline-block; background: #f1f5f9; color: #1e293b; font-weight: 600; padding: 4px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
          .btn { display: inline-block; background-color: #1e3a8a; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 16px 0 24px; }
          .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">InternDocs</div>
          <h1>Welcome to Makerspace Document Portal</h1>
          <p>You have been invited to join the Makerspace document tracking system as an:</p>
          <div class="role-badge">Role: ${formattedRole}</div>
          <p>Please click the button below to accept your invitation and set up your secure password (minimum 12 characters).</p>
          <div>
            <a href="${inviteUrl}" class="btn" target="_blank">Accept Invitation & Set Password</a>
          </div>
          <p style="font-size: 12px; color: #64748b;">This invitation link is valid for <strong>7 days</strong>. If you did not expect this invitation, you can safely ignore this email.</p>
          <div class="footer">
            Makerspace Document Submission & Tracking System<br>
            If the button above does not work, copy and paste this URL into your browser:<br>
            <span style="word-break: break-all; color: #1e3a8a;">${inviteUrl}</span>
          </div>
        </div>
      </body>
    </html>
  `;

  // Retry up to 3 times on transient failure (skip retry for permanent domain restriction)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await resend.emails.send({
        from: DEFAULT_FROM,
        to: [to],
        subject,
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, messageId: data?.id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[Email] Attempt ${attempt}/3:`, msg);

      // Do not retry on permanent account/domain testing restrictions
      if (msg.includes('testing emails to your own email address') || msg.includes('domain') || attempt === 3) {
        return { success: false, error: msg };
      }

      await new Promise((res) => setTimeout(res, 800 * attempt));
    }
  }

  return { success: false, error: 'Failed to dispatch email' };
}
