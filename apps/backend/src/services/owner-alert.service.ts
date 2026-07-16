import { emailService } from "./email.service";
import { OWNER_EMAIL } from "./settings.service";

// Emails the owner when an integration fails in a way that looks like a
// key/quota/billing problem, so they know to switch a key. Rate-limited per
// context so a burst of failures doesn't spam the inbox.
const KEY_ERR = /quota|429|exhausted|rate.?limit|invalid.*key|api key|permission|403|401|unauthor|billing|credit|insufficient/i;
const COOLDOWN = 5 * 60 * 1000;
const lastAlert: Record<string, number> = {};

export async function alertOwnerOnKeyError(context: string, message: string): Promise<void> {
  const msg = String(message || "");
  if (!KEY_ERR.test(msg)) return;
  const now = Date.now();
  if (lastAlert[context] && now - lastAlert[context]! < COOLDOWN) return;
  lastAlert[context] = now;
  if (!emailService.isEmailConfigured()) return;
  await emailService
    .sendEmail(
      OWNER_EMAIL,
      `⚠️ ${context} failing — check the API key`,
      `A ${context} call just failed:\n\n${msg}\n\nThis usually means a key / quota / billing issue. Open the portal → Settings to switch the key (backup Gemini keys are tried automatically).`,
    )
    .catch((e) => console.error("[owner-alert] failed:", (e as Error)?.message));
}
