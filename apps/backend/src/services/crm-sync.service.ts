import axios, { AxiosRequestConfig } from "axios";
import { prisma } from "@elc/db";

export interface CrmSyncRequest {
  leadId: string;
  eventId: string;
  crmConfigId: string;
  formData: Record<string, any>;
}

export interface CrmSyncResponse {
  success: boolean;
  statusCode: number;
  response: any;
  duration: number;
}

export class CrmSyncService {
  async syncLeadToCrm(request: CrmSyncRequest): Promise<CrmSyncResponse> {
    const startTime = Date.now();

    try {
      // Fetch CRM configuration
      const crmConfig = await prisma.crmConfiguration.findUnique({
        where: { id: request.crmConfigId },
      });

      if (!crmConfig || !crmConfig.isActive) {
        throw new Error("CRM configuration not found or inactive");
      }

      // Build request payload
      const payload = this.buildPayload(crmConfig.payloadMapping, request.formData);

      // Build request options
      const requestOptions: AxiosRequestConfig = {
        method: crmConfig.method.toLowerCase() as any,
        url: crmConfig.apiUrl,
        timeout: crmConfig.timeoutMs,
      };

      // Add headers
      if (crmConfig.headers && typeof crmConfig.headers === "object") {
        requestOptions.headers = { ...crmConfig.headers };
      }

      // Add authentication
      this.addAuthentication(requestOptions, crmConfig.authType, crmConfig.authCredentials);

      // Add payload
      if (["post", "put", "patch"].includes(crmConfig.method.toLowerCase())) {
        requestOptions.data = payload;
      } else if (crmConfig.method === "GET") {
        requestOptions.params = payload;
      }

      // Make request
      const response = await axios(requestOptions);

      const duration = Date.now() - startTime;

      // Log sync attempt
      await this.logSyncAttempt(request.leadId, "CRM", "SUCCESS", payload, response.data, response.status, duration);

      return {
        success: true,
        statusCode: response.status,
        response: response.data,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || "Unknown error";

      // Log sync attempt
      await this.logSyncAttempt(request.leadId, "CRM", "FAILURE", request.formData, error.response?.data || null, error.response?.status, duration);

      throw {
        success: false,
        statusCode: error.response?.status || 500,
        response: error.response?.data || errorMessage,
        duration,
      };
    }
  }

  private buildPayload(mapping: any, formData: Record<string, any>): Record<string, any> {
    const payload: Record<string, any> = {};

    if (typeof mapping !== "object" || !mapping) {
      return formData;
    }

    // Map form fields to CRM fields using the mapping
    for (const [crmField, formField] of Object.entries(mapping)) {
      if (typeof formField === "string" && formField in formData) {
        payload[crmField] = formData[formField];
      }
    }

    return payload;
  }

  private addAuthentication(
    requestOptions: AxiosRequestConfig,
    authType: string,
    authCredentials: any,
  ): void {
    if (!requestOptions.headers) {
      requestOptions.headers = {};
    }

    switch (authType) {
      case "API_KEY":
        if (authCredentials?.apiKey) {
          requestOptions.headers["X-API-Key"] = authCredentials.apiKey;
        }
        break;

      case "BEARER":
        if (authCredentials?.token) {
          requestOptions.headers["Authorization"] = `Bearer ${authCredentials.token}`;
        }
        break;

      case "BASIC":
        if (authCredentials?.username && authCredentials?.password) {
          const encodedCredentials = Buffer.from(`${authCredentials.username}:${authCredentials.password}`).toString(
            "base64",
          );
          requestOptions.headers["Authorization"] = `Basic ${encodedCredentials}`;
        }
        break;

      case "CUSTOM":
        if (authCredentials?.headers && typeof authCredentials.headers === "object") {
          Object.assign(requestOptions.headers, authCredentials.headers);
        }
        break;

      case "NONE":
      default:
        break;
    }
  }

  private async logSyncAttempt(
    leadId: string,
    target: "CRM" | "GOOGLE_SHEETS",
    status: "SUCCESS" | "FAILURE",
    requestPayload: any,
    responsePayload: any,
    statusCode: number | undefined,
    durationMs: number,
  ): Promise<void> {
    try {
      await prisma.syncLog.create({
        data: {
          leadId,
          target,
          status,
          requestPayload,
          responsePayload,
          httpStatusCode: statusCode,
          durationMs,
        },
      });
    } catch (error) {
      console.error("Failed to log sync attempt:", error);
    }
  }

  async scheduleRetry(leadId: string, target: "CRM" | "GOOGLE_SHEETS", delayMs: number): Promise<void> {
    const nextRetryAt = new Date(Date.now() + delayMs);

    await prisma.syncQueue.updateMany(
      {
        leadId,
        target,
        status: "FAILED",
      },
      {
        status: "PENDING",
        nextRetryAt,
        attemptCount: { increment: 1 },
      },
    );
  }

  async markSyncComplete(leadId: string, target: "CRM" | "GOOGLE_SHEETS"): Promise<void> {
    await prisma.syncQueue.updateMany(
      {
        leadId,
        target,
      },
      {
        status: "COMPLETED",
      },
    );

    // Update lead status
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { syncQueue: true },
    });

    if (lead) {
      const allComplete = lead.syncQueue.every((sq) => sq.status === "COMPLETED");
      if (allComplete) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "SYNCED" },
        });
      }
    }
  }

  async markSyncFailed(leadId: string, target: "CRM" | "GOOGLE_SHEETS", errorMessage: string): Promise<void> {
    const currentQueue = await prisma.syncQueue.findFirst({
      where: { leadId, target },
    });

    if (!currentQueue) return;

    if ((currentQueue.attemptCount || 0) >= (currentQueue.maxAttempts || 5)) {
      // Max retries reached
      await prisma.syncQueue.updateMany(
        { leadId, target },
        {
          status: "FAILED",
          lastError: errorMessage,
        },
      );

      // Update lead status to failed
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "FAILED" },
      });
    } else {
      // Schedule next retry with exponential backoff
      const retryDelays = [1 * 60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000, 12 * 60 * 60 * 1000];
      const delayMs = retryDelays[currentQueue.attemptCount || 0] || retryDelays[retryDelays.length - 1];

      await this.scheduleRetry(leadId, target, delayMs);

      // Update lead status to retrying
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "RETRYING" },
      });
    }
  }
}

export const crmSyncService = new CrmSyncService();
