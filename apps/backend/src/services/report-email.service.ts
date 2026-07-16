import { prisma } from "@elc/db";
import { emailService } from "./email.service";
import { reportLink } from "../utils/play-link";
import { inr } from "./profit-calc.service";
import { buildCalcEmail, buildReportEmail } from "./email-templates.service";

// Manually (re)send the game result report(s) for a lead — used when the
// automatic result email didn't go out. Sends to the email on the lead's form.
export async function sendReportsForLead(
  leadId: string,
): Promise<{ sent: number; email: string | null; sentCount?: number; reason?: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { playToken: true, rawFormData: true },
  });
  if (!lead?.playToken) return { sent: 0, email: null, reason: "No game session for this lead" };

  const d = (lead.rawFormData ?? {}) as Record<string, any>;
  const email: string | null = d.email ?? d.emailAddress ?? d.email_address ?? null;
  if (!email) return { sent: 0, email: null, reason: "No email captured on this lead" };
  if (!emailService.isEmailConfigured()) return { sent: 0, email, reason: "Email is not configured" };

  const games = await prisma.gameResult.findMany({
    where: { playToken: lead.playToken, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
  });

  let sent = 0;
  for (const g of games) {
    try {
      if (g.gameType === "AI_SCORE" && g.refId) {
        const a = await prisma.websiteAnalysis.findUnique({ where: { id: g.refId } });
        if (a && a.status === "COMPLETED") {
          await emailService.sendEmail(email, "Your AI Website Audit is ready", scoreEmailText(a));
          sent++;
        }
      } else if (g.gameType === "PROFIT_CALC") {
        const p = (g.payload ?? {}) as any;
        if (p?.results) {
          await emailService.sendEmail(email, "Your partnership profitability snapshot", calcEmailText(p));
          sent++;
        }
      }
    } catch (e) {
      console.error("[report-email] send failed:", (e as Error)?.message);
    }
  }

  // Count one send per action (a click that emailed ≥1 report bumps the counter).
  let sentCount: number | undefined;
  if (sent > 0) {
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: { reportsSentCount: { increment: 1 } },
      select: { reportsSentCount: true },
    });
    sentCount = updated.reportsSentCount;
  }

  return { sent, email, sentCount, reason: sent === 0 ? "No completed game result to send" : undefined };
}

function scoreEmailText(a: any): string {
  const au = a.audit ?? {};
  const m = au.metrics?.your ?? {};
  const num = (v: any) => (v == null ? "—" : Number(v).toLocaleString());
  return buildReportEmail({
    yourScore: au.your?.overallScore ?? "—",
    competitorScore: au.competitor?.overallScore ?? "—",
    reasoning: au.verdict?.reasoning ?? "",
    da: num(m.da),
    pa: num(m.pa),
    referringDomains: num(m.referringDomains),
    backlinks: num(m.backlinks),
    keywords: num(m.keywordCount),
    traffic: num(m.organicTraffic),
    reportLink: reportLink(a.id),
  });
}

function calcEmailText(p: any): string {
  const r = p.results ?? {};
  const per = p.inputs?.period === "year" ? "yearly" : "monthly";
  return buildCalcEmail({
    period: per,
    clients: r.clients,
    revenue: inr(r.revenue),
    rathCharges: inr(r.rathCharges),
    internalExpenses: inr(r.internalExpenses),
    profit: inr(r.profit),
  });
}
