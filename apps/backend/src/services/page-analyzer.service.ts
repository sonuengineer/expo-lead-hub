import axios from "axios";
import { env } from "../config/env";

export interface PageScores {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
}

export interface PageCapture {
  url: string;
  finalUrl: string;
  title?: string;
  description?: string;
  desktopShot?: string; // base64 data URL
  mobileShot?: string; // base64 data URL
  scores: PageScores;
}

export interface PageAnalyzer {
  analyze(url: string): Promise<PageCapture>;
}

// Normalize a user-entered URL (add scheme if missing).
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

// Free, keyless screenshot fallback for when PageSpeed Insights is unavailable
// (no PSI key / quota exhausted). Scores are unknown in this path; the AI still
// roasts the actual rendered design from the image.
async function fallbackScreenshot(url: string): Promise<string | undefined> {
  const services = [
    `https://image.thum.io/get/width/1280/${url}`,
    `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1280`,
  ];
  for (const shotUrl of services) {
    try {
      const { data } = await axios.get<ArrayBuffer>(shotUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      const buf = Buffer.from(data);
      if (buf.length > 3000) return `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

async function fetchMeta(url: string): Promise<{ title?: string; description?: string }> {
  try {
    const { data: html } = await axios.get<string>(url, {
      timeout: 15000,
      maxContentLength: 3_000_000,
      responseType: "text",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1]?.trim();
    return { title, description };
  } catch {
    return {};
  }
}

// ── Google PageSpeed Insights (free, hosted Lighthouse) ──
class PageSpeedAnalyzer implements PageAnalyzer {
  private endpoint = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

  private async run(url: string, strategy: "mobile" | "desktop") {
    const cats = ["performance", "seo", "accessibility", "best-practices"]
      .map((c) => `category=${c}`)
      .join("&");
    const key = env.PAGESPEED_API_KEY ? `&key=${env.PAGESPEED_API_KEY}` : "";
    const requestUrl = `${this.endpoint}?url=${encodeURIComponent(url)}&strategy=${strategy}&${cats}${key}`;
    const { data } = await axios.get(requestUrl, { timeout: 70000 });
    return data;
  }

  private extractScreenshot(lhr: any): string | undefined {
    return (
      lhr?.fullPageScreenshot?.screenshot?.data ||
      lhr?.audits?.["final-screenshot"]?.details?.data ||
      undefined
    );
  }

  private score(lhr: any, cat: string): number | null {
    const s = lhr?.categories?.[cat]?.score;
    return typeof s === "number" ? Math.round(s * 100) : null;
  }

  async analyze(url: string): Promise<PageCapture> {
    // Mobile drives scores + mobile screenshot; desktop only for its screenshot.
    const [mobile, meta, desktop] = await Promise.allSettled([
      this.run(url, "mobile"),
      fetchMeta(url),
      this.run(url, "desktop"),
    ]);

    const metaData = meta.status === "fulfilled" ? meta.value : {};

    // PageSpeed Insights unavailable (no key / quota) → free screenshot, no scores.
    if (mobile.status !== "fulfilled") {
      const shot = await fallbackScreenshot(url);
      if (!shot) {
        throw new Error("Could not analyze this URL — the site may be unreachable or blocking crawlers.");
      }
      return {
        url,
        finalUrl: url,
        title: metaData.title,
        description: metaData.description,
        mobileShot: shot,
        scores: { performance: null, seo: null, accessibility: null, bestPractices: null },
      };
    }

    const mLhr = mobile.value.lighthouseResult;
    const dLhr = desktop.status === "fulfilled" ? desktop.value.lighthouseResult : undefined;

    return {
      url,
      finalUrl: mLhr?.finalUrl || mobile.value.id || url,
      title: metaData.title,
      description: metaData.description,
      mobileShot: this.extractScreenshot(mLhr),
      desktopShot: this.extractScreenshot(dLhr),
      scores: {
        performance: this.score(mLhr, "performance"),
        seo: this.score(mLhr, "seo"),
        accessibility: this.score(mLhr, "accessibility"),
        bestPractices: this.score(mLhr, "best-practices"),
      },
    };
  }
}

// ── Provider factory ──────────────────────────
// PageSpeed Insights is the free default. A DataForSEO implementation can be
// dropped in here later (gated on DATAFORSEO_LOGIN/PASSWORD) without touching callers.
export function getPageAnalyzer(): PageAnalyzer {
  return new PageSpeedAnalyzer();
}
