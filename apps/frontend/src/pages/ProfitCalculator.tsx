import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calculator, Loader2, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import { publicApi } from "../lib/api-client";
import { computeProfit, inr } from "../lib/profit-calc";

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
        playToken: token,
      }),
    onSuccess: (res: any) => {
      setEmailed(Boolean(res?.data?.emailed));
      setDone(true);
    },
  });

  const canSubmit = num("revenue") > 0;
  const profitable = results.profit >= 0;

  const Row = ({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: "good" | "bad" }) => (
    <div className={`flex items-center justify-between ${strong ? "border-t border-slate-200 pt-2" : ""}`}>
      <span className={`text-sm ${strong ? "font-semibold text-gray-900" : "text-gray-500"}`}>{label}</span>
      <span
        className={`font-semibold ${strong ? "text-base" : "text-sm"} ${
          tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-gray-800"
        }`}
      >
        {inr(value)}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-emerald-950 p-4">
      <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2">
        {/* Inputs */}
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Calculator size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Profitability Calculator</h1>
              <p className="text-xs text-gray-500">
                {session.data?.visitor.company ? `${session.data.visitor.company} · ` : ""}enter your numbers
              </p>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            {(["month", "year"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  period === p ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500"
                }`}
              >
                Per {p}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
                <div className="flex items-center rounded-lg border border-gray-300 px-3 focus-within:border-emerald-500">
                  <span className="text-sm text-gray-400">₹</span>
                  <input
                    value={vals[f.key]}
                    onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d.]/g, "") }))}
                    inputMode="numeric"
                    placeholder="0"
                    className="w-full bg-transparent px-2 py-2.5 text-sm focus:outline-none"
                  />
                </div>
              </div>
            ))}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tax rate (%)</label>
              <input
                value={taxRatePct}
                onChange={(e) => setTaxRatePct(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="numeric"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Your P&amp;L ({period})</h2>
            {profitable ? <TrendingUp className="text-emerald-500" size={18} /> : <TrendingDown className="text-rose-500" size={18} />}
          </div>

          <div className="space-y-2.5">
            <Row label="Revenue" value={results.revenue} />
            <Row label="Employee cost" value={results.employeeCost} />
            <Row label="Operation cost" value={results.operationCost} />
            <Row label="Marketing & BD cost" value={results.marketingBdCost} />
            <Row label="Gross profit" value={results.grossProfit} strong tone={results.grossProfit >= 0 ? "good" : "bad"} />
            <Row label="Net tax" value={results.netTax} />
            <Row label="Net profit" value={results.profit} strong tone={profitable ? "good" : "bad"} />
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-center">
            <span className="text-xs text-gray-500">Net margin</span>
            <p className={`text-2xl font-black ${profitable ? "text-emerald-600" : "text-rose-600"}`}>
              {results.profitMarginPct}%
            </p>
          </div>

          {done ? (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={16} /> {emailed ? "Sent to your email + our stall screen!" : "Saved to our stall screen!"}
            </div>
          ) : (
            <button
              onClick={() => submit.mutate()}
              disabled={!canSubmit || submit.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Email me these results
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
