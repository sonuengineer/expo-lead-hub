import { Request } from "express";
import { prisma } from "@elc/db";

export interface AuditLogData {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(
  req: Request,
  data: Omit<AuditLogData, "ipAddress" | "userAgent">,
) {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get("user-agent");

    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValue: data.oldValue,
        newValue: data.newValue,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
    // Don't throw error - audit logging should not break the request
  }
}

// Middleware to attach logAuditEvent to response locals
export function auditLoggingMiddleware(req: Request, res: any, next: any) {
  res.locals.logAudit = (data: Omit<AuditLogData, "ipAddress" | "userAgent">) =>
    logAuditEvent(req, data);
  next();
}
