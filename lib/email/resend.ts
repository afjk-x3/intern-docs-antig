import 'server-only';
import { Resend } from 'resend';

// Use the default test domain if no custom domain is provided, as approved by user
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN || 'onboarding@resend.dev'; 

let resendClient: Resend | null = null;
if (RESEND_API_KEY) {
  resendClient = new Resend(RESEND_API_KEY);
}

export async function sendEmailWithRetry(
  to: string,
  subject: string,
  htmlContent: string,
  retries = 3
): Promise<{ success: boolean; error?: string }> {
  if (!resendClient) {
    console.warn('RESEND_API_KEY not configured. Skipping email send to:', to);
    return { success: true }; // Pretend it succeeded in local dev without keys
  }

  // Handle default test domain restrictions (only works with the verified email)
  const fromAddress = RESEND_FROM_DOMAIN.includes('@') 
    ? RESEND_FROM_DOMAIN 
    : `InternDocs <notifications@${RESEND_FROM_DOMAIN}>`;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < retries) {
    try {
      const { error } = await resendClient.emails.send({
        from: fromAddress,
        to,
        subject,
        html: htmlContent,
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (err: unknown) {
      attempt++;
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`Email send attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < retries) {
        // Wait 1s, 2s before retrying
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  return { success: false, error: `Failed after ${retries} attempts. Last error: ${lastError?.message}` };
}
