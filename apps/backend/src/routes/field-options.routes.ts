import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";

const router = Router({ mergeParams: true });

// ── Validation Schemas ────────────────────
const createFieldOptionSchema = z.object({
  label: z.string().min(1, "Label is required"),
  value: z.string().min(1, "Value is required"),
  isDefault: z.boolean().default(false),
});

const updateFieldOptionSchema = createFieldOptionSchema.partial();

const reorderOptionsSchema = z.object({
  optionIds: z.array(z.string().uuid("Invalid option ID")),
});

// All field option routes require authentication and ADMIN+ role
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN"));

// ── GET /api/events/:eventId/forms/:formId/fields/:fieldId/options ──────
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, formId, fieldId } = req.params;

    // Verify field exists and belongs to form/event
    const field = await prisma.formField.findFirst({
      where: { id: fieldId, formDefinitionId: formId },
      include: { formDefinition: { select: { eventId: true } } },
    });

    if (!field || field.formDefinition.eventId !== eventId) {
      throw new AppError(404, "Field not found");
    }

    const options = await prisma.fieldOption.findMany({
      where: { formFieldId: fieldId },
      orderBy: { displayOrder: "asc" },
    });

    res.json({
      options,
      total: options.length,
    });
  }),
);

// ── GET /api/events/:eventId/forms/:formId/fields/:fieldId/options/:optionId ──
router.get(
  "/:optionId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, formId, fieldId, optionId } = req.params;

    // Verify option exists and belongs to field
    const option = await prisma.fieldOption.findFirst({
      where: { id: optionId, formFieldId: fieldId },
      include: {
        formField: {
          include: { formDefinition: { select: { eventId: true } } },
        },
      },
    });

    if (!option || option.formField.formDefinition.eventId !== eventId) {
      throw new AppError(404, "Option not found");
    }

    res.json({ option });
  }),
);

// ── POST /api/events/:eventId/forms/:formId/fields/:fieldId/options ──────
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, formId, fieldId } = req.params;
    const data = createFieldOptionSchema.parse(req.body);

    // Verify field exists and belongs to form/event
    const field = await prisma.formField.findFirst({
      where: { id: fieldId, formDefinitionId: formId },
      include: { formDefinition: { select: { eventId: true } } },
    });

    if (!field || field.formDefinition.eventId !== eventId) {
      throw new AppError(404, "Field not found");
    }

    // Get next display order
    const maxDisplayOrder = await prisma.fieldOption.aggregate({
      where: { formFieldId: fieldId },
      _max: { displayOrder: true },
    });

    const option = await prisma.fieldOption.create({
      data: {
        ...data,
        formFieldId: fieldId,
        displayOrder: (maxDisplayOrder._max.displayOrder ?? -1) + 1,
      },
    });

    res.status(201).json({ option });
  }),
);

// ── PUT /api/events/:eventId/forms/:formId/fields/:fieldId/options/:optionId ──
router.put(
  "/:optionId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, formId, fieldId, optionId } = req.params;
    const updateData = updateFieldOptionSchema.parse(req.body);

    // Verify option exists and belongs to field
    const option = await prisma.fieldOption.findFirst({
      where: { id: optionId, formFieldId: fieldId },
      include: {
        formField: {
          include: { formDefinition: { select: { eventId: true } } },
        },
      },
    });

    if (!option || option.formField.formDefinition.eventId !== eventId) {
      throw new AppError(404, "Option not found");
    }

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      await prisma.fieldOption.updateMany({
        where: { formFieldId: fieldId, id: { not: optionId } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.fieldOption.update({
      where: { id: optionId },
      data: updateData,
    });

    res.json({ option: updated });
  }),
);

// ── DELETE /api/events/:eventId/forms/:formId/fields/:fieldId/options/:optionId ──
router.delete(
  "/:optionId",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, formId, fieldId, optionId } = req.params;

    // Verify option exists and belongs to field
    const option = await prisma.fieldOption.findFirst({
      where: { id: optionId, formFieldId: fieldId },
      include: {
        formField: {
          include: { formDefinition: { select: { eventId: true } } },
        },
      },
    });

    if (!option || option.formField.formDefinition.eventId !== eventId) {
      throw new AppError(404, "Option not found");
    }

    await prisma.fieldOption.delete({ where: { id: optionId } });

    res.json({ message: "Option deleted successfully", optionId });
  }),
);

// ── POST /api/events/:eventId/forms/:formId/fields/:fieldId/options/reorder ──
router.post(
  "/reorder",
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId, formId, fieldId } = req.params;
    const { optionIds } = reorderOptionsSchema.parse(req.body);

    // Verify all options belong to the field
    const options = await prisma.fieldOption.findMany({
      where: { formFieldId: fieldId, id: { in: optionIds } },
    });

    if (options.length !== optionIds.length) {
      throw new AppError(400, "Some options not found or don't belong to this field");
    }

    // Update display order for all options
    const updated = await Promise.all(
      optionIds.map((id, index) =>
        prisma.fieldOption.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    res.json({ options: updated, message: "Options reordered successfully" });
  }),
);

export { router as fieldOptionRouter };
