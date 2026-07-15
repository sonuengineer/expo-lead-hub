import axios from "axios";
import { env } from "../config/env";

// Thin client for the OpenWA self-hosted WhatsApp gateway (whatsapp-web.js /
// baileys under the hood). Runs as a separate Docker service; we just POST to
// its REST API. See https://github.com/rmyndharis/OpenWA
export class WhatsAppService {
  private get baseUrl(): string | undefined {
    return env.OPENWA_BASE_URL?.replace(/\/+$/, "");
  }

  private get apiKey(): string | undefined {
    return env.OPENWA_API_KEY;
  }

  // Normalize a phone number into a WhatsApp chat id, e.g. 919876543210@c.us
  toChatId(phone: string): string {
    const digits = phone.replace(/[^\d]/g, "").replace(/^00/, "");
    return `${digits}@c.us`;
  }

  async sendText(sessionId: string, chatId: string, text: string): Promise<void> {
    const base = this.baseUrl;
    const key = this.apiKey;
    if (!base || !key) {
      throw new Error("OpenWA not configured (OPENWA_BASE_URL / OPENWA_API_KEY missing)");
    }

    await axios.post(
      `${base}/api/sessions/${sessionId}/messages/send-text`,
      { chatId, text },
      {
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        timeout: 15_000,
      },
    );
  }

  // List OpenWA sessions (each has id, name, status, phone, pushName).
  async getSessions(): Promise<any[]> {
    const base = this.baseUrl;
    const key = this.apiKey;
    if (!base || !key) return [];
    const { data } = await axios.get(`${base}/api/sessions`, {
      headers: { "X-API-Key": key },
      timeout: 8000,
    });
    return Array.isArray(data) ? data : (data?.sessions ?? []);
  }

  // Resolve which session to send from. Prefer an explicit id; otherwise fall
  // back to the first connected session, then the first session.
  async resolveSessionId(preferred?: string): Promise<string> {
    if (preferred && preferred !== "default") return preferred;
    const sessions = await this.getSessions();
    if (!sessions.length) throw new Error("No OpenWA session available");
    const isConnected = (s: any) =>
      s.status === "ready" || s.status === "authenticated" || s.status === "connected";
    const authed = sessions.find(isConnected);
    return (authed ?? sessions[0]).id;
  }
}

export const whatsAppService = new WhatsAppService();
