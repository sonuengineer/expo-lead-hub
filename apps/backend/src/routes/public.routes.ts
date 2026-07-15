import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../middleware/error-handler";
import { TtlCache } from "../utils/cache";
import { notifyLeadReceived } from "../services/notification.service";

const router = Router();

// Form definitions per event change rarely but are read on every QR scan and
// lead submission. Cache them briefly to skip a hot Postgres query each time.
const activeFormInclude = {
  fields: {
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    include: { options: { orderBy: { displayOrder: "asc" } } },
  },
} as const;

type ActiveForm = NonNullable<
  Awaited<ReturnType<typeof prisma.formDefinition.findFirst<{ include: typeof activeFormInclude }>>>
>;

const formCache = new TtlCache<ActiveForm>(60_000);

async function getActiveForm(eventId: string): Promise<ActiveForm | null> {
  const cached = formCache.get(eventId);
  if (cached) return cached;
  const form = await prisma.formDefinition.findFirst({
    where: { eventId, isActive: true },
    include: activeFormInclude,
  });
  if (form) formCache.set(eventId, form);
  return form;
}

// ── GET /booth-context (Public — active event + booth for the kiosk) ──
router.get(
  "/booth-context",
  asyncHandler(async (_req: Request, res: Response) => {
    const event = await prisma.event.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        bannerImageUrl: true,
        booths: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { id: true, name: true },
        },
      },
    });

    if (!event) {
      throw new AppError(404, "No active event configured");
    }

    res.json({
      event: {
        id: event.id,
        name: event.name,
        logoUrl: event.logoUrl,
        bannerImageUrl: event.bannerImageUrl,
      },
      booth: event.booths[0] ?? null,
    });
  }),
);

// ── POST /booth-lead (Public — optional lead from the calculator) ──
const boothLeadSchema = z.object({
  eventId: z.string().uuid().optional(),
  boothId: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  company: z.string().optional(),
  phone: z.string().optional(),
  designation: z.string().optional(),
  calculator: z.record(z.any()).optional(),
});

