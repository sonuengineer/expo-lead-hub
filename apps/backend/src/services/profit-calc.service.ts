// Agency Partnership Profitability Calculator (booth Game 2).
// Shows an agency how profitable it is to partner with Rath Infotech vs running
// an in-house team. All monthly figures. Server-computed so the emailed/TV
// numbers can't be spoofed. Never surfaces a negative — a loss shows as ₹0.

// Rath Infotech's fee per client managed (₹).
export const RATH_FEE_PER_CLIENT = 35000;

export interface ProfitInputs {
  clients: number;
  avgRetainer: number; // average monthly retainer per client
  employeeCost: number;
  operationalCost: number;
  miscCost: number;
  rathFeePerClient: number; // editable; defaults to RATH_FEE_PER_CLIENT
  period: "month" | "year"; // figures are scaled ×12 for "year"
}

export interface ProfitResults {
  clients: number;
  revenue: number; // clients × retainer
  rathCharges: number; // clients × RATH_FEE_PER_CLIENT
  internalExpenses: number; // employee + operational + misc
  totalExpenses: number; // internal + rath charges
  profit: number; // revenue − total expenses (never negative)
  isLoss: boolean; // true when the raw profit was < 0
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
  const mult = input.period === "year" ? 12 : 1; // monthly figures scaled for yearly

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

// Indian-rupee formatting for the email/report.
export function inr(v: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(v));
}
