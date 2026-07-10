import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation error",
      errors: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // Application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  // Unexpected errors
  console.error("Unexpected error:", err);
  return res.status(500).json({
    message: env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
}
