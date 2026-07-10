import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { auditLoggingMiddleware } from "./utils/audit-logger";
import { apiRouter } from "./routes";

const app = express();

// ── Security ──────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── Body parsing ───────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ────────────────────────────────
if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ── Audit Logging ──────────────────────────
app.use(auditLoggingMiddleware);

// ── Health check ───────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Routes ─────────────────────────────────
app.use("/api", apiRouter);

// ── Error handling ─────────────────────────
app.use(errorHandler);

export { app };
