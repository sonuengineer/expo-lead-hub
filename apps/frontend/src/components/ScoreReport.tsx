import { useEffect, useState } from "react";
import { Trophy, Crown, Sparkles, Monitor } from "lucide-react";
import { ScoreRing, scoreColor } from "./ScoreRing";

interface SiteScore {
  overallScore?: number;
  ui?: number;
  ux?: number;
  seo?: number;
  conversion?: number;
  llmScore?: number;
  summary?: string;
  lighthouse?: { performance?: number | null; seo?: number | null; accessibility?: number | null; bestPractices?: number | null };
}

interface DomainMetrics {
  da?: number | null;
  pa?: number | null;
  keywordCount?: number | null;
  organicTraffic?: number | null;
  referringDomains?: number | null;
  backlinks?: number | null;
  topKeywords?: string[];
}

export interface Comparison {
  id: string;
  url: string;
  competitorUrl?: string | null;
  competitorUrl2?: string | null;
  company?: string | null;
  mobileShot?: string | null;
  desktopShot?: string | null;
  competitorShot?: string | null;
  competitor2Shot?: string | null;
  audit?: {
    your?: SiteScore;
    competitor?: SiteScore;
    competitor2?: SiteScore;
    verdict?: { winner?: "you" | "competitor" | "competitor2" | "tie"; perCategory?: Array<{ key: string; youWin: boolean; note: string }>; reasoning?: string };
    metrics?: { your?: DomainMetrics | null; competitor?: DomainMetrics | null; competitor2?: DomainMetrics | null } | null;
    competitors?: { domain: string; sharedKeywords?: number | null }[] | null;
  } | null;
  suggestions?: {
    heroHeadline?: string;
    cta?: string;
    colorPalette?: string[];
    trustElements?: string[];
    missingSections?: string[];
    conversion?: string[];
    mobile?: string[];
  } | null;
}

