/**
 * Abstract OCR Service Interface
 * Implementations: GoogleVisionOcr, TesseractOcr
 */

export interface OcrResult {
  rawText: string;
  confidence: number;
  parsedData: {
    companyName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    designation?: string;
  };
}

export interface OcrService {
  extractText(imageBuffer: Buffer, mimeType: string): Promise<OcrResult>;
  isAvailable(): Promise<boolean>;
}

// ── Google Vision OCR Implementation ──────────────
import { ImageAnnotatorClient } from "@google-cloud/vision";

export class GoogleVisionOcr implements OcrService {
  private client: ImageAnnotatorClient;
  private isConfigured: boolean;

  constructor() {
    try {
      this.client = new ImageAnnotatorClient();
      this.isConfigured = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } catch (error) {
      this.isConfigured = false;
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.isConfigured;
  }

  async extractText(imageBuffer: Buffer, _mimeType: string): Promise<OcrResult> {
    if (!this.isConfigured) {
      throw new Error("Google Vision API not configured");
    }

    try {
      const request = {
        image: { content: imageBuffer.toString("base64") },
      };

      const [result] = await this.client.textDetection(request);
      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        return {
          rawText: "",
          confidence: 0,
          parsedData: {},
        };
      }

      const rawText = detections[0].description || "";
      const confidence = this.calculateConfidence(detections);

      return {
        rawText,
        confidence,
        parsedData: this.parseBusinessCard(rawText),
      };
    } catch (error) {
      console.error("Google Vision OCR error:", error);
      throw error;
    }
  }

  private calculateConfidence(detections: any[]): number {
    if (detections.length === 0) return 0;
    // Average confidence from all detected text blocks
    const confidences = detections
      .slice(1)
      .map((d: any) => d.confidence || 0.8)
      .slice(0, 10);
    return confidences.reduce((a, b) => a + b, 0) / Math.max(confidences.length, 1);
  }

  private parseBusinessCard(text: string): OcrResult["parsedData"] {
    return parseBusinessCardText(text);
  }
}

// ── Tesseract.js OCR Implementation ──────────────
import Tesseract from "tesseract.js";

export class TesseractOcr implements OcrService {
  async isAvailable(): Promise<boolean> {
    // Tesseract is always available if the library is installed
    return true;
  }

  async extractText(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
    try {
      // Convert buffer to base64 data URL
      const base64 = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

      const result = await Tesseract.recognize(base64, "eng", {
        logger: () => {}, // Suppress logger output
      });

      const rawText = result.data.text || "";
      const confidence = (result.data.confidence || 0) / 100;

      return {
        rawText,
        confidence,
        parsedData: this.parseBusinessCard(rawText),
      };
    } catch (error) {
      console.error("Tesseract OCR error:", error);
      throw error;
    }
  }

  private parseBusinessCard(text: string): OcrResult["parsedData"] {
    return parseBusinessCardText(text);
  }
}

// ── Text Parsing Engine ──────────────────────────
function parseBusinessCardText(text: string): OcrResult["parsedData"] {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const parsed: OcrResult["parsedData"] = {};

  for (const line of lines) {
    // Email pattern
    if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(line)) {
      parsed.email = line.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)?.[0];
    }

    // Phone pattern
    if (/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/.test(line)) {
      parsed.phone = line.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/)?.[0];
    }

    // Website pattern
    if (/(www\.|https?:\/\/).*\.[a-z]{2,}/.test(line)) {
      parsed.website = line.match(/(www\.|https?:\/\/).*\.[a-z]{2,}/)?.[0];
    }

    // Company name pattern (usually in caps)
    if (/^[A-Z\s]{5,}$/.test(line) && !parsed.companyName) {
      parsed.companyName = line;
    }

    // Designation pattern
    const designations = ["Manager", "Director", "President", "CEO", "Sales", "Engineer", "Developer", "Consultant"];
    if (designations.some((d) => line.includes(d)) && !parsed.designation) {
      parsed.designation = line;
    }
  }

  // Parse name from first few lines
  if (!parsed.firstName && lines.length > 0) {
    const nameParts = lines[0].split(/\s+/);
    if (nameParts.length >= 1) {
      parsed.firstName = nameParts[0];
      if (nameParts.length >= 2) {
        parsed.lastName = nameParts.slice(1).join(" ");
      }
    }
  }

  return parsed;
}

// ── OCR Manager with Fallback ────────────────────
export class OcrManager {
  private googleVision: GoogleVisionOcr;
  private tesseract: TesseractOcr;

  constructor() {
    this.googleVision = new GoogleVisionOcr();
    this.tesseract = new TesseractOcr();
  }

  async extractText(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
    // Try Google Vision first
    if (await this.googleVision.isAvailable()) {
      try {
        return await this.googleVision.extractText(imageBuffer, mimeType);
      } catch (error) {
        console.warn("Google Vision failed, falling back to Tesseract:", error);
      }
    }

    // Fallback to Tesseract
    return this.tesseract.extractText(imageBuffer, mimeType);
  }
}

export const ocrManager = new OcrManager();
