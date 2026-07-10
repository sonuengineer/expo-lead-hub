import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@elc/db";
import { env } from "../config/env";
import { authenticate, AuthUser, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// ── Validation Schemas ────────────────────
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF"]).default("STAFF"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Invalid password"),
});

// ── Helper: Generate JWT tokens ────────────
function generateTokens(user: AuthUser) {
  const accessToken = jwt.sign(user, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY },
  );

  return { accessToken, refreshToken };
}

// ── Register ────────────────────────────────
router.post("/register", asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name, role } = registerSchema.parse(req.body);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError(409, "Email already registered");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: role as any,
    },
  });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const { accessToken, refreshToken } = generateTokens(authUser);

  res.status(201).json({
    user: authUser,
    accessToken,
    refreshToken,
  });
}));

// ── Login ────────────────────────────────
router.post("/login", asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    throw new AppError(403, "User account is inactive");
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const { accessToken, refreshToken } = generateTokens(authUser);

  res.json({
    user: authUser,
    accessToken,
    refreshToken,
  });
}));

// ── Refresh Token ────────────────────────
router.post("/refresh", asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError(400, "Refresh token required");
  }

  const payload = jwt.verify(refreshToken, env.JWT_SECRET) as {
    id: string;
    email: string;
  };

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, "User not found or inactive");
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const { accessToken, refreshToken: newRefreshToken } =
    generateTokens(authUser);

  res.json({
    user: authUser,
    accessToken,
    refreshToken: newRefreshToken,
  });
}));

// ── Get Current User ────────────────────────
router.get("/me", authenticate, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// ── Logout ────────────────────────────────
router.post("/logout", authenticate, (req: Request, res: Response) => {
  // Token invalidation should be handled client-side by removing the token
  // For production, consider token blacklist implementation
  res.json({ message: "Logged out successfully" });
});

export { router as authRouter };
