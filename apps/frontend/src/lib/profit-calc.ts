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

  return { revenue, employeeCost, operationCost, marketingBdCost, totalCost, grossProfit, netTax, profit, profitMarginPct };
}

export function inr(v: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(v));
}
