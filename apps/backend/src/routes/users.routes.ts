import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@elc/db";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// Apply auth middleware to all routes in this router
router.use(authenticate);

// ── Validation Schemas ────────────────────
const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF"]).default("STAFF"),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
});

// ── Get All Users (SUPER_ADMIN only) ──────
router.get(
  "/",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ users, total: users.length });
  }),
);

// ── Create User (SUPER_ADMIN only) ────────
router.post(
  "/",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, name, role } = createUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError(409, "Email already registered");
    }

    // Generate temporary password (hashed before storage so the user can log in)
    const tempPassword = Math.random().toString(36).slice(-12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role as any,
        passwordHash, // user should reset on first login
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      user,
      tempPassword,
      message: "User created. Share this temporary password with the user.",
    });
  }),
);

// ── Get User by ID (SUPER_ADMIN or self) ──
router.get(
  "/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    // Check permission: only SUPER_ADMIN or the user themselves
    if (req.user?.role !== "SUPER_ADMIN" && req.user?.id !== userId) {
      throw new AppError(403, "Insufficient permissions");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    res.json({ user });
  }),
);

// ── Update User (SUPER_ADMIN only) ────────
router.put(
  "/:userId",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const updates = updateUserSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user });
  }),
);

// ── Deactivate User (SUPER_ADMIN only) ────
router.post(
  "/:userId/deactivate",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    // Prevent deactivating oneself
    if (req.user?.id === userId) {
      throw new AppError(400, "Cannot deactivate your own account");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    res.json({ user, message: "User deactivated" });
  }),
);

// ── Reset User Password (SUPER_ADMIN only) ─
router.post(
  "/:userId/reset-password",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.params.userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "User not found");
    }

    // Generate a new temporary password, hashed before storage.
    const tempPassword = Math.random().toString(36).slice(-12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({
      tempPassword,
      message: "Password reset. Share this new temporary password with the user.",
    });
  }),
);

export { router as usersRouter };
