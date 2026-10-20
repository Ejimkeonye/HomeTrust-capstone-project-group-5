import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// ─── Create Reusable Transporter ─────────────────────────────────────────────
// Uses Gmail SMTP by default. To use another provider, change the host/port.
// For Gmail: enable 2FA on your Google account, then generate an App Password
// at https://myaccount.google.com/apppasswords and put it in SMTP_PASS.
const isConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = nodemailer.createTransport(
  process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }
    : {
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }
);

interface SendInviteEmailOptions {
  to: string;
  inviterName: string;
  propertyAddress: string;
  inviteLink: string;
  role: string;
}

export async function sendInviteEmail({
  to,
  inviterName,
  propertyAddress,
  inviteLink,
  role,
}: SendInviteEmailOptions): Promise<void> {
  if (!isConfigured) {
    console.warn('[Mailer] SMTP_USER or SMTP_PASS not set in environment. Skipping email sending.');
    return;
  }

  const subject = `🏠 HomeTrust — You've been invited to an inspection`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #f8f7fc; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #4A1E6D; margin: 0; font-size: 24px;">HomeTrust</h1>
        <p style="color: #666; font-size: 13px; margin-top: 4px;">Property Inspection Platform</p>
      </div>

      <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e8e0f0;">
        <h2 style="color: #333; font-size: 18px; margin-top: 0;">You've Been Invited!</h2>

        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you as the <strong>${role}</strong> to participate in a property inspection for:
        </p>

        <div style="background: #f3f0f8; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
          <p style="color: #4A1E6D; font-weight: bold; margin: 0; font-size: 14px;">
            📍 ${propertyAddress}
          </p>
        </div>

        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          Click the button below to accept the invitation and join the inspection. If you don't have an account yet, you'll be able to create one.
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${inviteLink}" style="display: inline-block; background: #4A1E6D; color: white; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 32px; border-radius: 10px;">
            Accept Invitation
          </a>
        </div>

        <p style="color: #999; font-size: 11px; text-align: center; margin-bottom: 0;">
          This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
        </p>
      </div>

      <p style="color: #aaa; font-size: 10px; text-align: center; margin-top: 16px;">
        © ${new Date().getFullYear()} HomeTrust · Property Inspection Platform
      </p>
    </div>
  `;

  const text = `HomeTrust Invitation\n\n${inviterName} has invited you as the ${role} to a property inspection at ${propertyAddress}.\n\nAccept your invitation here: ${inviteLink}\n\nThis link expires in 7 days.`;

  await transporter.sendMail({
    from: `"HomeTrust" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}


/** Sends a password reset code using the HTTPS email API when configured, or SMTP otherwise. */
export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const subject = 'HomeTrust password reset code';
  const text = 'Your HomeTrust verification code is ' + code + '. It expires in 10 minutes. If you did not request this, you can ignore this email.';
  const html = '<p>Your HomeTrust verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">' +
    code + '</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>';

  if (process.env.RESEND_API_KEY) {
    if (!process.env.EMAIL_FROM) throw new Error('EMAIL_FROM must be configured when using the email API');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
    });
    if (!response.ok) throw new Error('Email API rejected the message with status ' + response.status);
    return;
  }

  if (!isConfigured || !process.env.SMTP_USER) {
    throw new Error('Configure RESEND_API_KEY and EMAIL_FROM or SMTP_USER and SMTP_PASS');
  }
  await transporter.sendMail({
    from: 'HomeTrust <' + process.env.SMTP_USER + '>',
    to,
    subject,
    text,
    html,
  });
}