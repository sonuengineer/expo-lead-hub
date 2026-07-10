import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";
import { qrCodeRouter } from "./qr-codes.routes";

const router = Router({ mergeParams: true });

// ── Validation Schemas ────────────────────
const createBoothSchema = z.object({
  name: z.string().min(1, "Booth name is required"),
  description: z.string().optional(),
  locationHint: z.string().optional(),
});

const updateBoothSchema = createBoothSchema.partial();

// All booth routes require authentication and ADMIN+ role
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN"));

// ── GET /api/events/:eventId/booths ──────
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "Event not found");
    }

    const booths = await prisma.booth.findMany({
      where: { eventId },
      include: {
        leads: { select: { id: true } },
        qrCodes: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      booths: booths.map((b) => ({
        ...b,
        leadCount: b.leads.length,
        qrCodeCount: b.qrCodes.length,
      })),
      total: booths.length,
    });
  }),
);

// ── GET /api/events/:eventId/booths/:boothId ──
router.get(
  "/:boothId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId } = req.params;

    const booth = await prisma.booth.findFirst({
      where: { id: boothId, eventId },
      include: {
        event: { select: { id: true, name: true } },
        leads: { select: { id: true } },
        qrCodes: { select: { id: true, shortCode: true, scanCount: true } },
      },
    });

    if (!booth) {
      throw new AppError(404, "Booth not found");
    }

    res.json({
      booth: {
        ...booth,
        leadCount: booth.leads.length,
        qrCodeCount: booth.qrCodes.length,
      },
    });
  }),
);

// ── POST /api/events/:eventId/booths ──────
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const data = createBoothSchema.parse(req.body);

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "Event not found");
    }

    const booth = await prisma.booth.create({
      data: {
        ...data,
        eventId,
      },
    });

    res.status(201).json({ booth });
  }),
);

// ── PUT /api/events/:eventId/booths/:boothId ──
router.put(
  "/:boothId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId } = req.params;
    const updateData = updateBoothSchema.parse(req.body);

    // Verify booth exists and belongs to event
    const booth = await prisma.booth.findFirst({
      where: { id: boothId, eventId },
    });

    if (!booth) {
      throw new AppError(404, "Booth not found");
    }

    const updated = await prisma.booth.update({
      where: { id: boothId },
      data: updateData,
    });

    res.json({ booth: updated });
  }),
);

// ── DELETE /api/events/:eventId/booths/:boothId ──
router.delete(
  "/:boothId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId } = req.params;

    // Verify booth exists and belongs to event
    const booth = await prisma.booth.findFirst({
      where: { id: boothId, eventId },
    });

    if (!booth) {
      throw new AppError(404, "Booth not found");
    }

    await prisma.booth.delete({ where: { id: boothId } });

    res.json({ message: "Booth deleted successfully", boothId });
  }),
);

// ── POST /api/events/:eventId/booths/:boothId/activate ──
router.post(
  "/:boothId/activate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId } = req.params;

    const booth = await prisma.booth.findFirst({
      where: { id: boothId, eventId },
    });

    if (!booth) {
      throw new AppError(404, "Booth not found");
    }

    const updated = await prisma.booth.update({
      where: { id: boothId },
      data: { isActive: true },
    });

    res.json({ booth: updated, message: "Booth activated" });
  }),
);

// ── POST /api/events/:eventId/booths/:boothId/deactivate ──
router.post(
  "/:boothId/deactivate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, boothId } = req.params;

    const booth = await prisma.booth.findFirst({
      where: { id: boothId, eventId },
    });

    if (!booth) {
      throw new AppError(404, "Booth not found");
    }

    const updated = await prisma.booth.update({
      where: { id: boothId },
      data: { isActive: false },
    });

    res.json({ booth: updated, message: "Booth deactivated" });
  }),
);

// ── Nested Routes ──────────────────────────
// QR codes nested under booths
router.use("/:boothId/qr", qrCodeRouter);

export { router as boothRouter };
