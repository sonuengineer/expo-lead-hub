// Mirrors the backend profit-calc.service for a live UI preview. The server
// recomputes authoritatively on submit.

export const RATH_FEE_PER_CLIENT = 35000;

export interface ProfitInputs {
  clients: number;
  avgRetainer: number;
  employeeCost: number;
  operationalCost: number;
  miscCost: number;
  rathFeePerClient: number;
  period: "month" | "year";
}

export interface ProfitResults {
  clients: number;
  revenue: number;
  rathCharges: number;
  internalExpenses: number;
  totalExpenses: number;
  profit: number;
  isLoss: boolean;
}

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

export function computeProfit(input: Partial<ProfitInputs>): ProfitResults {
  const clients = n(input.clients);
  const avgRetainer = n(input.avgRetainer);
  const employeeCost = n(input.employeeCost);
  const operationalCost = n(input.operationalCost);
  const miscCost = n(input.miscCost);
  const fee = n(input.rathFeePerClient); // entered manually — no default
  const mult = input.period === "year" ? 12 : 1;

  const revenue = clients * avgRetainer;
  const rathCharges = clients * fee;
  const internalExpenses = employeeCost + operationalCost + miscCost;
  const totalExpenses = internalExpenses + rathCharges;
  const raw = revenue - totalExpenses;
  const isLoss = raw < 0;

  return {
    clients,
    revenue: Math.round(revenue * mult),
    rathCharges: Math.round(rathCharges * mult),
    internalExpenses: Math.round(internalExpenses * mult),
    totalExpenses: Math.round(totalExpenses * mult),
    profit: Math.max(0, Math.round(raw * mult)),
    isLoss,
  };
}

export function inr(v: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(v));
}
