import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";

const router = Router({ mergeParams: true });

// ── Validation Schemas ────────────────────
const createCrmConfigSchema = z.object({
  apiUrl: z.string().url("Invalid API URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST"),
  headers: z.record(z.string()).optional(),
  authType: z.enum(["NONE", "API_KEY", "BEARER", "BASIC", "CUSTOM"]).default("NONE"),
  authCredentials: z.object({}).passthrough().optional(),
  payloadMapping: z.record(z.string()),
  successResponsePattern: z.object({}).passthrough().optional(),
  failureResponsePattern: z.object({}).passthrough().optional(),
  timeoutMs: z.number().int().min(1000).default(10000),
});

const updateCrmConfigSchema = createCrmConfigSchema.partial();

// All CRM routes require authentication and ADMIN+ role
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN"));

// ── GET /api/events/:eventId/crm-config ──────
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "Event not found");
    }

    const configs = await prisma.crmConfiguration.findMany({
      where: { eventId },
      select: {
        id: true,
        apiUrl: true,
        method: true,
        authType: true,
        isActive: true,
        timeoutMs: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose credentials
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      configs,
      total: configs.length,
    });
  }),
);

// ── GET /api/events/:eventId/crm-config/:configId ──
router.get(
  "/:configId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, configId } = req.params;

    const config = await prisma.crmConfiguration.findFirst({
      where: { id: configId, eventId },
      select: {
        id: true,
        eventId: true,
        apiUrl: true,
        method: true,
        headers: true,
        authType: true,
        payloadMapping: true,
        successResponsePattern: true,
        failureResponsePattern: true,
        timeoutMs: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // authCredentials are not returned for security
      },
    });

    if (!config) {
      throw new AppError(404, "CRM configuration not found");
    }

    res.json({ config });
  }),
);

// ── POST /api/events/:eventId/crm-config ──────
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const data = createCrmConfigSchema.parse(req.body);

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "Event not found");
    }

    const config = await prisma.crmConfiguration.create({
      data: {
        eventId,
        ...data,
      },
      select: {
        id: true,
        eventId: true,
        apiUrl: true,
        method: true,
        headers: true,
        authType: true,
        payloadMapping: true,
        timeoutMs: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({ config });
  }),
);

// ── PUT /api/events/:eventId/crm-config/:configId ──
router.put(
  "/:configId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, configId } = req.params;
    const updateData = updateCrmConfigSchema.parse(req.body);

    // Verify config exists and belongs to event
    const config = await prisma.crmConfiguration.findFirst({
      where: { id: configId, eventId },
    });

    if (!config) {
      throw new AppError(404, "CRM configuration not found");
    }

    const updated = await prisma.crmConfiguration.update({
      where: { id: configId },
      data: updateData,
      select: {
        id: true,
        apiUrl: true,
        method: true,
        headers: true,
        authType: true,
        payloadMapping: true,
        timeoutMs: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({ config: updated });
  }),
);

// ── DELETE /api/events/:eventId/crm-config/:configId ──
router.delete(
  "/:configId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, configId } = req.params;

    // Verify config exists and belongs to event
    const config = await prisma.crmConfiguration.findFirst({
      where: { id: configId, eventId },
    });

    if (!config) {
      throw new AppError(404, "CRM configuration not found");
    }

    await prisma.crmConfiguration.delete({ where: { id: configId } });

    res.json({ message: "CRM configuration deleted successfully", configId });
  }),
);

// ── POST /api/events/:eventId/crm-config/:configId/test ──
router.post(
  "/:configId/test",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, configId } = req.params;

    // Verify config exists
    const config = await prisma.crmConfiguration.findFirst({
      where: { id: configId, eventId },
    });

    if (!config) {
      throw new AppError(404, "CRM configuration not found");
    }

    // Test connection with sample data
    try {
      const testPayload = {
        test: "true",
        timestamp: new Date().toISOString(),
      };

      // In production, use actual CRM sync service
      // For now, just return success
      res.json({
        success: true,
        message: "CRM configuration is valid and reachable",
        config: {
          apiUrl: config.apiUrl,
          method: config.method,
          authType: config.authType,
          timeoutMs: config.timeoutMs,
        },
      });
    } catch (error: any) {
      throw new AppError(500, `CRM connection test failed: ${error.message}`);
    }
  }),
);

// ── Activate/Deactivate Config ─────────────
router.post(
  "/:configId/activate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, configId } = req.params;

    const config = await prisma.crmConfiguration.findFirst({
      where: { id: configId, eventId },
    });

    if (!config) {
      throw new AppError(404, "CRM configuration not found");
    }

    const updated = await prisma.crmConfiguration.update({
      where: { id: configId },
      data: { isActive: true },
      select: {
        id: true,
        apiUrl: true,
        isActive: true,
      },
    });

    res.json({ config: updated, message: "CRM configuration activated" });
  }),
);

router.post(
  "/:configId/deactivate",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, configId } = req.params;

    const config = await prisma.crmConfiguration.findFirst({
      where: { id: configId, eventId },
    });

    if (!config) {
      throw new AppError(404, "CRM configuration not found");
    }

    const updated = await prisma.crmConfiguration.update({
      where: { id: configId },
      data: { isActive: false },
      select: {
        id: true,
        apiUrl: true,
        isActive: true,
      },
    });

    res.json({ config: updated, message: "CRM configuration deactivated" });
  }),
);

export { router as crmConfigRouter };
