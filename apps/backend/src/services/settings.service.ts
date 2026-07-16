import crypto from "crypto";
import { prisma } from "@elc/db";
import { env } from "../config/env";

// Only this account can view/change integration settings — even other super
// admins cannot. Kept here so the routes and guards share one source of truth.
export const OWNER_EMAIL = "sonu.prajapati@rathinfotech.com";

export interface SettingDef {
  key: string;
  label: string;
  group: string;
  secret?: boolean; // masked in the UI + never returned in full
  type?: "text" | "select";
  options?: string[];
}

// The integration credentials that can be managed from the portal.
export const SETTINGS: SettingDef[] = [
  { key: "GEMINI_API_KEY", label: "Gemini API key", group: "Gemini (AI scoring + card OCR)", secret: true },
  { key: "GEMINI_API_KEY_2", label: "Gemini API key — backup 1", group: "Gemini (AI scoring + card OCR)", secret: true },
  { key: "GEMINI_API_KEY_3", label: "Gemini API key — backup 2", group: "Gemini (AI scoring + card OCR)", secret: true },
  { key: "GEMINI_MODEL", label: "Gemini model", group: "Gemini (AI scoring + card OCR)" },
  { key: "PAGESPEED_API_KEY", label: "PageSpeed API key", group: "PageSpeed (Lighthouse)", secret: true },
  { key: "DATAFORSEO_LOGIN", label: "DataForSEO login (email)", group: "DataForSEO (DA / PA / keywords)" },
  { key: "DATAFORSEO_PASSWORD", label: "DataForSEO password", group: "DataForSEO (DA / PA / keywords)", secret: true },
  { key: "SEO_PROVIDER", label: "SEO provider", group: "DataForSEO (DA / PA / keywords)", type: "select", options: ["auto", "dataforseo", "pagespeed"] },
  { key: "DATAFORSEO_LOCATION_CODE", label: "Market location code (2356 = India)", group: "DataForSEO (DA / PA / keywords)" },
  { key: "DATAFORSEO_LANGUAGE_CODE", label: "Language code", group: "DataForSEO (DA / PA / keywords)" },
  { key: "RESEND_API_KEY", label: "Resend API key", group: "Email (Resend)", secret: true },
  { key: "EMAIL_FROM", label: "From address", group: "Email (Resend)" },
  { key: "OPENWA_BASE_URL", label: "OpenWA base URL", group: "WhatsApp (OpenWA)" },
  { key: "OPENWA_API_KEY", label: "OpenWA API key", group: "WhatsApp (OpenWA)", secret: true },
  { key: "OPENWA_SESSION_ID", label: "OpenWA session id", group: "WhatsApp (OpenWA)" },
];
const MANAGED = new Set(SETTINGS.map((s) => s.key));

// ── Encryption (AES-256-GCM, key derived from ENCRYPTION_KEY) ──
function encKey(): Buffer {
  return crypto.createHash("sha256").update(env.ENCRYPTION_KEY ?? "elc-default-encryption-key").digest();
}
function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv.toString("hex"), c.getAuthTag().toString("hex"), enc.toString("hex")].join(":");
}
function decrypt(blob: string): string {
  const [ivh, tagh, ench] = blob.split(":");
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivh!, "hex"));
  d.setAuthTag(Buffer.from(tagh!, "hex"));
  return Buffer.concat([d.update(Buffer.from(ench!, "hex")), d.final()]).toString("utf8");
}

// ── In-memory override cache (synchronous getter for hot paths) ──
let cache: Record<string, string> = {};

export async function refreshSettings(): Promise<void> {
  try {
    const rows = await prisma.appSetting.findMany();
    const next: Record<string, string> = {};
    for (const r of rows) {
      try {
        next[r.key] = decrypt(r.value);
      } catch {
        /* skip undecryptable */
      }
    }
    cache = next;
  } catch (e) {
    console.error("[settings] load failed:", (e as Error).message);
  }
}

// Effective value: portal override → else env → else "".
export function setting(key: string): string {
  const o = cache[key];
  if (o != null && o !== "") return o;
  return String((env as any)[key] ?? "");
}

export function settingInt(key: string, fallback: number): number {
  const v = parseInt(setting(key), 10);
  return Number.isFinite(v) ? v : fallback;
}

// Gemini keys in priority order (primary + backups), non-empty only.
export function geminiKeys(): string[] {
  return [setting("GEMINI_API_KEY"), setting("GEMINI_API_KEY_2"), setting("GEMINI_API_KEY_3")]
    .map((s) => s.trim())
    .filter(Boolean);
}

// Save (empty value removes the override so it falls back to env).
export async function saveSettings(updates: Record<string, string>, userId?: string): Promise<void> {
  for (const [key, raw] of Object.entries(updates)) {
    if (!MANAGED.has(key)) continue;
    const val = String(raw ?? "").trim();
    if (val === "") {
      await prisma.appSetting.deleteMany({ where: { key } });
      delete cache[key];
    } else {
      const value = encrypt(val);
      await prisma.appSetting.upsert({
        where: { key },
        create: { key, value, updatedBy: userId },
        update: { value, updatedBy: userId },
      });
      cache[key] = val;
    }
  }
}

// Masked status for the UI — never returns secrets in full.
export function settingsStatus() {
  return SETTINGS.map((s) => {
    const override = cache[s.key];
    const envVal = String((env as any)[s.key] ?? "");
    const hasOverride = override != null && override !== "";
    const effective = hasOverride ? override : envVal;
    const mask = (v: string) => (!v ? "" : s.secret ? "••••" + v.slice(-4) : v);
    return {
      key: s.key,
      label: s.label,
      group: s.group,
      secret: !!s.secret,
      type: s.type ?? "text",
      options: s.options,
      configured: Boolean(effective),
      source: hasOverride ? "portal" : envVal ? "env" : "none",
      display: mask(effective),
    };
  });
}
