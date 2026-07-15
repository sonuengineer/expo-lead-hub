import { prisma } from "@elc/db";
import { env } from "../config/env";
import { whatsAppService } from "./whatsapp.service";
import { emailService } from "./email.service";

// ── Field extraction (tolerant of camelCase / snake_case form keys) ──
const NAME_KEYS = ["contactPerson", "contact_person", "name", "fullName", "full_name", "contactName"];
const COMPANY_KEYS = ["companyName", "company_name", "company", "organization"];
const PHONE_KEYS = ["mobileNumber", "mobile_number", "phone", "phoneNumber", "phone_number", "mobile"];
const EMAIL_KEYS = ["email", "emailAddress", "email_address"];

function pick(data: Record<string, any> | null | undefined, keys: string[]): string {
  if (!data) return "";
  for (const k of keys) {
    const v = data[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
}

interface ChannelConfig {
  sessionId?: string; // WhatsApp only — which OpenWA session to use
  welcomeEnabled?: boolean;
  reportEnabled?: boolean;
  welcomeTemplate?: string;
  reportTemplate?: string;
  subject?: string; // Email only
}

const DEFAULT_WELCOME =
  "Hi {name}! Thanks for visiting {event}. We've received your details and our team will get in touch soon.";
const DEFAULT_REPORT = "Here's what we captured:\nName: {name}\nCompany: {company}";

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

// Fire notifications for a freshly captured lead. The "visitor" who submitted
// the form is our client, so the welcome message + lead report are sent to that
// visitor (phone for WhatsApp, email for Email) on every enabled channel.
// Safe to call fire-and-forget; all failures are logged and swallowed.
export async function notifyLeadReceived(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { event: { select: { id: true, name: true } } },
  });
  if (!lead) return;

  const configs = await prisma.notificationConfig.findMany({
    where: { eventId: lead.eventId, isActive: true },
  });

  const data = (lead.rawFormData ?? {}) as Record<string, any>;
  const vars = {
    name: pick(data, NAME_KEYS) || "there",
    company: pick(data, COMPANY_KEYS),
    event: lead.event.name,
  };
  const sessionId = env.OPENWA_SESSION_ID;
  const visitorPhone = pick(data, PHONE_KEYS);
  const visitorEmail = pick(data, EMAIL_KEYS);
  if (!visitorPhone && !visitorEmail) return; // nowhere to send

  for (const cfg of configs) {
    const triggers = (cfg.events as string[] | null) ?? [];
    if (!triggers.includes("LEAD_RECEIVED")) continue;
    const c = (cfg.config ?? {}) as ChannelConfig;

    if (cfg.channel === "WHATSAPP" && visitorPhone) {
      const chatId = whatsAppService.toChatId(visitorPhone);
      const sid = await whatsAppService
        .resolveSessionId(c.sessionId || sessionId)
        .catch(() => c.sessionId || sessionId);
      if (c.welcomeEnabled !== false) {
        const text = render(c.welcomeTemplate || DEFAULT_WELCOME, vars);
        await whatsAppService
          .sendText(sid, chatId, text)
          .catch((e) => console.error("[whatsapp] welcome failed:", (e as Error)?.message));
      }
      if (c.reportEnabled !== false) {
        const text = render(c.reportTemplate || DEFAULT_REPORT, vars);
        await whatsAppService
          .sendText(sid, chatId, text)
          .catch((e) => console.error("[whatsapp] report failed:", (e as Error)?.message));
      }
    }

    if (cfg.channel === "EMAIL" && visitorEmail) {
      const subject = c.subject || `Thank you for visiting ${lead.event.name}`;
      const parts: string[] = [];
      if (c.welcomeEnabled !== false) parts.push(render(c.welcomeTemplate || DEFAULT_WELCOME, vars));
      if (c.reportEnabled !== false) parts.push(render(c.reportTemplate || DEFAULT_REPORT, vars));
      if (parts.length) {
        await emailService
          .sendEmail(visitorEmail, subject, parts.join("\n\n"))
          .catch((e) => console.error("[email] notification failed:", (e as Error)?.message));
      }
    }
  }
}
