import { useMemo, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, Flame, Monitor, Smartphone } from "lucide-react";

export interface Analysis {
  id: string;
  url: string;
  title?: string | null;
  description?: string | null;
  desktopShot?: string | null;
  mobileShot?: string | null;
  roast?: {
    intro?: string;
    ui?: string;
    ux?: string;
    branding?: string;
    cta?: string;
    color?: string;
    typography?: string;
    mobile?: string;
  } | null;
  audit?: {
    overallScore?: number;
    uiScore?: number;
    uxScore?: number;
    conversionScore?: number;
    sections?: Array<{
      key: string;
      score: number;
      problem: string;
      impact: string;
      recommendation: string;
      priority: string;
      improvement: string;
    }>;
    lighthouse?: {
      performance?: number | null;
      seo?: number | null;
      accessibility?: number | null;
      bestPractices?: number | null;
    };
  } | null;
  suggestions?: {
    heroHeadline?: string;
    cta?: string;
    colorPalette?: string[];
    typography?: string;
    trustElements?: string[];
    missingSections?: string[];
    conversion?: string[];
    mobile?: string[];
  } | null;
  createdAt?: string;
}

function scoreColor(v?: number | null) {
  if (v == null) return "#94a3b8";
  if (v >= 90) return "#16a34a";
  if (v >= 50) return "#f59e0b";
  return "#dc2626";
}

function ScoreRing({ label, value }: { label: string; value?: number | null }) {
  const v = value ?? 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  const color = scoreColor(value);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={64} height={64} viewBox="0 0 64 64">
        <circle cx={32} cy={32} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
        <circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text x={32} y={32} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill="#111827">
          {value == null ? "–" : value}
        </text>
      </svg>
      <span className="text-xs font-medium text-gray-500">{label}</span>
    </div>
  );
}

function useNarration(text: string) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const play = () => {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.onstart = () => { setSpeaking(true); setPaused(false); };
    u.onend = () => { setSpeaking(false); setPaused(false); };
    window.speechSynthesis.speak(u);
  };
  const pause = () => {
    if (paused) { window.speechSynthesis.resume(); setPaused(false); }
    else { window.speechSynthesis.pause(); setPaused(true); }
  };
  return { speaking, paused, play, pause };
}

