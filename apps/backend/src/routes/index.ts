import { Router } from "express";
import { authRouter } from "./auth.routes";
import { usersRouter } from "./users.routes";
import { eventRouter } from "./events.routes";
import { dashboardRouter } from "./dashboard.routes";
import { leadsRouter } from "./leads.routes";
import { auditLogsRouter } from "./audit-logs.routes";
import { ocrRouter } from "./ocr.routes";
import { syncQueueRouter } from "./sync-queue.routes";
import { aiRouter } from "./ai.routes";
import { publicRouter } from "./public.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/events", eventRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/leads", leadsRouter);
apiRouter.use("/audit-logs", auditLogsRouter);
apiRouter.use("/ocr", ocrRouter);
apiRouter.use("/sync-queue", syncQueueRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/public", publicRouter);

export { apiRouter };
