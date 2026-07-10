import { prisma } from "@elc/db";
import { env } from "../config/env";
import { getPageAnalyzer } from "./page-analyzer.service";
import { generateRoast } from "./ai-roast.service";

// In-process job queue for website roasts. Up to AI_CONCURRENCY run at once;
// additional requests wait in line. Keeps a busy booth from overloading the
// AI provider (and hitting its rate limits) when several people roast at once.

interface Job {
  analysisId: string;
  url: string;
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

    const capture = await getPageAnalyzer().analyze(job.url);

    // Retry the AI call on transient errors (429/503/overloaded).
    let ai: Awaited<ReturnType<typeof generateRoast>> | undefined;
    let lastErr: any;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        ai = await generateRoast(capture);
        break;
      } catch (e: any) {
        lastErr = e;
        const retryable = /429|503|Too Many Requests|Service Unavailable|overloaded/i.test(
          String(e?.message || ""),
        );
        if (!retryable || attempt === RETRY_DELAYS.length) throw e;
        await sleep(RETRY_DELAYS[attempt]!);
      }
    }
    if (!ai) throw lastErr;

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