export function RoastReport({ analysis }: { analysis: Analysis }) {
  const [view, setView] = useState<"mobile" | "desktop">("mobile");
  const roast = analysis.roast ?? {};
  const audit = analysis.audit ?? {};
  const sug = analysis.suggestions ?? {};
  const lh = audit.lighthouse ?? {};

  const narrationText = useMemo(() => {
    const parts = [roast.intro, roast.ui, roast.ux, roast.branding, roast.cta, roast.color, roast.typography, roast.mobile];
    return parts.filter(Boolean).join(" ");
  }, [roast]);
  const { speaking, paused, play, pause } = useNarration(narrationText);

  const shot = view === "mobile" ? analysis.mobileShot : analysis.desktopShot;
  const roastLines = [
    ["Intro", roast.intro],
    ["UI", roast.ui],
    ["UX", roast.ux],
    ["Branding", roast.branding],
    ["Call-to-action", roast.cta],
    ["Color", roast.color],
    ["Typography", roast.typography],
    ["Mobile", roast.mobile],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Screenshot */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="truncate text-sm font-medium text-gray-500">{analysis.url}</span>
            {analysis.desktopShot && analysis.mobileShot && (
              <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
                <button
                  onClick={() => setView("mobile")}
                  className={`flex items-center gap-1 px-2 py-1 ${view === "mobile" ? "bg-indigo-600 text-white" : "text-gray-600"}`}
                >
                  <Smartphone size={13} /> Mobile
                </button>
                <button
                  onClick={() => setView("desktop")}
                  className={`flex items-center gap-1 px-2 py-1 ${view === "desktop" ? "bg-indigo-600 text-white" : "text-gray-600"}`}
                >
                  <Monitor size={13} /> Desktop
                </button>
              </div>
            )}
          </div>
          {shot ? (
            <img src={shot} alt="website screenshot" className="max-h-[420px] w-full rounded-lg border border-gray-100 object-contain" />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
              No screenshot available
            </div>
          )}
        </div>

        {/* Roast */}
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Flame className="text-orange-500" size={20} /> The Roast
            </h3>
            {"speechSynthesis" in window && narrationText && (
              <div className="flex items-center gap-1.5">
                <button onClick={play} title="Play" className="rounded-lg border border-orange-200 bg-white p-1.5 text-orange-600 hover:bg-orange-50">
                  <Play size={15} />
                </button>
                <button onClick={pause} disabled={!speaking} title="Pause/Resume" className="rounded-lg border border-orange-200 bg-white p-1.5 text-orange-600 hover:bg-orange-50 disabled:opacity-40">
                  {paused ? <Play size={15} /> : <Pause size={15} />}
                </button>
                <button onClick={play} title="Replay" className="rounded-lg border border-orange-200 bg-white p-1.5 text-orange-600 hover:bg-orange-50">
                  <RotateCcw size={15} />
                </button>
                {speaking && <Volume2 size={15} className="animate-pulse text-orange-500" />}
              </div>
            )}
          </div>
          <div className="space-y-2.5">
            {roastLines.length === 0 && <p className="text-sm text-gray-400">No roast generated.</p>}
            {roastLines.map(([label, text]) => (
              <p key={label} className="text-sm text-gray-700">
                <span className="font-semibold text-orange-700">{label}: </span>
                {text}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Scores */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-gray-900">Scores</h3>
        <div className="flex flex-wrap items-center gap-6">
          <ScoreRing label="Overall" value={audit.overallScore} />
          <ScoreRing label="UI" value={audit.uiScore} />
          <ScoreRing label="UX" value={audit.uxScore} />
          <ScoreRing label="Conversion" value={audit.conversionScore} />
          <div className="mx-2 h-12 w-px bg-gray-200" />
          <ScoreRing label="Performance" value={lh.performance} />
          <ScoreRing label="SEO" value={lh.seo} />
          <ScoreRing label="Accessibility" value={lh.accessibility} />
          <ScoreRing label="Best Practices" value={lh.bestPractices} />
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Performance / SEO / Accessibility / Best Practices are real Lighthouse scores. UI / UX / Conversion are AI assessments.
        </p>
      </div>

      {/* Audit sections */}
      {audit.sections && audit.sections.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-gray-900">Professional Audit</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {audit.sections.map((s) => (
              <div key={s.key} className="rounded-xl border border-gray-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{s.key}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.priority === "High" ? "bg-red-100 text-red-700" : s.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.priority}
                    </span>
                    <span className="text-sm font-bold" style={{ color: scoreColor(s.score) }}>{s.score}</span>
                  </span>
                </div>
                <p className="text-sm text-gray-700"><b>Problem:</b> {s.problem}</p>
                <p className="mt-1 text-sm text-gray-600"><b>Impact:</b> {s.impact}</p>
                <p className="mt-1 text-sm text-gray-600"><b>Fix:</b> {s.recommendation}</p>
                {s.improvement && <p className="mt-1 text-xs text-green-600">Est. improvement: {s.improvement}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {analysis.suggestions && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-gray-900">AI Suggestions</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sug.heroHeadline && <Suggestion title="Better hero headline">{sug.heroHeadline}</Suggestion>}
            {sug.cta && <Suggestion title="Stronger CTA">{sug.cta}</Suggestion>}
            {sug.typography && <Suggestion title="Typography">{sug.typography}</Suggestion>}
            {sug.colorPalette && sug.colorPalette.length > 0 && (
              <Suggestion title="Suggested palette">
                <div className="flex gap-1.5">
                  {sug.colorPalette.map((c, i) => (
                    <span key={i} className="flex flex-col items-center gap-1">
                      <span className="h-7 w-7 rounded-md border border-gray-200" style={{ backgroundColor: c }} />
                      <span className="text-[10px] text-gray-400">{c}</span>
                    </span>
                  ))}
                </div>
              </Suggestion>
            )}
            {listBlocks(sug.trustElements, "Trust elements")}
            {listBlocks(sug.missingSections, "Missing sections")}
            {listBlocks(sug.conversion, "Conversion tips")}
            {listBlocks(sug.mobile, "Mobile tips")}
          </div>
        </div>
      )}
    </div>
  );
}

function Suggestion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-500">{title}</p>
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  );
}

function listBlocks(items: string[] | undefined, title: string) {
  if (!items || items.length === 0) return null;
  return (
    <Suggestion title={title}>
      <ul className="list-disc space-y-0.5 pl-4">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </Suggestion>
  );
}
