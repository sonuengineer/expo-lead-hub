import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { AppError } from "../middleware/error-handler";
import type { PageCapture } from "./page-analyzer.service";

export interface RoastResult {
  roast: {
    intro: string;
    ui: string;
    ux: string;
    branding: string;
    cta: string;
    color: string;
    typography: string;
    mobile: string;
  };
  audit: {
    overallScore: number;
    uiScore: number;
    uxScore: number;
    conversionScore: number;
    sections: Array<{
      key: string;
      score: number;
      problem: string;
      impact: string;
      recommendation: string;
      priority: string;
      improvement: string;
    }>;
  };
  suggestions: {
    heroHeadline: string;
    cta: string;
    colorPalette: string[];
    typography: string;
    trustElements: string[];
    missingSections: string[];
    conversion: string[];
    mobile: string[];
  };
}

function toInlineData(dataUrl?: string) {
  if (!dataUrl) return null;
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { inlineData: { mimeType: m[1]!, data: m[2]! } };
}

const SYSTEM_PROMPT = `You are a witty but PROFESSIONAL website critic at a tech exhibition booth.
You will receive a website's screenshot, its title/meta description, and real Lighthouse scores.

Produce a JSON object with three parts:

1. "roast" — a light-hearted, funny-but-RESPECTFUL roast of the site's design. Playful teasing only.
   ABSOLUTELY NO profanity, slurs, insults about people, or offensive/abusive language. Keep it fun and kind.
   Fields: intro, ui, ux, branding, cta, color, typography, mobile (each 1-2 punchy sentences).

2. "audit" — a professional assessment. Fields:
   overallScore, uiScore, uxScore, conversionScore (integers 0-100),
   sections: an array of objects for these keys: "UI", "UX", "Conversion" (assess visually) —
   each { key, score (0-100), problem, impact (business impact), recommendation, priority ("High"|"Medium"|"Low"), improvement (estimated gain) }.

3. "suggestions" — concrete improvements. Fields:
   heroHeadline (a stronger headline), cta (better call-to-action text), colorPalette (array of 4-6 hex colors),
   typography (font pairing recommendation), trustElements (array), missingSections (array),
   conversion (array of tips), mobile (array of tips).

Return ONLY valid JSON, no markdown, no commentary.`;

export async function generateRoast(capture: PageCapture): Promise<RoastResult> {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, "AI is not configured. Set GEMINI_API_KEY to enable website roasts.");
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0.9, maxOutputTokens: 4096 },
  });

  const context = `Website: ${capture.finalUrl}
Title: ${capture.title ?? "(none)"}
Meta description: ${capture.description ?? "(none)"}
Lighthouse scores (0-100): Performance ${capture.scores.performance ?? "n/a"}, SEO ${capture.scores.seo ?? "n/a"}, Accessibility ${capture.scores.accessibility ?? "n/a"}, Best Practices ${capture.scores.bestPractices ?? "n/a"}`;

  const parts: any[] = [{ text: `${SYSTEM_PROMPT}\n\n${context}` }];
  const shot = toInlineData(capture.mobileShot) || toInlineData(capture.desktopShot);
  if (shot) parts.push(shot);

  let text: string;
  try {
    const result = await model.generateContent(parts);
    text = result.response.text();
  } catch (err: any) {
    throw new AppError(502, `AI request failed: ${err?.message ?? "unknown error"}`);
  }

  let parsed: RoastResult;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
  } catch {
    throw new AppError(502, "AI returned an unexpected response. Please try again.");
  }

  return parsed;
}
