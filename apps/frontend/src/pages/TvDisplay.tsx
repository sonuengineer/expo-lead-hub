import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Calculator, Trophy, Users, Loader2 } from "lucide-react";
import { publicApi } from "../lib/api-client";
import { QrImage } from "../components/QrImage";

interface ScoreItem {
  type: "AI_SCORE";
  label: string;
  yourScore: number | null;
  competitorScore: number | null;
  winner: string | null;
  url: string;
  competitor: string;
}
interface CalcItem {
  type: "PROFIT_CALC";
  revenue: number | null;
  profit: number | null;
  margin: number | null;
}
interface Feed {
  event: { name: string } | null;
  queue: { active: number; waiting: number; max: number };
  scoreItems: ScoreItem[];
  calcItems: CalcItem[];
  leaderboard: { scores: { label: string; value: number | null }[]; margins: { value: number | null; profit: number | null }[] };
}

const inr = (v: number | null) => (v == null ? "–" : "₹" + new Intl.NumberFormat("en-IN").format(Math.round(v)));
const ring = (v: number | null) => (v == null ? "#64748b" : v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#f43f5e");

export function TvDisplay() {
  const { data } = useQuery({
    queryKey: ["tv-feed"],
    queryFn: async () => (await publicApi.tvFeed()).data as Feed,
    refetchInterval: 5000,
  });

  // Auto-rotate through the latest results.
  const cards = [...(data?.scoreItems ?? []), ...(data?.calcItems ?? [])];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (cards.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % cards.length), 8000);
    return () => clearInterval(t);
  }, [cards.length]);
  const card = cards[idx % Math.max(1, cards.length)];

  const boothUrl = `${window.location.origin}/booth`;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-8 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Rath Infotech</h1>
          <p className="mt-1 text-lg text-indigo-300">{data?.event?.name ?? "Live at our booth"}</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3 backdrop-blur">
          <Users className="text-indigo-300" size={28} />
          <div className="text-right">
            <p className="text-3xl font-black">{data?.queue.active ?? 0}</p>
            <p className="text-xs uppercase tracking-widest text-indigo-300">playing</p>
          </div>
          {(data?.queue.waiting ?? 0) > 0 && (
            <div className="border-l border-white/20 pl-3 text-right">
              <p className="text-3xl font-black">{data?.queue.waiting}</p>
              <p className="text-xs uppercase tracking-widest text-indigo-300">in queue</p>
            </div>
          )}
        </div>
      </div>

      {/* Main stage */}
      <div className="grid flex-1 grid-cols-[2fr_1fr] gap-8 py-8">
        {/* Rotating result card */}
        <div className="flex items-center justify-center">
          {!data ? (
            <Loader2 className="animate-spin text-indigo-400" size={48} />
          ) : !card ? (
            <div className="text-center text-2xl text-indigo-300">
              <Sparkles className="mx-auto mb-4" size={56} />
              Be the first to play — scan the QR!
            </div>
          ) : card.type === "AI_SCORE" ? (
            <div className="w-full max-w-2xl rounded-3xl bg-white/5 p-10 text-center backdrop-blur">
              <div className="mb-4 flex items-center justify-center gap-2 text-indigo-300">
                <Sparkles size={22} /> <span className="text-xl font-semibold">AI Website Score</span>
              </div>
              <p className="mb-6 truncate text-2xl font-bold">{card.label}</p>
              <div className="flex items-center justify-center gap-10">
                <ScoreBig label={card.url} value={card.yourScore} win={card.winner === "you"} />
                <span className="text-3xl font-black text-white/40">VS</span>
                <ScoreBig label={card.competitor} value={card.competitorScore} win={card.winner === "competitor"} />
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl rounded-3xl bg-white/5 p-10 text-center backdrop-blur">
              <div className="mb-6 flex items-center justify-center gap-2 text-emerald-300">
                <Calculator size={22} /> <span className="text-xl font-semibold">Profitability Snapshot</span>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <Stat label="Revenue" value={inr(card.revenue)} />
                <Stat label="Net profit" value={inr(card.profit)} tone={(card.profit ?? 0) >= 0 ? "good" : "bad"} />
                <Stat label="Margin" value={card.margin == null ? "–" : `${card.margin}%`} tone={(card.margin ?? 0) >= 0 ? "good" : "bad"} />
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard + QR */}
        <div className="flex flex-col gap-6">
          <div className="flex-1 rounded-3xl bg-white/5 p-6 backdrop-blur">
            <div className="mb-4 flex items-center gap-2 text-amber-300">
              <Trophy size={22} /> <span className="text-lg font-bold">Top Scores</span>
            </div>
            <div className="space-y-3">
              {(data?.leaderboard.scores ?? []).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 text-lg font-black text-white/40">{i + 1}</span>
                  <span className="flex-1 truncate text-lg">{s.label}</span>
                  <span className="text-xl font-black" style={{ color: ring(s.value) }}>{s.value ?? "–"}</span>
                </div>
              ))}
              {(data?.leaderboard.scores.length ?? 0) === 0 && <p className="text-white/40">No scores yet.</p>}
            </div>
          </div>
          <div className="rounded-3xl bg-white p-6 text-center text-slate-900">
            <p className="mb-3 text-lg font-bold">Play now — scan me</p>
            <div className="flex justify-center">
              <QrImage value={boothUrl} size={180} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBig({ label, value, win }: { label: string; value: number | null; win?: boolean }) {
  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-8 text-5xl font-black"
        style={{ borderColor: ring(value), color: ring(value) }}
      >
        {value ?? "–"}
      </div>
      <p className="mt-3 max-w-[10rem] truncate text-lg">{label}</p>
      {win && <p className="mt-1 text-sm font-bold text-emerald-400">WINNER</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-widest text-white/50">{label}</p>
      <p className={`mt-1 text-3xl font-black ${tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
