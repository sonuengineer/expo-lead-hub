import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { AppError } from "../middleware/error-handler";
import type { PageCapture, PageScores } from "./page-analyzer.service";

export interface SiteScore {
  overallScore: number;
  ui: number;
  ux: number;
  seo: number;
  conversion: number;
  summary: string;
  lighthouse?: PageScores;
}

export interface ComparisonResult {
  your: SiteScore;
  competitor: SiteScore;
  verdict: {
    winner: "you" | "competitor" | "tie";
    perCategory: Array<{ key: string; youWin: boolean; note: string }>;
    reasoning: string;
  };
  suggestions: {
    heroHeadline: string;
    cta: string;
    colorPalette: string[];
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

const SYSTEM_PROMPT = `You are a professional website UX & conversion auditor at a tech exhibition booth.
You will receive TWO website screenshots — "YOUR" site (the visitor's) and a "COMPETITOR" site — plus each site's title/meta and real Lighthouse scores when available.

Produce a fair, professional HEAD-TO-HEAD comparison as JSON (no roast, no insults — objective and constructive):

{
  "your":       { "overallScore": int 0-100, "ui": int, "ux": int, "seo": int, "conversion": int, "summary": "1-2 sentence professional assessment" },
  "competitor": { "overallScore": int 0-100, "ui": int, "ux": int, "seo": int, "conversion": int, "summary": "1-2 sentence assessment" },
  "verdict": {
    "winner": "you" | "competitor" | "tie",
    "perCategory": [ { "key": "UI"|"UX"|"SEO"|"Conversion"|"Overall", "youWin": boolean, "note": "short reason" } ],
    "reasoning": "2-3 sentences on who leads overall and why"
  },
  "suggestions": {
    "heroHeadline": "a stronger headline for YOUR site",
    "cta": "a better call-to-action for YOUR site",
    "colorPalette": ["#hex", ...4-6],
    "trustElements": [".."], "missingSections": [".."], "conversion": [".."], "mobile": [".."]
  }
}

Base UI/UX/Conversion on what you SEE in the screenshots. Return ONLY valid JSON.`;

function scoreLine(label: string, cap: PageCapture) {
  return `${label}: ${cap.finalUrl} | title="${cap.title ?? ""}" | Lighthouse Perf ${cap.scores.performance ?? "n/a"}, SEO ${cap.scores.seo ?? "n/a"}, A11y ${cap.scores.accessibility ?? "n/a"}, BestPractices ${cap.scores.bestPractices ?? "n/a"}`;
}

export async function generateComparison(
  you: PageCapture,
  competitor: PageCapture,
): Promise<ComparisonResult> {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, "AI is not configured. Set GEMINI_API_KEY to enable the score game.");
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 4096 },
  });

  const context = `${scoreLine("YOUR SITE", you)}\n${scoreLine("COMPETITOR", competitor)}`;
  const parts: any[] = [{ text: `${SYSTEM_PROMPT}\n\n${context}` }];

  const yourShot = toInlineData(you.mobileShot) || toInlineData(you.desktopShot);
  const compShot = toInlineData(competitor.mobileShot) || toInlineData(competitor.desktopShot);
  if (yourShot) parts.push({ text: "YOUR site screenshot:" }, yourShot);
  if (compShot) parts.push({ text: "COMPETITOR site screenshot:" }, compShot);

  let text: string;
  try {
    const result = await model.generateContent(parts);
    text = result.response.text();
  } catch (err: any) {
    throw new AppError(502, `AI request failed: ${err?.message ?? "unknown error"}`);
  }

  let parsed: ComparisonResult;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
  } catch {
    throw new AppError(502, "AI returned an unexpected response. Please try again.");
  }

  // Merge in the objective Lighthouse scores (real when a PSI key is set).
  parsed.your.lighthouse = you.scores;
  parsed.competitor.lighthouse = competitor.scores;
  return parsed;
}
