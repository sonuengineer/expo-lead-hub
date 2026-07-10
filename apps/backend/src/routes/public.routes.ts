import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../middleware/error-handler";

const router = Router();

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

    // Increment scan count
    await prisma.qrCode.update({
      where: { id: qrCode.id },
      data: { scanCount: { increment: 1 } },
    });

    // Get form definition for this event
    const formDefinition = await prisma.formDefinition.findFirst({
      where: { eventId: qrCode.eventId, isActive: true },
      include: {
        fields: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
          include: { options: { orderBy: { displayOrder: "asc" } } },
        },
      },
    });

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

    // Verify QR code exists and is active
    const qrCode = await prisma.qrCode.findUnique({
      where: { id: qrCodeId },
    });

    if (!qrCode || !qrCode.isActive) {
      throw new AppError(400, "Invalid or inactive QR code");
    }

    // Verify form definition exists and belongs to event
    const form = await prisma.formDefinition.findFirst({
      where: { id: formDefinitionId, eventId, isActive: true },
    });

    if (!form) {
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
