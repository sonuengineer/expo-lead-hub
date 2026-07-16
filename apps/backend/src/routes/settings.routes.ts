import { Router, Request, Response, NextFunction } from "express";
import axios from "axios";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";
import {
  OWNER_EMAIL,
  settingsStatus,
  saveSettings,
  setting,
} from "../services/settings.service";
import { emailService } from "../services/email.service";
import { whatsAppService } from "../services/whatsapp.service";
import { fetchAccountBalance } from "../services/dataforseo.service";

const router = Router();
router.use(authenticate);

// Owner-only — even other super admins are blocked.
router.use((req: Request, _res: Response, next: NextFunction) => {
  if ((req.user?.email || "").toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    return next(new AppError(403, "You are not authorized to view settings"));
  }
  next();
});

// ── GET /api/settings — masked status of every integration key ──
router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ settings: settingsStatus() });
  }),
);

// ── PUT /api/settings — save overrides (empty value clears back to env) ──
const saveSchema = z.object({ updates: z.record(z.string()) });
router.put(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { updates } = saveSchema.parse(req.body);
    await saveSettings(updates, req.user?.id);
    res.json({ settings: settingsStatus(), message: "Settings saved" });
  }),
);

// ── GET /api/settings/dataforseo-balance — remaining DataForSEO credit ──
router.get(
  "/dataforseo-balance",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await fetchAccountBalance());
  }),
);

// ── POST /api/settings/test/:integration — live-test a set of credentials ──
router.post(
  "/test/:integration",
  asyncHandler(async (req: Request, res: Response) => {
    const which = String(req.params.integration);
    try {
      if (which === "gemini") {
        const key = setting("GEMINI_API_KEY");
        if (!key) throw new AppError(400, "No Gemini key set");
        const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: setting("GEMINI_MODEL") || "gemini-1.5-flash" });
        await model.generateContent("ping");
        return res.json({ ok: true, detail: "Gemini responded" });
      }
      if (which === "pagespeed") {
        const key = setting("PAGESPEED_API_KEY");
        const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&strategy=mobile&category=performance${key ? `&key=${key}` : ""}`;
        await axios.get(url, { timeout: 70000 });
        return res.json({ ok: true, detail: key ? "PageSpeed key works" : "PageSpeed works (no key — rate-limited)" });
      }
      if (which === "dataforseo") {
        const login = setting("DATAFORSEO_LOGIN");
        const pass = setting("DATAFORSEO_PASSWORD");
        if (!login || !pass) throw new AppError(400, "No DataForSEO credentials set");
        const auth = Buffer.from(`${login}:${pass}`).toString("base64");
        const { data } = await axios.get("https://api.dataforseo.com/v3/appendix/user_data", {
          headers: { Authorization: `Basic ${auth}` },
          timeout: 15000,
        });
        if (data?.status_code !== 20000) throw new AppError(502, data?.status_message ?? "DataForSEO rejected the credentials");
        return res.json({ ok: true, detail: "DataForSEO credentials valid" });
      }
      if (which === "email") {
        if (!emailService.isEmailConfigured()) throw new AppError(400, "Email is not configured");
        await emailService.sendEmail(OWNER_EMAIL, "Settings test email", "This confirms your email settings work.");
        return res.json({ ok: true, detail: `Test email sent to ${OWNER_EMAIL}` });
      }
      if (which === "whatsapp") {
        if (!setting("OPENWA_BASE_URL") || !setting("OPENWA_API_KEY")) throw new AppError(400, "OpenWA is not configured");
        const sessions = await whatsAppService.getSessions();
        return res.json({ ok: true, detail: `OpenWA reachable — ${sessions.length} session(s)` });
      }
      throw new AppError(400, "Unknown integration");
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError(502, e?.response?.data?.message ?? e?.message ?? "Test failed");
    }
  }),
);

export { router as settingsRouter };
