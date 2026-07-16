// Profitability Calculator (booth Game 2). Simple, authoritative P&L math the
// server computes so the emailed report + TV display can't be spoofed by the
// client. All figures share one period (e.g. monthly) — the UI labels it.

export interface ProfitInputs {
  revenue: number;
  employeeCost: number;
  operationCost: number;
  marketingBdCost: number;
  taxRatePct: number; // e.g. 25 for 25%
}

export interface ProfitResults {
  revenue: number;
  employeeCost: number;
  operationCost: number;
  marketingBdCost: number;
  totalCost: number;
  grossProfit: number; // revenue − operating costs (never negative — see isLoss)
  netTax: number; // tax on gross profit (0 when a loss)
  profit: number; // net profit after tax (never negative)
  profitMarginPct: number; // 0 when a loss
  isLoss: boolean; // true when raw profit < 0 (internal — we still show 0 to clients)
  score: number; // 0..100 gamified score from margin
  status: string; // positive label: Excellent / Good / Healthy / Break Even
}

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

export function computeProfit(input: Partial<ProfitInputs>): ProfitResults {
  const revenue = n(input.revenue);
  const employeeCost = n(input.employeeCost);
  const operationCost = n(input.operationCost);
  const marketingBdCost = n(input.marketingBdCost);
  const taxRatePct = Math.min(100, n(input.taxRatePct));

  const totalCost = employeeCost + operationCost + marketingBdCost;

  // Client-friendly rule (from the old calculator): never surface a negative.
  // Clamp losses to 0 and label them "Break Even" instead of showing red numbers.
  const rawGross = revenue - totalCost;
  const isLoss = rawGross < 0;
  const grossProfit = Math.max(0, rawGross);
  const netTax = grossProfit > 0 ? Math.round((grossProfit * taxRatePct) / 100) : 0;
  const profit = Math.max(0, grossProfit - netTax);
  const profitMarginPct = revenue > 0 && !isLoss ? Math.round((profit / revenue) * 1000) / 10 : 0;

  const score = revenue > 0 && !isLoss ? Math.round(Math.min(100, profitMarginPct * 2.2)) : 0;
  let status = "Break Even";
  if (revenue > 0 && !isLoss) {
    if (profitMarginPct >= 40) status = "Excellent";
    else if (profitMarginPct >= 25) status = "Good";
    else if (profitMarginPct >= 10) status = "Healthy";
    else status = "Break Even";
  }

  return {
    revenue,
    employeeCost,
    operationCost,
    marketingBdCost,
    totalCost,
    grossProfit,
    netTax,
    profit,
    profitMarginPct,
    isLoss,
    score,
    status,
  };
}

// Indian-rupee formatting for the email/report.
export function inr(v: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(v));
}
