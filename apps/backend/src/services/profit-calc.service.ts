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
  grossProfit: number; // revenue − operating costs
  netTax: number; // tax on gross profit (0 when a loss)
  profit: number; // net profit after tax
  profitMarginPct: number;
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
  const grossProfit = revenue - totalCost;
  const netTax = grossProfit > 0 ? Math.round((grossProfit * taxRatePct) / 100) : 0;
  const profit = grossProfit - netTax;
  const profitMarginPct = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

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
  };
}

// Indian-rupee formatting for the email/report.
export function inr(v: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(v));
}
