import { withGeminiModel } from "./gemini.service";
import { AppError } from "../middleware/error-handler";
import type { PageCapture, PageScores } from "./page-analyzer.service";

export interface SiteScore {
  overallScore: number;
  ui: number;
  ux: number;
  seo: number;
  conversion: number;
  llmScore: number; // how well an AI/LLM can understand & represent this business
  summary: string;
  lighthouse?: PageScores;
}

export interface ComparisonResult {
  your: SiteScore;
  competitor: SiteScore;
  competitor2?: SiteScore; // optional 2nd competitor (additive)
  verdict: {
    winner: "you" | "competitor" | "competitor2" | "tie";
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

Produce a fair, professional HEAD-TO-HEAD comparison as JSON (no roast, no insults — objective and constructive).

"llmScore" (0-100) = how well an AI assistant / LLM can understand and accurately represent this business from the site: clear value proposition, descriptive text (not just images), structured content, and answers to common buyer questions. A site that is mostly images or vague scores low; a clear, content-rich, well-structured site scores high.

{
  "your":       { "overallScore": int 0-100, "ui": int, "ux": int, "seo": int, "conversion": int, "llmScore": int, "summary": "1-2 sentence professional assessment" },
  "competitor": { "overallScore": int 0-100, "ui": int, "ux": int, "seo": int, "conversion": int, "llmScore": int, "summary": "1-2 sentence assessment" },
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
  competitor2?: PageCapture,
): Promise<ComparisonResult> {
  // When a 2nd competitor is present, ask the model to score all three and pick
  // the overall winner among them; otherwise the original two-way prompt.
  const prompt = competitor2
    ? `${SYSTEM_PROMPT}\n\nThere is ALSO a second competitor ("COMPETITOR 2"). Add a "competitor2" object with the same fields as "competitor", score it too, and let "verdict.winner" be one of "you" | "competitor" | "competitor2" | "tie" — whichever site is strongest overall.`
    : SYSTEM_PROMPT;

  const contextLines = [scoreLine("YOUR SITE", you), scoreLine("COMPETITOR", competitor)];
  if (competitor2) contextLines.push(scoreLine("COMPETITOR 2", competitor2));
  const parts: any[] = [{ text: `${prompt}\n\n${contextLines.join("\n")}` }];

  const yourShot = toInlineData(you.mobileShot) || toInlineData(you.desktopShot);
  const compShot = toInlineData(competitor.mobileShot) || toInlineData(competitor.desktopShot);
  const comp2Shot = competitor2 ? toInlineData(competitor2.mobileShot) || toInlineData(competitor2.desktopShot) : null;
  if (yourShot) parts.push({ text: "YOUR site screenshot:" }, yourShot);
  if (compShot) parts.push({ text: "COMPETITOR site screenshot:" }, compShot);
  if (comp2Shot) parts.push({ text: "COMPETITOR 2 site screenshot:" }, comp2Shot);

  let text: string;
  try {
    text = await withGeminiModel(
      { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 4096 },
      async (model) => (await model.generateContent(parts)).response.text() as string,
    );
  } catch (err: any) {
    if (err instanceof AppError) throw err;
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
  if (competitor2 && parsed.competitor2) parsed.competitor2.lighthouse = competitor2.scores;
  return parsed;
}
