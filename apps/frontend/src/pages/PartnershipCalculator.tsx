import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw, Wand2, Trophy, X, Loader2, Send } from "lucide-react";
import toast from "react-hot-toast";
import { CALCULATOR_FIELDS, calculate, formatCurrency, type CalcValues } from "../lib/calculator";
import { ScoreRing, scoreColor } from "../components/ScoreRing";
import { publicApi } from "../lib/api-client";

const emptyValues: CalcValues = Object.fromEntries(CALCULATOR_FIELDS.map((f) => [f.key, ""]));

const BREAKDOWN = [
  { key: "partnerPayment", label: "Partner Payment", color: "#6366f1" },
  { key: "yourCost", label: "Your Cost", color: "#0ea5e9" },
  { key: "otherExpenses", label: "Other Expenses", color: "#f59e0b" },
  { key: "overhead", label: "Overhead", color: "#a855f7" },
] as const;

export function PartnershipCalculator() {
  const [values, setValues] = useState<CalcValues>({ ...emptyValues });
  const [showLead, setShowLead] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lead, setLead] = useState({ name: "", company: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => calculate(values), [values]);

  const setField = (key: string, raw: string) =>
    setValues((prev) => ({ ...prev, [key]: raw === "" ? "" : Math.max(0, Number(raw)) }));

  const loadDemo = () =>
    setValues(Object.fromEntries(CALCULATOR_FIELDS.map((f) => [f.key, f.demo])) as CalcValues);
  const reset = () => {
    setValues({ ...emptyValues });
    setSaved(false);
  };

  const saveLead = async () => {
    setSaving(true);
    try {
      await publicApi.saveBoothLead({
        ...lead,
        calculator: {
          inputs: values,
          revenue: result.revenue,
          profit: result.profit,
          score: result.score,
          status: result.status,
        },
      });
      setSaved(true);
      setShowLead(false);
      toast.success("Saved — our team will follow up 🎉");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    { label: "Revenue", value: result.revenue, accent: "text-sky-300" },
    { label: "Partner Payment", value: result.partnerPayment, accent: "text-indigo-300" },
    { label: "Total Cost", value: result.totalCost, accent: "text-amber-300" },
    { label: "Estimated Profit", value: result.profit, accent: "text-emerald-300" },
  ];

  const totalForBar = Math.max(1, result.totalCost);

  return (
    <div className="booth-bg p-4 sm:p-6">
      {/* Top bar */}
      <div className="mx-auto mb-5 flex max-w-6xl items-center justify-between">
        <Link to="/booth" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
          <ArrowLeft size={18} /> Back
        </Link>
        <h1 className="text-lg font-bold sm:text-xl">Partnership Profitability Calculator</h1>
        <div className="flex gap-2">
          <button onClick={loadDemo} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10">
            <Wand2 size={15} /> Demo
          </button>
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10">
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Inputs */}
        <div className="glass-card p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CALCULATOR_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-sm font-medium text-white/70">
                  {f.label}
                  {f.optional && <span className="ml-1 text-white/30">(optional)</span>}
                </label>
                <div className="relative">
                  {f.type === "currency" && (
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-white/40">₹</span>
                  )}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={values[f.key] === "" ? "" : String(values[f.key])}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder="0"
                    className={`glass-input ${f.type === "currency" ? "pl-9" : ""} ${f.type === "percent" ? "pr-10" : ""}`}
                  />
                  {f.type === "percent" && (
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-white/40">%</span>
                  )}
                </div>
                {f.hint && <p className="mt-1 text-xs text-white/30">{f.hint}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="glass-card flex flex-col gap-5 p-5 sm:p-6">
          {/* Score */}
          <div className="flex items-center gap-5">
            <div style={{ color: scoreColor(result.score || null) }}>
              <ScoreRing value={result.revenue > 0 ? result.score : null} size={128} />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm text-white/50">
                <Trophy size={16} className="text-amber-300" /> Partnership Score
              </p>
              <p className="text-3xl font-black">{result.status}</p>
              <p className="mt-1 text-sm text-white/50">
                Margin: <b className="text-white/80">{result.margin.toFixed(1)}%</b>
              </p>
            </div>
          </div>

          {/* Result cards */}
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-white/40">{c.label}</p>
                <p className={`mt-1 text-2xl font-bold ${c.accent}`}>{formatCurrency(c.value)}</p>
              </div>
            ))}
          </div>

          {/* Cost breakdown bar */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">Cost breakdown</p>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
              {BREAKDOWN.map((b) => {
                const v = (result as any)[b.key] as number;
                const pct = (v / totalForBar) * 100;
                return pct > 0 ? (
                  <div key={b.key} style={{ width: `${pct}%`, backgroundColor: b.color }} title={`${b.label}: ${formatCurrency(v)}`} />
                ) : null;
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
              {BREAKDOWN.map((b) => (
                <span key={b.key} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {result.retainerTotal > 0 && (
            <p className="-mt-1 text-sm text-white/50">
              Recurring:{" "}
              <b className="text-white/80">
                {formatCurrency(result.monthlyRetainer)}/mo × {result.durationMonths} ={" "}
                {formatCurrency(result.retainerTotal)}
              </b>
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-3">
            <p className="text-sm text-white/50">
              Monthly profit: <b className="text-white/80">{formatCurrency(result.monthlyProfit)}</b>
            </p>
            {saved ? (
              <span className="text-sm font-medium text-emerald-300">Saved ✓</span>
            ) : (
              <button
                onClick={() => setShowLead(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:opacity-90"
              >
                <Send size={16} /> Get my report
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lead modal */}
      {showLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Get your report</h3>
              <button onClick={() => setShowLead(false)} className="text-white/50 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveLead(); }} className="space-y-3">
              {[
                ["name", "Name *", true],
                ["company", "Company", false],
                ["email", "Email *", true],
                ["phone", "Phone", false],
              ].map(([key, label, req]) => (
                <input
                  key={key as string}
                  type={key === "email" ? "email" : "text"}
                  required={req as boolean}
                  placeholder={label as string}
                  value={(lead as any)[key as string]}
                  onChange={(e) => setLead({ ...lead, [key as string]: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-emerald-400 focus:outline-none"
                />
              ))}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 py-3 text-sm font-semibold text-slate-900 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />} Submit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
