import { Router, Request, Response } from "express";
import { prisma } from "@elc/db";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
router.use(authenticate);

// ── GET /api/dashboard/stats ────────────────────────
// Aggregate KPIs + chart data for the admin dashboard.
router.get(
  "/stats",
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = 14;
    const since = new Date(startOfToday);
    since.setDate(since.getDate() - (days - 1));

    const [
      totalLeads,
      todayLeads,
      activeEvents,
      crmSynced,
      sheetsSynced,
      failedSyncs,
      pendingSyncs,
      statusGroups,
      sourceGroups,
      recentLeads,
      eventsWithCounts,
      visitorTypesWithCounts,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.event.count({ where: { status: "ACTIVE" } }),
      prisma.lead.count({ where: { crmSynced: true } }),
      prisma.lead.count({ where: { sheetsSynced: true } }),
      prisma.syncQueue.count({ where: { status: "FAILED" } }),
      prisma.syncQueue.count({ where: { status: "PENDING" } }),
      prisma.lead.groupBy({ by: ["status"], _count: true }),
      prisma.lead.groupBy({ by: ["source"], _count: true }),
      prisma.lead.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.event.findMany({
        select: { id: true, name: true, _count: { select: { leads: true } } },
        orderBy: { leads: { _count: "desc" } },
        take: 8,
      }),
      prisma.visitorType.findMany({
        select: { id: true, name: true, color: true, _count: { select: { leads: true } } },
        orderBy: { leads: { _count: "desc" } },
        take: 10,
      }),
    ]);

    // Bucket leads into per-day counts for the last `days` days.
    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const lead of recentLeads) {
      const key = lead.createdAt.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const leadsOverTime = Array.from(buckets.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    res.json({
      kpis: {
        totalLeads,
        todayLeads,
        activeEvents,
        crmSynced,
        sheetsSynced,
        failedSyncs,
        pendingSyncs,
      },
      leadsOverTime,
      byStatus: statusGroups.map((g: any) => ({ status: g.status, count: g._count })),
      bySource: sourceGroups.map((g: any) => ({ source: g.source, count: g._count })),
      byEvent: eventsWithCounts.map((e: any) => ({
        id: e.id,
        name: e.name,
        count: e._count.leads,
      })),
      byVisitorType: visitorTypesWithCounts.map((v: any) => ({
        id: v.id,
        name: v.name,
        color: v.color,
        count: v._count.leads,
      })),
    });
  }),
);

export { router as dashboardRouter };
