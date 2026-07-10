import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";
import { crmSyncService } from "../services/crm-sync.service";

const router = Router();

// ── GET /api/sync-queue/status ──────────────────────
router.get(
  "/status",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, skip = 0, take = 20 } = req.query;

    const where = eventId ? { lead: { eventId: eventId as string } } : {};

    const [queueItems, stats] = await Promise.all([
      prisma.syncQueue.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              eventId: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: typeof skip === "string" ? parseInt(skip) : 0,
        take: typeof take === "string" ? parseInt(take) : 20,
      }),
      prisma.syncQueue.groupBy({
        by: ["status", "target"],
        where,
        _count: true,
      }),
    ]);

    res.json({
      queueItems,
      stats,
      total: queueItems.length,
    });
  }),
);

// ── GET /api/sync-queue/pending ────────────────────
router.get(
  "/pending",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();

    const pendingItems = await prisma.syncQueue.findMany({
      where: {
        status: "PENDING",
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      include: {
        lead: {
          select: {
            id: true,
            eventId: true,
            rawFormData: true,
            status: true,
          },
        },
      },
      take: 50, // Process max 50 at a time
    });

    res.json({
      pendingItems,
      total: pendingItems.length,
      message: `${pendingItems.length} items ready for sync`,
    });
  }),
);

// ── POST /api/sync-queue/:queueItemId/retry (Manual retry) ──
router.post(
  "/:queueItemId/retry",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { queueItemId } = req.params;

    const queueItem = await prisma.syncQueue.findUnique({
      where: { id: queueItemId },
      include: { lead: true },
    });

    if (!queueItem) {
      throw new AppError(404, "Sync queue item not found");
    }

    // Update status to pending and reset nextRetryAt
    const updated = await prisma.syncQueue.update({
      where: { id: queueItemId },
      data: {
        status: "PENDING",
        nextRetryAt: new Date(), // Retry immediately
        attemptCount: 0, // Reset for manual retry
      },
      include: { lead: true },
    });

    res.json({
      queueItem: updated,
      message: "Item queued for immediate retry",
    });
  }),
);

// ── GET /api/sync-logs (View sync logs) ────────────────
router.get(
  "/logs",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { leadId, target, status, skip = 0, take = 20 } = req.query;

    const where: any = {};

    if (leadId) where.leadId = leadId;
    if (target) where.target = target;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.syncLog.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              eventId: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: typeof skip === "string" ? parseInt(skip) : 0,
        take: typeof take === "string" ? parseInt(take) : 20,
      }),
      prisma.syncLog.count({ where }),
    ]);

    res.json({
      logs,
      total,
      page: typeof skip === "string" ? Math.floor(parseInt(skip) / (typeof take === "string" ? parseInt(take) : 20)) : 0,
    });
  }),
);

// ── GET /api/sync-logs/:logId ──────────────────────
router.get(
  "/logs/:logId",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { logId } = req.params;

    const log = await prisma.syncLog.findUnique({
      where: { id: logId },
      include: {
        lead: {
          select: {
            id: true,
            eventId: true,
            rawFormData: true,
            status: true,
          },
        },
      },
    });

    if (!log) {
      throw new AppError(404, "Sync log not found");
    }

    res.json({ log });
  }),
);

// ── POST /api/sync-queue/process (Process pending items) ──
// This would typically be called by a cron job, but exposed via API for manual testing
router.post(
  "/process",
  authenticate,
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();

    // Get pending items ready for sync
    const pendingItems = await prisma.syncQueue.findMany({
      where: {
        status: "PENDING",
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      include: {
        lead: {
          include: {
            event: true,
            formDefinition: true,
          },
        },
      },
      take: 50,
    });

    const results = [];

    for (const item of pendingItems) {
      try {
        // Update to processing
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: { status: "PROCESSING" },
        });

        if (item.target === "CRM") {
          // Get CRM config for event
          const crmConfig = await prisma.crmConfiguration.findFirst({
            where: { eventId: item.lead.eventId, isActive: true },
          });

          if (!crmConfig) {
            throw new Error("No active CRM configuration for this event");
          }

          // Sync to CRM
          const syncResult = await crmSyncService.syncLeadToCrm({
            leadId: item.lead.id,
            eventId: item.lead.eventId,
            crmConfigId: crmConfig.id,
            formData: item.lead.rawFormData as Record<string, any>,
          });

          // Mark as completed
          await crmSyncService.markSyncComplete(item.lead.id, "CRM");

          results.push({
            queueItemId: item.id,
            target: "CRM",
            success: syncResult.success,
            statusCode: syncResult.statusCode,
            duration: syncResult.duration,
          });
        }
        // Google Sheets sync would be handled similarly
      } catch (error: any) {
        // Mark as failed with retry
        await crmSyncService.markSyncFailed(
          item.lead.id,
          item.target as "CRM" | "GOOGLE_SHEETS",
          error.message || "Unknown error",
        );

        results.push({
          queueItemId: item.id,
          target: item.target,
          success: false,
          error: error.message || "Unknown error",
        });
      }
    }

    res.json({
      processed: results.length,
      results,
      message: `Processed ${results.length} items from sync queue`,
    });
  }),
);

export { router as syncQueueRouter };
