import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";

const router = Router({ mergeParams: true });

// ── Validation Schemas ────────────────────
const createVisitorTypeSchema = z.object({
  name: z.string().min(1, "Visitor type name is required"),
  slug: z.string().min(1, "Slug is required"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format (use hex)").optional(),
  // Which side of the stall this QR/type is for (agencies vs end users).
  audience: z.enum(["AGENCY", "END_USER", "GENERAL"]).optional(),
});

const updateVisitorTypeSchema = createVisitorTypeSchema.partial();

const reorderSchema = z.object({
  visitorTypeIds: z.array(z.string().uuid("Invalid visitor type ID")),
});

// All visitor type routes require authentication and ADMIN+ role
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN"));

// ── GET /api/events/:eventId/visitor-types ──────
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "Event not found");
    }

    const visitorTypes = await prisma.visitorType.findMany({
      where: { eventId },
      include: {
        leads: { select: { id: true } },
        qrCodes: { select: { id: true } },
      },
      orderBy: { displayOrder: "asc" },
    });

    res.json({
      visitorTypes: visitorTypes.map((vt) => ({
        ...vt,
        leadCount: vt.leads.length,
        qrCodeCount: vt.qrCodes.length,
      })),
      total: visitorTypes.length,
    });
  }),
);

// ── GET /api/events/:eventId/visitor-types/:visitorTypeId ──
router.get(
  "/:visitorTypeId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, visitorTypeId } = req.params;

    const visitorType = await prisma.visitorType.findFirst({
      where: { id: visitorTypeId, eventId },
      include: {
        event: { select: { id: true, name: true } },
        leads: { select: { id: true } },
        qrCodes: { select: { id: true } },
      },
    });

    if (!visitorType) {
      throw new AppError(404, "Visitor type not found");
    }

    res.json({
      visitorType: {
        ...visitorType,
        leadCount: visitorType.leads.length,
        qrCodeCount: visitorType.qrCodes.length,
      },
    });
  }),
);

// ── POST /api/events/:eventId/visitor-types ──────
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const data = createVisitorTypeSchema.parse(req.body);

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "Event not found");
    }

    // Check slug uniqueness
    const existing = await prisma.visitorType.findFirst({
      where: { eventId, slug: data.slug },
    });

    if (existing) {
      throw new AppError(409, "A visitor type with this slug already exists for this event");
    }

    // Get next display order
    const maxDisplayOrder = await prisma.visitorType.aggregate({
      where: { eventId },
      _max: { displayOrder: true },
    });

    const visitorType = await prisma.visitorType.create({
      data: {
        ...data,
        eventId,
        displayOrder: (maxDisplayOrder._max.displayOrder ?? -1) + 1,
      },
    });

    res.status(201).json({ visitorType });
  }),
);

// ── PUT /api/events/:eventId/visitor-types/:visitorTypeId ──
router.put(
  "/:visitorTypeId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, visitorTypeId } = req.params;
    const updateData = updateVisitorTypeSchema.parse(req.body);

    // Verify visitor type exists and belongs to event
    const visitorType = await prisma.visitorType.findFirst({
      where: { id: visitorTypeId, eventId },
    });

    if (!visitorType) {
      throw new AppError(404, "Visitor type not found");
    }

    // Check slug uniqueness if updated
    if (updateData.slug && updateData.slug !== visitorType.slug) {
      const existing = await prisma.visitorType.findFirst({
        where: { eventId, slug: updateData.slug },
      });

      if (existing) {
        throw new AppError(409, "A visitor type with this slug already exists for this event");
      }
    }

    const updated = await prisma.visitorType.update({
      where: { id: visitorTypeId },
      data: updateData,
    });

    res.json({ visitorType: updated });
  }),
);

// ── DELETE /api/events/:eventId/visitor-types/:visitorTypeId ──
router.delete(
  "/:visitorTypeId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, visitorTypeId } = req.params;

    // Verify visitor type exists and belongs to event
    const visitorType = await prisma.visitorType.findFirst({
      where: { id: visitorTypeId, eventId },
    });

    if (!visitorType) {
      throw new AppError(404, "Visitor type not found");
    }

    await prisma.visitorType.delete({ where: { id: visitorTypeId } });

    res.json({ message: "Visitor type deleted successfully", visitorTypeId });
  }),
);

// ── POST /api/events/:eventId/visitor-types/reorder ──
router.post(
  "/reorder",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const { visitorTypeIds } = reorderSchema.parse(req.body);

    // Verify all visitor types belong to the event
    const visitorTypes = await prisma.visitorType.findMany({
      where: { eventId, id: { in: visitorTypeIds } },
    });

    if (visitorTypes.length !== visitorTypeIds.length) {
      throw new AppError(400, "Some visitor types not found or don't belong to this event");
    }

    // Update display order for all visitor types
    const updated = await Promise.all(
      visitorTypeIds.map((id, index) =>
        prisma.visitorType.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    res.json({ visitorTypes: updated, message: "Visitor types reordered successfully" });
  }),
);

// ── POST /api/events/:eventId/visitor-types/:visitorTypeId/activate ──
router.post(
  "/:visitorTypeId/activate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, visitorTypeId } = req.params;

    const visitorType = await prisma.visitorType.findFirst({
      where: { id: visitorTypeId, eventId },
    });

    if (!visitorType) {
      throw new AppError(404, "Visitor type not found");
    }

    const updated = await prisma.visitorType.update({
      where: { id: visitorTypeId },
      data: { isActive: true },
    });

    res.json({ visitorType: updated, message: "Visitor type activated" });
  }),
);

// ── POST /api/events/:eventId/visitor-types/:visitorTypeId/deactivate ──
router.post(
  "/:visitorTypeId/deactivate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, visitorTypeId } = req.params;

    const visitorType = await prisma.visitorType.findFirst({
      where: { id: visitorTypeId, eventId },
    });

    if (!visitorType) {
      throw new AppError(404, "Visitor type not found");
    }

    const updated = await prisma.visitorType.update({
      where: { id: visitorTypeId },
      data: { isActive: false },
    });

    res.json({ visitorType: updated, message: "Visitor type deactivated" });
  }),
);

export { router as visitorTypeRouter };
