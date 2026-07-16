import { prisma } from "@elc/db";
import { emailService } from "./email.service";
import { reportLink } from "../utils/play-link";
import { inr } from "./profit-calc.service";

// Manually (re)send the game result report(s) for a lead — used when the
// automatic result email didn't go out. Sends to the email on the lead's form.
export async function sendReportsForLead(
  leadId: string,
): Promise<{ sent: number; email: string | null; reason?: string }> {
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

  return { sent, email, reason: sent === 0 ? "No completed game result to send" : undefined };
}

function scoreEmailText(a: any): string {
  const au = a.audit ?? {};
  const y = au.your?.overallScore ?? "—";
  const c = au.competitor?.overallScore ?? "—";
  const m = au.metrics?.your ?? {};
  const num = (v: any) => (v == null ? "—" : Number(v).toLocaleString());
  const lines = [
    "Hi,",
    "",
    "Your AI website audit is ready:",
    "",
    `Overall score — Your site: ${y}/100  |  Competitor: ${c}/100`,
    au.verdict?.reasoning ? `\n${au.verdict.reasoning}` : "",
  ];
  if (m.da != null || m.referringDomains != null || m.keywordCount != null) {
    lines.push(
      "",
      "── Your site's SEO snapshot ──",
      `Domain Authority: ${num(m.da)}   Page Authority: ${num(m.pa)}`,
      `Referring domains: ${num(m.referringDomains)}   Backlinks: ${num(m.backlinks)}`,
      `Ranking keywords: ${num(m.keywordCount)}   Est. organic traffic: ${num(m.organicTraffic)}`,
    );
  }
  lines.push("", `See the full report: ${reportLink(a.id)}`, "", "Rath Infotech and Web Solutions");
  return lines.join("\n");
}

function calcEmailText(p: any): string {
  const r = p.results ?? {};
  const per = p.inputs?.period === "year" ? "yearly" : "monthly";
  return [
    "Hi,",
    "",
    `Here's your Rath Infotech partnership profitability snapshot (${per}):`,
    "",
    `Clients: ${r.clients}`,
    `Total ${per} revenue: ${inr(r.revenue)}`,
    `Rath Infotech charges: ${inr(r.rathCharges)}`,
    `Your internal expenses: ${inr(r.internalExpenses)}`,
    `Total ${per} profit: ${inr(r.profit)}`,
    "",
    `By partnering with Rath Infotech, you can manage ${r.clients} client${r.clients === 1 ? "" : "s"} and earn an estimated ${per} profit of ${inr(r.profit)} without hiring and managing an in-house development team.`,
    "",
    "Rath Infotech and Web Solutions",
  ].join("\n");
}