router.post(
  "/booth-lead",
  asyncHandler(async (req: Request, res: Response) => {
    const data = boothLeadSchema.parse(req.body);

    // Resolve event + booth (fall back to the active event / its first booth).
    let eventId = data.eventId;
    let boothId = data.boothId;
    if (!eventId || !boothId) {
      const active = await prisma.event.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { startDate: "desc" },
        select: { id: true, booths: { where: { isActive: true }, take: 1, select: { id: true } } },
      });
      eventId = eventId ?? active?.id;
      boothId = boothId ?? active?.booths[0]?.id;
    }
    if (!eventId || !boothId) {
      throw new AppError(400, "No active event/booth to attach this lead to");
    }

    // Same resolution pattern as ai.routes: first active visitor type + form.
    const [visitorType, form] = await Promise.all([
      prisma.visitorType.findFirst({
        where: { eventId, isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      getActiveForm(eventId),
    ]);
    if (!visitorType || !form) {
      throw new AppError(400, "This event has no active visitor type / form configured");
    }

    const lead = await prisma.lead.create({
      data: {
        eventId,
        boothId,
        visitorTypeId: visitorType.id,
        formDefinitionId: form.id,
        source: "MANUAL",
        rawFormData: {
          contact_person: data.name,
          company_name: data.company ?? "",
          email: data.email,
          mobile_number: data.phone ?? "",
          designation: data.designation ?? "",
          _source: "CALCULATOR",
          _calculator: data.calculator ?? {},
        } as any,
        status: "NEW",
      },
    });

    await Promise.all([
      prisma.syncQueue.create({ data: { leadId: lead.id, target: "CRM", status: "PENDING" } }),
      prisma.syncQueue.create({ data: { leadId: lead.id, target: "GOOGLE_SHEETS", status: "PENDING" } }),
    ]);

    // WhatsApp: welcome the visitor + send the lead report to the client (non-blocking).
    void notifyLeadReceived(lead.id).catch(() => {});

    res.status(201).json({ leadId: lead.id, message: "Saved" });
  }),
);

// ── GET /v/:shortCode (Public QR redirect) ────────
router.get(
  "/v/:shortCode",
  asyncHandler(async (req: Request, res: Response) => {
    const { shortCode } = req.params;

    // Find QR code
    const qrCode = await prisma.qrCode.findUnique({
      where: { shortCode },
      include: {
        event: { select: { id: true, name: true } },
        booth: { select: { id: true, name: true } },
        visitorType: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!qrCode || !qrCode.isActive) {
      throw new AppError(404, "QR code not found or inactive");
    }

    // Scan count is analytics only — don't block the form response on it.
    void prisma.qrCode
      .update({ where: { id: qrCode.id }, data: { scanCount: { increment: 1 } } })
      .catch(() => {});

    // Form definitions per event are cached (they change rarely).
    const formDefinition = await getActiveForm(qrCode.eventId);

    // Return form data for frontend to render
    res.json({
      qrCode: {
        id: qrCode.id,
        shortCode: qrCode.shortCode,
        eventId: qrCode.eventId,
        boothId: qrCode.boothId,
        visitorTypeId: qrCode.visitorType.id,
      },
      event: qrCode.event,
      booth: qrCode.booth,
      visitorType: qrCode.visitorType,
      form: formDefinition,
    });
  }),
);

// ── POST /api/public/leads (Submit lead) ──────────
const submitLeadSchema = z.object({
  qrCodeId: z.string().uuid("Invalid QR code ID"),
  visitorTypeId: z.string().uuid("Invalid visitor type ID"),
  boothId: z.string().uuid("Invalid booth ID"),
  formDefinitionId: z.string().uuid("Invalid form definition ID"),
  eventId: z.string().uuid("Invalid event ID"),
  formData: z.record(z.any()).refine((data) => Object.keys(data).length > 0, {
    message: "Form data cannot be empty",
  }),
});

router.post(
  "/leads",
  asyncHandler(async (req: Request, res: Response) => {
    const payload = submitLeadSchema.parse(req.body);
    const { qrCodeId, visitorTypeId, boothId, formDefinitionId, eventId, formData } = payload;

    // Verify QR code and the event's active form in parallel. The form is
    // served from cache when warm (it rarely changes), saving a round-trip.
    const [qrCode, form] = await Promise.all([
      prisma.qrCode.findUnique({ where: { id: qrCodeId } }),
      getActiveForm(eventId),
    ]);

    if (!qrCode || !qrCode.isActive) {
      throw new AppError(400, "Invalid or inactive QR code");
    }

    if (!form || form.id !== formDefinitionId) {
      throw new AppError(400, "Form not found or inactive");
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        eventId,
        boothId,
        visitorTypeId,
        formDefinitionId,
        source: "QR_SCAN",
        rawFormData: formData,
        status: "NEW",
      },
      include: {
        event: { select: { id: true, name: true } },
        booth: { select: { id: true, name: true } },
        visitorType: { select: { id: true, name: true } },
        formDefinition: { select: { id: true, name: true } },
      },
    });

    // Create sync queue entries for CRM and Google Sheets
    await Promise.all([
      prisma.syncQueue.create({
        data: {
          leadId: lead.id,
          target: "CRM",
          status: "PENDING",
        },
      }),
      prisma.syncQueue.create({
        data: {
          leadId: lead.id,
          target: "GOOGLE_SHEETS",
          status: "PENDING",
        },
      }),
    ]);

    // WhatsApp: welcome the visitor + send the lead report to the client (non-blocking).
    void notifyLeadReceived(lead.id).catch(() => {});

    res.status(201).json({
      lead,
      message: "Lead submitted successfully. Syncing to CRM and Google Sheets...",
    });
  }),
);

// ── GET /api/public/leads/status/:leadId (Check lead sync status) ──────
router.get(
  "/leads/status/:leadId",
  asyncHandler(async (req: Request, res: Response) => {
    const { leadId } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        syncQueue: true,
        syncLogs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    if (!lead) {
      throw new AppError(404, "Lead not found");
    }

    res.json({
      lead,
      syncQueue: lead.syncQueue,
      recentLogs: lead.syncLogs,
    });
  }),
);

export { router as publicRouter };
