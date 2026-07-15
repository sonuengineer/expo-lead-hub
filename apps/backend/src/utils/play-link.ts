import { nanoid } from "nanoid";
import { env } from "../config/env";

// A visitor's "extra link" points at the game selector for their play session.
// The token is stored on the Lead (Lead.playToken) and resolved publicly at
// GET /api/public/play/:token.
export function newPlayToken(): string {
  return nanoid(10);
}

export function appBaseUrl(): string {
  return (env.PUBLIC_APP_URL || env.CORS_ORIGIN.split(",")[0] || "").replace(/\/+$/, "");
}

export function playLink(token: string): string {
  return `${appBaseUrl()}/play/${token}`;
}

// Public AI Score report page (shareable, no auth).
export function reportLink(analysisId: string): string {
  return `${appBaseUrl()}/ai/report/${analysisId}`;
}
