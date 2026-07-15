import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ENCRYPTION_KEY: z.string().optional(),
  // AI Experience Hub (all optional — feature is disabled until keys are set)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-lite"),
  AI_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3), // roasts running at once; rest queue
  PAGESPEED_API_KEY: z.string().optional(), // optional; PSI works without one at lower rate limits
  DATAFORSEO_LOGIN: z.string().optional(),
  DATAFORSEO_PASSWORD: z.string().optional(),
  // WhatsApp (OpenWA self-hosted gateway) — all optional; feature is disabled
  // until OPENWA_BASE_URL + OPENWA_API_KEY are set.
  OPENWA_BASE_URL: z.string().optional(),
  OPENWA_API_KEY: z.string().optional(),
  OPENWA_SESSION_ID: z.string().default("default"),
  // Email — optional; feature disabled until configured.
  // Preferred: Resend HTTP API (works everywhere, no SMTP ports needed).
  // Fallback: raw SMTP. EMAIL_FROM applies to both (falls back to SMTP_FROM).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
