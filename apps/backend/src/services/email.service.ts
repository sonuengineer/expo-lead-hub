import axios from "axios";
import nodemailer from "nodemailer";
import { env } from "../config/env";

let transporter: nodemailer.Transporter | null = null;

// The "From" address is shared by both providers. Must be on a domain you've
// authenticated (e.g. seo@rathinfotech.com verified in Resend).
function fromAddress(): string | undefined {
  return env.EMAIL_FROM || env.SMTP_FROM;
}

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  if (!env.SMTP_HOST) {
    throw new Error("SMTP not configured (SMTP_HOST missing)");
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

// Email is usable if we have a From address AND at least one transport:
// Resend (preferred) or SMTP.
export function isEmailConfigured(): boolean {
  return Boolean(fromAddress()) && Boolean(env.RESEND_API_KEY || env.SMTP_HOST);
}

export function emailFrom(): string | null {
  return fromAddress() ?? null;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const from = fromAddress();
  if (!from) {
    throw new Error("Email not configured (EMAIL_FROM / SMTP_FROM missing)");
  }

  // Prefer Resend's HTTP API — sends over HTTPS, so no outbound SMTP ports
  // needed (which some hosts block).
  if (env.RESEND_API_KEY) {
    await axios.post(
      "https://api.resend.com/emails",
      { from, to, subject, text },
      {
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      },
    );
    return;
  }

  const t = getTransporter();
  await t.sendMail({ from, to, subject, text });
}

export const emailService = { isEmailConfigured, emailFrom, sendEmail };
