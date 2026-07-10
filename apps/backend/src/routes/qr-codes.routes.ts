import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { nanoid } from "nanoid";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";

const router = Router({ mergeParams: true });

// ── Validation Schemas ────────────────────
const generateQrSchema = z.object({
  visitorTypeIds: z.array(z.string().uuid("Invalid visitor type ID")).min(1, "At least one visitor type is required"),
  label: z.string().optional(),
});

// All QR routes require authentication and ADMIN+ role
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN"));

// ── GET /api/events/:eventId/booths/:boothId/qr ──────
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId } = req.params;

    // Verify booth exists and belongs to event
    const booth = await prisma.booth.findFirst({
      where: { id: boothId, eventId },
    });

    if (!booth) {
      throw new AppError(404, "Booth not found");
    }

    const qrCodes = await prisma.qrCode.findMany({
      where: { boothId },
      include: {
        visitorType: { select: { id: true, name: true, slug: true, color: true } },
        booth: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      qrCodes,
      total: qrCodes.length,
    });
  }),
);

// ── GET /api/events/:eventId/booths/:boothId/qr/:qrId ──
router.get(
  "/:qrId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId, qrId } = req.params;

    const qr = await prisma.qrCode.findFirst({
      where: { id: qrId, boothId },
      include: {
        event: { select: { id: true, name: true } },
        booth: { select: { id: true, name: true } },
        visitorType: { select: { id: true, name: true, slug: true, color: true } },
      },
    });

    if (!qr || qr.event.id !== eventId) {
      throw new AppError(404, "QR code not found");
    }

    res.json({ qr });
  }),
);

// ── POST /api/events/:eventId/booths/:boothId/qr (Generate QR) ──────
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId } = req.params;
    const { visitorTypeIds, label } = generateQrSchema.parse(req.body);

    // Verify booth exists and belongs to event
    const booth = await prisma.booth.findFirst({
      where: { id: boothId, eventId },
    });

    if (!booth) {
      throw new AppError(404, "Booth not found");
    }

    // Verify visitor types exist and belong to event
    const visitorTypes = await prisma.visitorType.findMany({
      where: { eventId, id: { in: visitorTypeIds } },
    });

    if (visitorTypes.length !== visitorTypeIds.length) {
      throw new AppError(400, "Some visitor types not found or don't belong to this event");
    }

    // Generate QR codes for each visitor type
    const trimmedLabel = label?.trim();
    const generatedQrs = await Promise.all(
      visitorTypeIds.map(async (visitorTypeId) => {
        const shortCode = nanoid(8); // 8-char short code
        const vtName = visitorTypes.find((vt) => vt.id === visitorTypeId)?.name;
        // No label → use the visitor-type name. Label + multiple types → "Label - Type".
        const finalLabel = trimmedLabel
          ? visitorTypeIds.length === 1
            ? trimmedLabel
            : `${trimmedLabel} - ${vtName}`
          : (vtName ?? null);

        return prisma.qrCode.create({
          data: {
            eventId,
            boothId,
            visitorTypeId,
            shortCode,
            label: finalLabel,
            isActive: true,
          },
          include: {
            visitorType: { select: { id: true, name: true, slug: true, color: true } },
            booth: { select: { id: true, name: true } },
          },
        });
      }),
    );

    res.status(201).json({
      qrCodes: generatedQrs,
      message: `Generated ${generatedQrs.length} QR code(s)`,
    });
  }),
);

// ── DELETE /api/events/:eventId/booths/:boothId/qr/:qrId ──
router.delete(
  "/:qrId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId, qrId } = req.params;

    // Verify QR code exists
    const qr = await prisma.qrCode.findFirst({
      where: { id: qrId, boothId, eventId },
    });

    if (!qr) {
      throw new AppError(404, "QR code not found");
    }

    await prisma.qrCode.delete({ where: { id: qrId } });

    res.json({ message: "QR code deleted successfully", qrId });
  }),
);

// ── Activate/Deactivate QR ─────────────────
router.post(
  "/:qrId/activate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId, qrId } = req.params;

    const qr = await prisma.qrCode.findFirst({
      where: { id: qrId, boothId, eventId },
    });

    if (!qr) {
      throw new AppError(404, "QR code not found");
    }

    const updated = await prisma.qrCode.update({
      where: { id: qrId },
      data: { isActive: true },
      include: {
        visitorType: { select: { id: true, name: true } },
      },
    });

    res.json({ qr: updated, message: "QR code activated" });
  }),
);

router.post(
  "/:qrId/deactivate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId, qrId } = req.params;

    const qr = await prisma.qrCode.findFirst({
      where: { id: qrId, boothId, eventId },
    });

    if (!qr) {
      throw new AppError(404, "QR code not found");
    }

    const updated = await prisma.qrCode.update({
      where: { id: qrId },
      data: { isActive: false },
      include: {
        visitorType: { select: { id: true, name: true } },
      },
    });

    res.json({ qr: updated, message: "QR code deactivated" });
  }),
);

export { router as qrCodeRouter };
