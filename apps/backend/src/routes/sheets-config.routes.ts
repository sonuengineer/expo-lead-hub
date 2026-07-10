import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";

const router = Router({ mergeParams: true });

// ── Validation Schemas ────────────────────
const createSheetsConfigSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  worksheetName: z.string().min(1, "Worksheet name is required"),
  columnMapping: z.record(z.string()),
  serviceAccountCredentials: z.object({}).passthrough().optional(),
});

const updateSheetsConfigSchema = createSheetsConfigSchema.partial();

// All Sheets routes require authentication and ADMIN+ role
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN"));

// ── GET /api/events/:eventId/sheets-config ──────
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "Event not found");
    }

    const config = await prisma.googleSheetsConfig.findUnique({
      where: { eventId },
      select: {
        id: true,
        spreadsheetId: true,
        worksheetName: true,
        columnMapping: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ config });
  }),
);

// ── POST /api/events/:eventId/sheets-config ──────
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const data = createSheetsConfigSchema.parse(req.body);

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "Event not found");
    }

    // Check if config already exists
    const existing = await prisma.googleSheetsConfig.findUnique({
      where: { eventId },
    });

    if (existing) {
      throw new AppError(409, "Google Sheets configuration already exists for this event");
    }

    const config = await prisma.googleSheetsConfig.create({
      data: {
        eventId,
        ...data,
      },
      select: {
        id: true,
        spreadsheetId: true,
        worksheetName: true,
        columnMapping: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({ config });
  }),
);

// ── PUT /api/events/:eventId/sheets-config ──────
router.put(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const updateData = updateSheetsConfigSchema.parse(req.body);

    // Verify config exists
    const config = await prisma.googleSheetsConfig.findUnique({
      where: { eventId },
    });

    if (!config) {
      throw new AppError(404, "Google Sheets configuration not found");
    }

    const updated = await prisma.googleSheetsConfig.update({
      where: { eventId },
      data: updateData,
      select: {
        id: true,
        spreadsheetId: true,
        worksheetName: true,
        columnMapping: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({ config: updated });
  }),
);

// ── DELETE /api/events/:eventId/sheets-config ──────
router.delete(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;

    const config = await prisma.googleSheetsConfig.findUnique({
      where: { eventId },
    });

    if (!config) {
      throw new AppError(404, "Google Sheets configuration not found");
    }

    await prisma.googleSheetsConfig.delete({ where: { eventId } });

    res.json({ message: "Google Sheets configuration deleted" });
  }),
);

// ── Activate/Deactivate ────────────────────
router.post(
  "/activate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;

    const config = await prisma.googleSheetsConfig.findUnique({
      where: { eventId },
    });

    if (!config) {
      throw new AppError(404, "Google Sheets configuration not found");
    }

    const updated = await prisma.googleSheetsConfig.update({
      where: { eventId },
      data: { isActive: true },
    });

    res.json({ config: updated, message: "Google Sheets sync activated" });
  }),
);

router.post(
  "/deactivate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;

    const config = await prisma.googleSheetsConfig.findUnique({
      where: { eventId },
    });

    if (!config) {
      throw new AppError(404, "Google Sheets configuration not found");
    }

    const updated = await prisma.googleSheetsConfig.update({
      where: { eventId },
      data: { isActive: false },
    });

    res.json({ config: updated, message: "Google Sheets sync deactivated" });
  }),
);

export { router as sheetsConfigRouter };
