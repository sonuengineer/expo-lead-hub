// Mirrors the backend profit-calc.service so the UI can show a live preview as
// the visitor types. The server recomputes authoritatively on submit.

export interface ProfitInputs {
  revenue: number;
  employeeCost: number;
  operationCost: number;
  marketingBdCost: number;
  taxRatePct: number;
}

export interface ProfitResults {
  revenue: number;
  employeeCost: number;
  operationCost: number;
  marketingBdCost: number;
  totalCost: number;
  grossProfit: number;
  netTax: number;
  profit: number;
  profitMarginPct: number;
  isLoss: boolean;
  score: number;
  status: string;
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

  // Never show a negative to the client — clamp losses to 0 and call it "Break Even".
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

export function inr(v: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(v));
}
