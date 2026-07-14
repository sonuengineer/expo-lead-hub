import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { AppError } from "../middleware/error-handler";

// Reliable business-card reading via Gemini vision (replaces flaky Tesseract).
export interface CardFields {
  contactPerson?: string;
  companyName?: string;
  designation?: string;
  mobileNumber?: string;
  email?: string;
  website?: string;
  city?: string;
  address?: string;
}

const PROMPT = `You are reading a photo of a business card. Extract the details EXACTLY as printed.
Return ONLY this JSON (use "" for anything not present):
{
  "contactPerson": "person's full name",
  "companyName": "company / organization",
  "designation": "job title / role",
  "mobileNumber": "primary phone number, digits and + only",
  "email": "email address",
  "website": "website URL",
  "city": "city",
  "address": "full address if present"
}`;

export async function parseCardWithAI(dataUrl: string): Promise<{ parsed: CardFields; rawText: string }> {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, "AI card reading is not configured. Set GEMINI_API_KEY.");
  }
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new AppError(400, "Invalid image data");

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 1024 },
  });

  let text: string;
  try {
    const result = await model.generateContent([
      { text: PROMPT },
      { inlineData: { mimeType: m[1]!, data: m[2]! } },
    ]);
    text = result.response.text();
  } catch (err: any) {
    throw new AppError(502, `Card reading failed: ${err?.message ?? "unknown error"}`);
  }

  let parsed: CardFields;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
  } catch {
    throw new AppError(502, "Could not read the card. Try a clearer, well-lit photo.");
  }
  return { parsed, rawText: text };
}