// Animate a number 0 → target on mount.
function useCountUp(target: number, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function BigScore({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const v = useCountUp(value);
  return (
    <div className={`flex flex-1 flex-col items-center rounded-2xl border p-5 ${highlight ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}>
      {highlight && <Crown className="mb-1 text-amber-500" size={20} />}
      <div style={{ color: scoreColor(value) }}>
        <ScoreRing value={v} size={128} />
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-gray-800" title={label}>{label}</p>
    </div>
  );
}

function MetricsCol({ title, m, accent }: { title: string; m: DomainMetrics | null; accent: string }) {
  const stat = (label: string, val: number | null | undefined) => (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${accent}`}>{val == null ? "–" : val.toLocaleString()}</span>
    </div>
  );
  return (
    <div>
      <p className="mb-2 truncate text-sm font-semibold text-gray-800" title={title}>{title}</p>
      <div className="space-y-1.5">
        {stat("Domain Authority", m?.da)}
        {stat("Page Authority", m?.pa)}
        {stat("Referring domains", m?.referringDomains)}
        {stat("Backlinks", m?.backlinks)}
        {stat("Ranking keywords", m?.keywordCount)}
        {stat("Est. organic traffic", m?.organicTraffic)}
      </div>
      {m?.topKeywords && m.topKeywords.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {m.topKeywords.slice(0, 5).map((k, i) => (
            <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Bar({ label, you, comp }: { label: string; you?: number; comp?: number }) {
  const y = you ?? 0;
  const c = comp ?? 0;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
      <div className="flex items-center justify-end gap-2">
        <span className="font-semibold" style={{ color: scoreColor(you) }}>{you ?? "–"}</span>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
          <div className="ml-auto h-full rounded-full" style={{ width: `${y}%`, backgroundColor: scoreColor(you), marginLeft: "auto", float: "right" }} />
        </div>
      </div>
      <span className="w-24 text-center text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full" style={{ width: `${c}%`, backgroundColor: scoreColor(comp) }} />
        </div>
        <span className="font-semibold" style={{ color: scoreColor(comp) }}>{comp ?? "–"}</span>
      </div>
    </div>
  );
}

export function ScoreReport({ data }: { data: Comparison }) {
  const your = data.audit?.your ?? {};
  const comp = data.audit?.competitor ?? {};
  const verdict = data.audit?.verdict ?? {};
  const sug = data.suggestions ?? {};
  const youWin = verdict.winner === "you";
  const tie = verdict.winner === "tie";
  const lh = your.lighthouse ?? {};
  const clh = comp.lighthouse ?? {};
  const comp2 = data.audit?.competitor2 ?? null;
  const myMetrics = data.audit?.metrics?.your ?? null;
  const compMetrics = data.audit?.metrics?.competitor ?? null;
  const comp2Metrics = data.audit?.metrics?.competitor2 ?? null;
  const competitors = data.audit?.competitors ?? [];

  return (
    <div className="space-y-6">
      {/* Verdict banner */}
      <div className={`rounded-2xl p-5 text-center text-white shadow-lg ${youWin ? "bg-gradient-to-r from-emerald-500 to-teal-600" : tie ? "bg-gradient-to-r from-slate-500 to-slate-700" : "bg-gradient-to-r from-orange-500 to-rose-600"}`}>
        <Trophy className="mx-auto mb-1" size={26} />
        <h2 className="text-2xl font-black">
          {youWin ? "🏆 You win!" : tie ? "It's a tie!" : "You're behind — here's how to win"}
        </h2>
        <p className="mx-auto mt-1 max-w-2xl text-sm text-white/80">{verdict.reasoning}</p>
      </div>

      {/* Big scores head-to-head */}
      <div className="flex flex-col items-stretch gap-4 sm:flex-row">
        <BigScore label={data.company || hostOf(data.url) || "Your site"} value={your.overallScore ?? 0} highlight={youWin} />
        <div className="flex items-center justify-center px-2 text-lg font-black text-gray-400">VS</div>
        <BigScore label={hostOf(data.competitorUrl) || "Competitor"} value={comp.overallScore ?? 0} highlight={verdict.winner === "competitor"} />
        {comp2 && (
          <>
            <div className="flex items-center justify-center px-2 text-lg font-black text-gray-400">VS</div>
            <BigScore label={hostOf(data.competitorUrl2) || "Competitor 2"} value={comp2.overallScore ?? 0} highlight={verdict.winner === "competitor2"} />
          </>
        )}
      </div>

      {/* Category comparison */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] text-xs font-semibold uppercase tracking-wide text-gray-400">
          <span className="text-right">You</span><span className="w-24 text-center">Metric</span><span>Competitor</span>
        </div>
        <div className="space-y-3">
          <Bar label="UI" you={your.ui} comp={comp.ui} />
          <Bar label="UX" you={your.ux} comp={comp.ux} />
          <Bar label="SEO" you={your.seo} comp={comp.seo} />
          <Bar label="Conversion" you={your.conversion} comp={comp.conversion} />
          {(your.llmScore != null || comp.llmScore != null) && <Bar label="LLM" you={your.llmScore} comp={comp.llmScore} />}
          {(lh.performance != null || clh.performance != null) && <Bar label="Performance" you={lh.performance ?? undefined} comp={clh.performance ?? undefined} />}
          {(lh.accessibility != null || clh.accessibility != null) && <Bar label="Accessibility" you={lh.accessibility ?? undefined} comp={clh.accessibility ?? undefined} />}
          {(lh.bestPractices != null || clh.bestPractices != null) && <Bar label="Best Practices" you={lh.bestPractices ?? undefined} comp={clh.bestPractices ?? undefined} />}
        </div>
        <p className="mt-3 text-center text-xs text-gray-400">UI / UX / Conversion / LLM are AI scores. Performance / Accessibility are Lighthouse (when a PSI key is configured).</p>
      </div>

      {/* Domain authority + keywords (DataForSEO) */}
      {(myMetrics || compMetrics) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Domain authority &amp; keywords</h3>
          <div className={`grid gap-4 ${comp2 ? "grid-cols-3" : "grid-cols-2"}`}>
            <MetricsCol title={data.company || hostOf(data.url) || "Your site"} m={myMetrics} accent="text-emerald-600" />
            <MetricsCol title={hostOf(data.competitorUrl) || "Competitor"} m={compMetrics} accent="text-rose-600" />
            {comp2 && <MetricsCol title={hostOf(data.competitorUrl2) || "Competitor 2"} m={comp2Metrics} accent="text-rose-600" />}
          </div>
          <p className="mt-3 text-center text-xs text-gray-400">DA / PA are DataForSEO domain &amp; page ranks (0–1000). Keywords &amp; traffic are organic estimates.</p>
        </div>
      )}

      {/* Top organic competitors (DataForSEO) */}
      {competitors.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Your top organic competitors</h3>
          <div className="flex flex-wrap gap-2">
            {competitors.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm">
                <span className="font-medium text-gray-800">{c.domain}</span>
                {c.sharedKeywords != null && <span className="text-xs text-gray-500">{c.sharedKeywords} shared</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summaries + screenshots */}
      <div className={`grid grid-cols-1 gap-4 ${comp2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <SiteCard title={data.company || "Your site"} url={data.url} shot={data.mobileShot || data.desktopShot} summary={your.summary} tone="emerald" />
        <SiteCard title="Competitor" url={data.competitorUrl} shot={data.competitorShot} summary={comp.summary} tone="rose" />
        {comp2 && <SiteCard title="Competitor 2" url={data.competitorUrl2} shot={data.competitor2Shot} summary={comp2.summary} tone="rose" />}
      </div>

      {/* Suggestions to win */}
      {data.suggestions && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
            <Sparkles size={18} className="text-indigo-500" /> How to beat them
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sug.heroHeadline && <Sg title="Stronger headline">{sug.heroHeadline}</Sg>}
            {sug.cta && <Sg title="Better CTA">{sug.cta}</Sg>}
            {sug.colorPalette && sug.colorPalette.length > 0 && (
              <Sg title="Suggested palette">
                <div className="flex gap-1.5">
                  {sug.colorPalette.map((c, i) => <span key={i} className="h-7 w-7 rounded-md border border-gray-200" style={{ backgroundColor: c }} />)}
                </div>
              </Sg>
            )}
            {list(sug.trustElements, "Trust elements")}
            {list(sug.missingSections, "Missing sections")}
            {list(sug.conversion, "Conversion tips")}
            {list(sug.mobile, "Mobile tips")}
          </div>
        </div>
      )}
    </div>
  );
}

function SiteCard({ title, url, shot, summary, tone }: { title: string; url?: string | null; shot?: string | null; summary?: string; tone: "emerald" | "rose" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className={`px-4 py-2 text-sm font-semibold text-white ${tone === "emerald" ? "bg-emerald-600" : "bg-rose-600"}`}>{title}</div>
      {shot ? (
        <img src={shot} alt="" className="max-h-64 w-full object-cover object-top" />
      ) : (
        <div className="flex h-40 items-center justify-center bg-gray-50 text-gray-300"><Monitor size={28} /></div>
      )}
      <div className="p-4">
        <p className="truncate text-xs text-gray-400">{url}</p>
        {summary && <p className="mt-1 text-sm text-gray-700">{summary}</p>}
      </div>
    </div>
  );
}

function Sg({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-500">{title}</p>
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  );
}

function list(items: string[] | undefined, title: string) {
  if (!items || items.length === 0) return null;
  return (
    <Sg title={title}>
      <ul className="list-disc space-y-0.5 pl-4">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </Sg>
  );
}

function hostOf(u?: string | null) {
  if (!u) return "";
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
