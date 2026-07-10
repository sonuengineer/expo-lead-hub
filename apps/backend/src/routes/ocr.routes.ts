import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";
import { ocrManager } from "../services/ocr.service";

const router = Router();

// ── Multer Setup for Image Upload ────────┘
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, "Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

// ── Validation Schemas ────────────────────
const submitOcrLeadSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
  boothId: z.string().uuid("Invalid booth ID"),
  visitorTypeId: z.string().uuid("Invalid visitor type ID"),
  formDefinitionId: z.string().uuid("Invalid form definition ID"),
  ocrRawText: z.string(),
  ocrConfidence: z.number().min(0).max(1),
  formData: z.record(z.any()),
  submittedBy: z.string().uuid("Invalid user ID"),
});

// All OCR routes require authentication and STAFF+ role
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN", "STAFF"));

// ── POST /api/ocr/scan (Upload and OCR image) ──────
router.post(
  "/scan",
  upload.single("image"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError(400, "Image file is required");
    }

    try {
      // Extract text from image
      const ocrResult = await ocrManager.extractText(req.file.buffer, req.file.mimetype);

      res.json({
        ocrResult,
        message: "Image processed successfully",
        confidence: ocrResult.confidence,
      });
    } catch (error) {
      console.error("OCR processing error:", error);
      throw new AppError(500, "Failed to process image. Please try again.");
    }
  }),
);

// ── POST /api/ocr/submit (Submit OCR lead) ──────
router.post(
  "/submit",
  asyncHandler(async (req: Request, res: Response) => {
    const payload = submitOcrLeadSchema.parse(req.body);
    const { eventId, boothId, visitorTypeId, formDefinitionId, ocrRawText, ocrConfidence, formData, submittedBy } =
      payload;

    // Verify form exists and belongs to event
    const form = await prisma.formDefinition.findFirst({
      where: { id: formDefinitionId, eventId, isActive: true },
    });

    if (!form) {
      throw new AppError(400, "Form not found or inactive");
    }

    // Create lead with OCR data
    const lead = await prisma.lead.create({
      data: {
        eventId,
        boothId,
        visitorTypeId,
        formDefinitionId,
        source: "OCR_SCAN",
        rawFormData: formData,
        ocrRawText,
        ocrConfidence,
        submittedBy,
        status: "NEW",
      },
      include: {
        event: { select: { id: true, name: true } },
        booth: { select: { id: true, name: true } },
        visitorType: { select: { id: true, name: true } },
        formDefinition: { select: { id: true, name: true } },
        submittedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    // Create sync queue entries
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

    // Log audit event
    if (res.locals.logAudit) {
      await res.locals.logAudit({
        userId: req.user?.id,
        action: "LEAD_CREATED_OCR",
        entityType: "Lead",
        entityId: lead.id,
        newValue: lead,
      });
    }

    res.status(201).json({
      lead,
      message: "Lead created from OCR scan and queued for sync",
    });
  }),
);

// ── GET /api/ocr/history (Get OCR submission history) ──────
router.get(
  "/history",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, skip = 0, take = 20 } = req.query;

    if (!eventId) {
      throw new AppError(400, "Event ID is required");
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where: {
          eventId: eventId as string,
          source: "OCR_SCAN",
          submittedBy: req.user?.id,
        },
        include: {
          booth: { select: { id: true, name: true } },
          visitorType: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: typeof skip === "string" ? parseInt(skip) : 0,
        take: typeof take === "string" ? parseInt(take) : 20,
      }),
      prisma.lead.count({
        where: {
          eventId: eventId as string,
          source: "OCR_SCAN",
          submittedBy: req.user?.id,
        },
      }),
    ]);

    res.json({
      leads,
      total,
      page: typeof skip === "string" ? Math.floor(parseInt(skip) / (typeof take === "string" ? parseInt(take) : 20)) : 0,
    });
  }),
);

export { router as ocrRouter };
