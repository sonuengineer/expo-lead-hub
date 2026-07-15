import { Router, Request, Response } from "express";
import axios from "axios";
import { z } from "zod";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";
import { whatsAppService } from "../services/whatsapp.service";
import { emailService } from "../services/email.service";
import { env } from "../config/env";

const router = Router();
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN"));

const channelSchema = z.enum(["EMAIL", "WHATSAPP", "SLACK", "WEBHOOK"]);

const createSchema = z.object({
  eventId: z.string().uuid(),
  channel: channelSchema,
  isActive: z.boolean().default(true),
  config: z.record(z.any()).default({}),
  events: z.array(z.string()).default(["LEAD_RECEIVED"]),
});

const updateSchema = createSchema.partial().omit({ eventId: true });

// ── List notification configs for an event ──
router.get(
  "/:eventId",
  asyncHandler(async (req: Request, res: Response) => {
    const eventId = req.params.eventId as string;
    const configs = await prisma.notificationConfig.findMany({
      where: { eventId },
      orderBy: { channel: "asc" },
    });
    res.json({ configs });
  }),
);

// ── Create a notification config ──
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const data = createSchema.parse(req.body);
    const event = await prisma.event.findUnique({ where: { id: data.eventId } });
    if (!event) throw new AppError(404, "Event not found");

    const config = await prisma.notificationConfig.create({
      data: {
        eventId: data.eventId,
        channel: data.channel,
        isActive: data.isActive,
        config: data.config,
        events: data.events,
      },
    });
    res.status(201).json({ config });
  }),
);

// ── Update a notification config ──
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const data = updateSchema.parse(req.body);
    const existing = await prisma.notificationConfig.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Notification config not found");

    const updated = await prisma.notificationConfig.update({
      where: { id },
      data: {
        ...(data.channel !== undefined ? { channel: data.channel } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.config !== undefined ? { config: data.config } : {}),
        ...(data.events !== undefined ? { events: data.events } : {}),
      },
    });
    res.json({ config: updated });
  }),
);

// ── Delete a notification config ──
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await prisma.notificationConfig.delete({ where: { id } }).catch(() => {
      throw new AppError(404, "Notification config not found");
    });
    res.json({ message: "Deleted" });
  }),
);

// ── OpenWA connection status (proxy to the gateway) ──
router.get(
  "/whatsapp/status",
  asyncHandler(async (_req: Request, res: Response) => {
    const baseUrlSet = Boolean(env.OPENWA_BASE_URL);
    const apiKeySet = Boolean(env.OPENWA_API_KEY);
    const result: any = {
      configured: baseUrlSet && apiKeySet,
      baseUrlSet,
      apiKeySet,
      baseUrl: env.OPENWA_BASE_URL ?? null,
      defaultSessionId: env.OPENWA_SESSION_ID,
      connected: false,
      sessions: [],
    };

    if (baseUrlSet && apiKeySet) {
      try {
        const base = env.OPENWA_BASE_URL!.replace(/\/+$/, "");
        const { data } = await axios.get(`${base}/api/sessions`, {
          headers: { "X-API-Key": env.OPENWA_API_KEY! },
          timeout: 8000,
        });
        result.connected = true;
        result.sessions = Array.isArray(data) ? data : (data?.sessions ?? []);
      } catch (e: any) {
        result.error = e?.response?.data?.message ?? e?.message ?? "OpenWA unreachable";
      }
    }

    res.json(result);
  }),
);

// ── Email (SMTP) connection status ──
router.get(
  "/email/status",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      configured: emailService.isEmailConfigured(),
      from: emailService.emailFrom(),
      provider: env.RESEND_API_KEY ? "resend" : env.SMTP_HOST ? "smtp" : null,
    });
  }),
);

// ── OpenWA test message ──
const testSchema = z.object({
  phone: z.string().min(5, "Phone is required"),
  sessionId: z.string().optional(),
  message: z.string().optional(),
});

router.post(
  "/whatsapp/test",
  asyncHandler(async (req: Request, res: Response) => {
    const { phone, sessionId, message } = testSchema.parse(req.body);
    if (!env.OPENWA_BASE_URL || !env.OPENWA_API_KEY) {
      throw new AppError(400, "OpenWA is not configured (set OPENWA_BASE_URL / OPENWA_API_KEY)");
    }
    try {
      await whatsAppService.sendText(
        sessionId || env.OPENWA_SESSION_ID,
        whatsAppService.toChatId(phone),
        message || "Test message from Exhibition Lead Capture",
      );
      res.json({ ok: true, message: "Test message sent" });
    } catch (e: any) {
      throw new AppError(502, e?.message ?? "Failed to send test message");
    }
  }),
);

// ── Email test message ──
const emailTestSchema = z.object({
  email: z.string().email("A valid email is required"),
  subject: z.string().optional(),
  message: z.string().optional(),
});

router.post(
  "/email/test",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, subject, message } = emailTestSchema.parse(req.body);
    if (!emailService.isEmailConfigured()) {
      throw new AppError(400, "Email is not configured (set SMTP_HOST / SMTP_FROM)");
    }
    try {
      await emailService.sendEmail(
        email,
        subject || "Test email from Exhibition Lead Capture",
        message || "This is a test email confirming your SMTP configuration works.",
      );
      res.json({ ok: true, message: "Test email sent" });
    } catch (e: any) {
      throw new AppError(502, e?.message ?? "Failed to send test email");
    }
  }),
);

export { router as notificationsRouter };
