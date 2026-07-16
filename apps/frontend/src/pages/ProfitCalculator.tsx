import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2, TrendingUp, CalendarClock, Users, ArrowLeft } from "lucide-react";
import { publicApi } from "../lib/api-client";
import { computeProfit, inr } from "../lib/profit-calc";
import { FindEntry } from "../components/FindEntry";

interface PlaySession {
  visitor: { name: string; company: string; email?: string; phone?: string };
  event: { id: string; name: string };
}

type FieldKey = "clients" | "avgRetainer" | "employeeCost" | "operationalCost" | "miscCost" | "rathFeePerClient";
type Period = "month" | "year";

const FIELDS: { key: FieldKey; label: string; currency: boolean }[] = [
  { key: "clients", label: "Number of clients", currency: false },
  { key: "avgRetainer", label: "Avg. monthly retainer / client", currency: true },
  { key: "employeeCost", label: "Monthly employee cost", currency: true },
  { key: "operationalCost", label: "Monthly operational cost", currency: true },
  { key: "miscCost", label: "Monthly miscellaneous cost", currency: true },
];

export function ProfitCalculator() {
  const { token } = useParams<{ token: string }>();
  const [period, setPeriod] = useState<Period>("month");
  const [vals, setVals] = useState<Record<string, string>>({
    clients: "",
    avgRetainer: "",
    employeeCost: "",
    operationalCost: "",
    miscCost: "",
    rathFeePerClient: "",
  });
  const [done, setDone] = useState(false);
  const [emailed, setEmailed] = useState(false);
  // Walk-up (no play session) — link to their form entry, or capture an email.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedToken, setLinkedToken] = useState<string | null>(null);
  const [linkedName, setLinkedName] = useState("");
  const effToken = token || linkedToken;

  const session = useQuery({
    queryKey: ["play-session", token],
    queryFn: async () => (await publicApi.getPlaySession(token!)).data as PlaySession,
    enabled: !!token,
    retry: false,
  });

  const num = (k: string) => parseFloat(vals[k] || "0") || 0;
  const inputs = () => ({
    clients: num("clients"),
    avgRetainer: num("avgRetainer"),
    employeeCost: num("employeeCost"),
    operationalCost: num("operationalCost"),
    miscCost: num("miscCost"),
    rathFeePerClient: num("rathFeePerClient"),
    period,
  });
  const results = useMemo(
    () => computeProfit(inputs()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vals, period],
  );
  const per = period === "year" ? "yearly" : "monthly";

  const submit = useMutation({
    mutationFn: () =>
      publicApi.submitCalculator({
        ...inputs(),
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
  const hasNumbers = num("clients") > 0;
  const canSubmit = hasNumbers && (Boolean(effToken) || emailValid);

  const card = "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl";
  const inputCls =
    "w-full bg-transparent py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none";

  return (
    <div className="relative min-h-screen bg-[#060a0f] p-4 text-white sm:p-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70rem_45rem_at_50%_-10%,rgba(16,185,129,0.14),transparent)]" />

      <div className="relative mx-auto max-w-5xl">
        {/* Back — to the game menu (play session) or the booth landing. */}
        <Link
          to={token ? `/play/${token}` : "/booth"}
          className="mb-5 inline-flex items-center gap-2 text-lg font-semibold text-slate-300 transition hover:text-white"
        >
          <ArrowLeft size={22} /> Back to home
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Rath Infotech Agency Partnership
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Profitability Calculator</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            {session.data?.visitor.company ? `${session.data.visitor.company} — ` : ""}
            see how much you could earn by partnering with Rath Infotech instead of running an in-house team.
          </p>
          {(session.data?.visitor.email || session.data?.visitor.phone) && (
            <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
              {session.data?.visitor.email && <span>{session.data.visitor.email}</span>}
              {session.data?.visitor.phone && <span>{session.data.visitor.phone}</span>}
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Inputs */}
          <section className={`${card} p-6`}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold">Your agency (monthly figures)</h2>
              <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
                {(["month", "year"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-3 py-1 font-medium capitalize transition ${
                      period === p ? "bg-emerald-500 text-black" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {p === "month" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">{f.label}</label>
                  <div className="flex items-center rounded-lg border border-white/10 bg-white/5 px-3 focus-within:border-emerald-500/70">
                    {f.currency && <span className="text-sm text-slate-500">₹</span>}
                    {!f.currency && <Users size={15} className="text-slate-500" />}
                    <input
                      value={vals[f.key]}
                      onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d.]/g, "") }))}
                      inputMode="numeric"
                      placeholder="0"
                      className={`${inputCls} px-2`}
                    />
                  </div>
                </div>
              ))}

              {/* Rath Infotech charge — manual entry, no default. */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Rath Infotech charge / client</label>
                <div className="flex items-center rounded-lg border border-white/10 bg-white/5 px-3 focus-within:border-emerald-500/70">
                  <span className="text-sm text-slate-500">₹</span>
                  <input
                    value={vals.rathFeePerClient}
                    onChange={(e) => setVals((v) => ({ ...v, rathFeePerClient: e.target.value.replace(/[^\d.]/g, "") }))}
                    inputMode="numeric"
                    placeholder="0"
                    className={`${inputCls} px-2`}
                  />
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              All fields optional. Showing <span className="text-slate-300">{per}</span> totals ({period === "year" ? "monthly × 12" : "per month"}).
            </p>
          </section>

          {/* Results */}
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Kpi label={`Total ${per} revenue`} value={inr(results.revenue)} />
              <Kpi label={`Rath Infotech charges (${per})`} value={inr(results.rathCharges)} />
              <Kpi label={`Internal expenses (${per})`} value={inr(results.internalExpenses)} />
              <Kpi label={`Total ${per} profit`} value={inr(results.profit)} highlight />
            </div>

            <div className={`${card} p-5`}>
              <div className="flex items-start gap-3">
                <TrendingUp className="mt-0.5 shrink-0 text-emerald-400" size={20} />
                <p className="text-sm leading-relaxed text-slate-300">
                  By partnering with Rath Infotech, you can manage{" "}
                  <span className="font-semibold text-white">{results.clients}</span> client
                  {results.clients === 1 ? "" : "s"} and earn an estimated {per} profit of{" "}
                  <span className="font-semibold text-emerald-400">{inr(results.profit)}</span> without hiring and
                  managing an in-house development team.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* CTA */}
        <section className={`${card} mt-6 p-6 text-center sm:p-8`}>
          <h2 className="text-xl font-bold sm:text-2xl">Ready to increase your agency profits?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            We'll send this snapshot to your inbox and set up a quick demo.
          </p>

          {/* Walk-up: link to the form entry or capture an email. */}
          {!token && !done && (
            <div className="mx-auto mt-5 max-w-md text-left">
              {linkedToken ? (
                <p className="text-center text-sm text-emerald-300">
                  ✓ Linked to {linkedName || "your entry"} — we'll use the email you gave.
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
                    <span className="h-px flex-1 bg-white/10" /> or enter your details <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className={`flex items-center rounded-lg border border-white/10 bg-white/5 px-3`}>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className={inputCls} />
                  </div>
                  <div className={`flex items-center rounded-lg border border-white/10 bg-white/5 px-3`}>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@company.com" className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          )}

          {done ? (
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
              <CheckCircle2 size={16} /> {emailed ? "Sent to your email — we'll be in touch!" : "Saved — we'll be in touch!"}
            </div>
          ) : (
            <button
              onClick={() => submit.mutate()}
              disabled={!canSubmit || submit.isPending}
              className="mx-auto mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-8 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
              Schedule a Demo
            </button>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-slate-600">
          Runs live in your browser · {session.data?.event.name ?? "Rath Infotech"}
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 backdrop-blur-xl transition ${
        highlight ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_40px_-12px_rgba(16,185,129,0.5)]" : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-black tabular-nums ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
