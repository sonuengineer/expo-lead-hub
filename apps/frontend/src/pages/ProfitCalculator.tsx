import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calculator, Loader2, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import { publicApi } from "../lib/api-client";
import { computeProfit, inr } from "../lib/profit-calc";
import { FindEntry } from "../components/FindEntry";

interface PlaySession {
  visitor: { name: string; company: string };
  event: { id: string; name: string };
}

type Period = "month" | "year";

const FIELDS: { key: "revenue" | "employeeCost" | "operationCost" | "marketingBdCost"; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "employeeCost", label: "Employee cost" },
  { key: "operationCost", label: "Operation cost" },
  { key: "marketingBdCost", label: "Marketing & BD cost" },
];

// "Load example" demo values (borrowed from the old calculator's idea) so a
// visitor can see the calculator work in one tap.
const EXAMPLE = { revenue: "500000", employeeCost: "200000", operationCost: "80000", marketingBdCost: "50000" };

export function ProfitCalculator() {
  const { token } = useParams<{ token: string }>();
  const [period, setPeriod] = useState<Period>("month");
  const [taxRatePct, setTaxRatePct] = useState("25");
  const [vals, setVals] = useState<Record<string, string>>({
    revenue: "",
    employeeCost: "",
    operationCost: "",
    marketingBdCost: "",
  });
  const [done, setDone] = useState(false);
  const [emailed, setEmailed] = useState(false);
  // Collected only when there's no play session (walk-up at /booth/calculator).
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedToken, setLinkedToken] = useState<string | null>(null);
  const [linkedName, setLinkedName] = useState("");
  const effToken = token || linkedToken; // URL play token, or one matched via FindEntry

  const session = useQuery({
    queryKey: ["play-session", token],
    queryFn: async () => (await publicApi.getPlaySession(token!)).data as PlaySession,
    enabled: !!token,
    retry: false,
  });

  const num = (k: string) => parseFloat(vals[k] || "0") || 0;
  const results = useMemo(
    () =>
      computeProfit({
        revenue: num("revenue"),
        employeeCost: num("employeeCost"),
        operationCost: num("operationCost"),
        marketingBdCost: num("marketingBdCost"),
        taxRatePct: parseFloat(taxRatePct || "0") || 0,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vals, taxRatePct],
  );

  const submit = useMutation({
    mutationFn: () =>
      publicApi.submitCalculator({
        revenue: num("revenue"),
        employeeCost: num("employeeCost"),
        operationCost: num("operationCost"),
        marketingBdCost: num("marketingBdCost"),
        taxRatePct: parseFloat(taxRatePct || "0") || 0,
        period,
        playToken: effToken ?? undefined,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      }),
    onSuccess: (res: any) => {
      setEmailed(Boolean(res?.data?.emailed));
      setDone(true);
    },
  });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // With a session (URL token or a matched entry) the email is known; otherwise
  // the walk-up must type one.
  const canSubmit = num("revenue") > 0 && (Boolean(effToken) || emailValid);
  const loss = results.isLoss;

  const Row = ({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: "good" | "bad" }) => (
    <div className={`flex items-center justify-between ${strong ? "mt-1 border-t border-white/10 pt-3" : ""}`}>
      <span className={`text-sm ${strong ? "font-semibold text-white" : "text-slate-400"}`}>{label}</span>
      <span
        className={`font-semibold tabular-nums ${strong ? "text-lg" : "text-sm"} ${
          tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-slate-100"
        }`}
      >
        {inr(value)}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070b11] p-4 text-white sm:p-8">
      {/* subtle green glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,rgba(16,185,129,0.10),transparent)]" />

      <div className="relative mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Calculator size={24} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Profitability Calculator</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            {session.data?.visitor.company ? `${session.data.visitor.company} — ` : ""}
            See your profit, costs and margin in seconds. Runs in your browser.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Inputs */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black">1</span>
              <h2 className="text-base font-semibold">Your numbers</h2>
              <button
                onClick={() => {
                  setVals({ ...EXAMPLE });
                  setTaxRatePct("25");
                }}
                className="ml-auto text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                Load example
              </button>
            </div>

            <div className="mb-5 inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
              {(["month", "year"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                    period === p ? "bg-emerald-500 text-black" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Per {p}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">{f.label}</label>
                  <div className="flex items-center rounded-lg border border-white/10 bg-white/5 px-3 focus-within:border-emerald-500/70">
                    <span className="text-sm text-slate-500">₹</span>
                    <input
                      value={vals[f.key]}
                      onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d.]/g, "") }))}
                      inputMode="numeric"
                      placeholder="0"
                      className="w-full bg-transparent px-2 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Tax rate (%)</label>
                <input
                  value={taxRatePct}
                  onChange={(e) => setTaxRatePct(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500/70 focus:outline-none"
                />
              </div>

              {/* Walk-up (no play session) — link to their form entry, or capture. */}
              {!token && (
                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  {linkedToken ? (
                    <p className="text-sm text-emerald-300">
                      ✓ Linked to {linkedName || "your entry"} — results go to the email you gave.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <FindEntry
                        onFound={(t, n) => {
                          setLinkedToken(t);
                          setLinkedName(n);
                        }}
                      />
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="h-px flex-1 bg-white/10" /> or enter new <span className="h-px flex-1 bg-white/10" />
                      </div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name (optional)"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500/70 focus:outline-none"
                      />
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="you@company.com"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500/70 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Results */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black">2</span>
                <h2 className="text-base font-semibold">Your P&amp;L ({period})</h2>
              </div>
              {!loss ? <TrendingUp className="text-emerald-400" size={18} /> : <TrendingDown className="text-slate-400" size={18} />}
            </div>

            <div className="space-y-2.5">
              <Row label="Revenue" value={results.revenue} />
              <Row label="Employee cost" value={results.employeeCost} />
              <Row label="Operation cost" value={results.operationCost} />
              <Row label="Marketing & BD cost" value={results.marketingBdCost} />
              <Row label="Gross profit" value={results.grossProfit} strong tone="good" />
              <Row label="Net tax" value={results.netTax} />
              <Row label="Net profit" value={results.profit} strong tone={loss ? undefined : "good"} />
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center">
              <span className="text-xs uppercase tracking-widest text-slate-400">Profitability score</span>
              <p className="mt-1 text-4xl font-black tabular-nums text-emerald-400">
                {results.score}
                <span className="text-lg font-bold text-slate-500">/100</span>
              </p>
              <span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/25">
                {results.status}
              </span>
              <p className="mt-2 text-xs text-slate-500">{results.profitMarginPct}% net margin</p>
            </div>

            {done ? (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-300">
                <CheckCircle2 size={16} /> {emailed ? "Sent to your email + our stall screen!" : "Saved to our stall screen!"}
              </div>
            ) : (
              <button
                onClick={() => submit.mutate()}
                disabled={!canSubmit || submit.isPending}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Email me these results
              </button>
            )}
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">Everything runs in your browser · {session.data?.event.name ?? "Rath Infotech"}</p>
      </div>
    </div>
  );
}
