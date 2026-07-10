import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";
import { getPageAnalyzer, normalizeUrl } from "../services/page-analyzer.service";
import { generateRoast } from "../services/ai-roast.service";

const router = Router();

const roastSchema = z.object({
  url: z.string().min(3, "Enter a website URL"),
  eventId: z.string().uuid().optional(),
  boothId: z.string().uuid().optional(),
});

const leadSchema = z.object({
  eventId: z.string().uuid().optional(),
  boothId: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  company: z.string().optional(),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  designation: z.string().optional(),
  consent: z.boolean().optional(),
});

// ── POST /api/ai/roast — analyze + roast (staff/booth) ──
router.post(
  "/roast",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { url, eventId, boothId } = roastSchema.parse(req.body);
    const target = normalizeUrl(url);

    const capture = await getPageAnalyzer().analyze(target);
    const ai = await generateRoast(capture);

    const analysis = await prisma.websiteAnalysis.create({
      data: {
        url: capture.finalUrl,
        title: capture.title ?? null,
        description: capture.description ?? null,
        desktopShot: capture.desktopShot ?? null,
        mobileShot: capture.mobileShot ?? null,
        roast: ai.roast as any,
        audit: { ...ai.audit, lighthouse: capture.scores } as any,
        suggestions: ai.suggestions as any,
        status: "COMPLETED",
        eventId: eventId ?? null,
        boothId: boothId ?? null,
        createdBy: req.user?.id ?? null,
      },
    });

    res.status(201).json({ analysis });
  }),
);

// ── GET /api/ai/analysis/:id — public report (QR target) ──
router.get(
  "/analysis/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const analysis = await prisma.websiteAnalysis.findUnique({ where: { id } });
    if (!analysis) throw new AppError(404, "Report not found");
    res.json({ analysis });
  }),
);

// ── POST /api/ai/analysis/:id/lead — capture visitor as a lead ──
router.post(
  "/analysis/:id/lead",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const data = leadSchema.parse(req.body);

    const analysis = await prisma.websiteAnalysis.findUnique({ where: { id } });
    if (!analysis) throw new AppError(404, "Analysis not found");

    const evId = data.eventId ?? analysis.eventId;
    const bId = data.boothId ?? analysis.boothId;
    if (!evId || !bId) throw new AppError(400, "Event and booth are required to save the lead");

    const [visitorType, form] = await Promise.all([
      prisma.visitorType.findFirst({ where: { eventId: evId, isActive: true }, orderBy: { displayOrder: "asc" } }),
      prisma.formDefinition.findFirst({ where: { eventId: evId, isActive: true } }),
    ]);
    if (!visitorType || !form) {
      throw new AppError(400, "This event has no active visitor type / form configured.");
    }

    const lead = await prisma.lead.create({
      data: {
        eventId: evId,
        boothId: bId,
        visitorTypeId: visitorType.id,
        formDefinitionId: form.id,
        source: "MANUAL",
        submittedBy: req.user?.id ?? null,
        rawFormData: {
          contact_person: data.name,
          company_name: data.company ?? "",
          email: data.email,
          mobile_number: data.phone ?? "",
          designation: data.designation ?? "",
          _source: "AI_ROAST",
          _website: analysis.url,
          _analysisId: analysis.id,
          _consent: data.consent ?? false,
        } as any,
        status: "NEW",
      },
    });

    await Promise.all([
      prisma.syncQueue.create({ data: { leadId: lead.id, target: "CRM", status: "PENDING" } }),
      prisma.syncQueue.create({ data: { leadId: lead.id, target: "GOOGLE_SHEETS", status: "PENDING" } }),
      prisma.websiteAnalysis.update({
        where: { id },
        data: { leadId: lead.id, eventId: evId, boothId: bId },
      }),
    ]);

    res.status(201).json({ lead, message: "Lead saved" });
  }),
);

// ── GET /api/ai/history — recent analyses (staff/admin) ──
router.get(
  "/history",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { skip = "0", take = "20" } = req.query as any;
    const [items, total] = await Promise.all([
      prisma.websiteAnalysis.findMany({
        select: {
          id: true,
          url: true,
          title: true,
          audit: true,
          leadId: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: parseInt(skip) || 0,
        take: Math.min(parseInt(take) || 20, 100),
      }),
      prisma.websiteAnalysis.count(),
    ]);
    res.json({ items, total });
  }),
);

export { router as aiRouter };
