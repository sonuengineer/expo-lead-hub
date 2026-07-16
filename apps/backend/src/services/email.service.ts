import axios from "axios";
import nodemailer from "nodemailer";
import { env } from "../config/env";
import { setting } from "./settings.service";

let transporter: nodemailer.Transporter | null = null;

// The "From" address is shared by both providers. Must be on a domain you've
// authenticated (e.g. seo@rathinfotech.com verified in Resend).
function fromAddress(): string | undefined {
  return setting("EMAIL_FROM") || env.SMTP_FROM;
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
  return Boolean(fromAddress()) && Boolean(setting("RESEND_API_KEY") || env.SMTP_HOST);
}

export function emailFrom(): string | null {
  return fromAddress() ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Turn the plain-text template into a clean, email-client-safe HTML message.
// Spacing is preserved (blank lines become paragraph gaps, single newlines
// become <br>), and the final block is treated as the signature: the first
// line bold, the rest muted. Emails/URLs in the signature are auto-linked.
export function textToHtml(text: string): string {
  const blocks = text.trim().split(/\n{2,}/);
  const linkify = (line: string) =>
    line
      .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" style="color:#4f46e5;text-decoration:none">$1</a>')
      .replace(/\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)\b/gi, (m) =>
        /@/.test(m) ? m : `<a href="${m.startsWith("http") ? m : "https://" + m}" style="color:#4f46e5;text-decoration:none">${m}</a>`,
      );

  const parts = blocks.map((block, i) => {
    const lines = escapeHtml(block).split("\n");
    const isSignature = blocks.length > 1 && i === blocks.length - 1;
    if (isSignature) {
      const [name, ...rest] = lines;
      const restHtml = rest.map((l) => linkify(l)).join("<br>");
      return (
        `<p style="margin:24px 0 0;line-height:1.5;color:#475569;font-size:14px">` +
        `<strong style="color:#0f172a;font-size:15px">${name}</strong>` +
        (restHtml ? `<br>${restHtml}` : "") +
        `</p>`
      );
    }
    return `<p style="margin:0 0 16px;line-height:1.6;color:#0f172a;font-size:15px">${lines.join("<br>")}</p>`;
  });

  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;` +
    `max-width:560px;margin:0 auto;padding:8px 4px;color:#0f172a">` +
    parts.join("") +
    `</div>`
  );
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
  const from = fromAddress();
  if (!from) {
    throw new Error("Email not configured (EMAIL_FROM / SMTP_FROM missing)");
  }
  const htmlBody = html ?? textToHtml(text);

  // Prefer Resend's HTTP API — sends over HTTPS, so no outbound SMTP ports
  // needed (which some hosts block).
  const resendKey = setting("RESEND_API_KEY");
  if (resendKey) {
    await axios.post(
      "https://api.resend.com/emails",
      { from, to, subject, text, html: htmlBody },
      {
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      },
    );
    return;
  }

  const t = getTransporter();
  await t.sendMail({ from, to, subject, text, html: htmlBody });
}

export const emailService = { isEmailConfigured, emailFrom, textToHtml, sendEmail };
