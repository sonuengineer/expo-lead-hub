import { Router, Request, Response } from "express";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN"));

// ── GET /api/audit-logs (filterable) ────────────────
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const {
      userId,
      action,
      entityType,
      entityId,
      skip = "0",
      take = "25",
    } = req.query as any;

    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const [logs, total, actions, entityTypes] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: parseInt(skip) || 0,
        take: Math.min(parseInt(take) || 25, 100),
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ distinct: ["action"], select: { action: true } }),
      prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true } }),
    ]);

    res.json({
      logs,
      total,
      skip: parseInt(skip) || 0,
      take: Math.min(parseInt(take) || 25, 100),
      filters: {
        actions: actions.map((a: any) => a.action),
        entityTypes: entityTypes.map((e: any) => e.entityType),
      },
    });
  }),
);

export { router as auditLogsRouter };
