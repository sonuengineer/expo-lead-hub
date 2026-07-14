import { prisma } from "@elc/db";
import { env } from "../config/env";
import { getPageAnalyzer } from "./page-analyzer.service";
import { generateRoast } from "./ai-roast.service";
import { generateComparison } from "./ai-score.service";

// In-process job queue for website analyses. Up to AI_CONCURRENCY run at once;
// additional requests wait in line. Keeps a busy booth from overloading the
// AI provider (and hitting its rate limits) when several people play at once.
// A job with `competitorUrl` runs the head-to-head Score Game; otherwise it
// runs the (legacy) single-site roast.

interface Job {
  analysisId: string;
  url: string;
  competitorUrl?: string;
  company?: string;
}

// Retry a transient-failing AI call (429/503/overloaded) with backoff.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const retryable = /429|503|Too Many Requests|Service Unavailable|overloaded/i.test(
        String(e?.message || ""),
      );
      if (!retryable || attempt === RETRY_DELAYS.length) throw e;
      await sleep(RETRY_DELAYS[attempt]!);
    }
  }
  throw lastErr;
}

const queue: Job[] = [];
let active = 0;
const MAX = env.AI_CONCURRENCY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRY_DELAYS = [2000, 5000, 12000]; // backoff for transient AI errors

export function enqueueAnalysis(job: Job) {
  queue.push(job);
  pump();
}

export function queueInfo() {
  return { waiting: queue.length, active, max: MAX };
}

function pump() {
  while (active < MAX && queue.length > 0) {
    const job = queue.shift()!;
    active++;
    void runJob(job).finally(() => {
      active--;
      pump();
    });
  }
}

async function runJob(job: Job) {
  try {
    await prisma.websiteAnalysis.update({
      where: { id: job.analysisId },
      data: { status: "PROCESSING" },
    });

    if (job.competitorUrl) {
      // ── AI Score Game: head-to-head comparison of two sites ──
      const [you, competitor] = await Promise.all([
        getPageAnalyzer().analyze(job.url),
        getPageAnalyzer().analyze(job.competitorUrl),
      ]);
      const result = await withRetry(() => generateComparison(you, competitor));

      await prisma.websiteAnalysis.update({
        where: { id: job.analysisId },
        data: {
          status: "COMPLETED",
          url: you.finalUrl,
          competitorUrl: competitor.finalUrl,
          title: you.title ?? null,
          description: you.description ?? null,
          desktopShot: you.desktopShot ?? null,
          mobileShot: you.mobileShot ?? null,
          competitorShot: competitor.mobileShot ?? competitor.desktopShot ?? null,
          audit: result as any,
          suggestions: result.suggestions as any,
        },
      });
      return;
    }

    // ── Legacy single-site roast ──
    const capture = await getPageAnalyzer().analyze(job.url);
    const ai = await withRetry(() => generateRoast(capture));

    await prisma.websiteAnalysis.update({
      where: { id: job.analysisId },
      data: {
        status: "COMPLETED",
        url: capture.finalUrl,
        title: capture.title ?? null,
        description: capture.description ?? null,
        desktopShot: capture.desktopShot ?? null,
        mobileShot: capture.mobileShot ?? null,
        roast: ai.roast as any,
        audit: { ...ai.audit, lighthouse: capture.scores } as any,
        suggestions: ai.suggestions as any,
      },
    });
  } catch (e: any) {
    await prisma.websiteAnalysis
      .update({
        where: { id: job.analysisId },
        data: { status: "FAILED", error: String(e?.message || "Analysis failed").slice(0, 500) },
      })
      .catch(() => {});
  }
}
