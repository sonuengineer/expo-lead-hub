// Config-driven Agency Partnership Profitability Calculator.
// The field list IS the "dynamic form" — add/remove/reorder inputs here.

export type FieldType = "currency" | "percent" | "number";

export interface CalcField {
  key: string;
  label: string;
  type: FieldType;
  demo: number; // value used by "Load Demo Data"
  hint?: string;
  optional?: boolean;
}

export const CALCULATOR_FIELDS: CalcField[] = [
  { key: "projectValue", label: "Project Value", type: "currency", demo: 1000000, hint: "Total deal size" },
  { key: "partnerSharePct", label: "Partner Share", type: "percent", demo: 30, hint: "% paid to the partner agency" },
  { key: "yourCost", label: "Your Estimated Cost", type: "currency", demo: 200000, hint: "Your delivery cost" },
  { key: "otherExpenses", label: "Other Expenses", type: "currency", demo: 40000, optional: true },
  { key: "discountPct", label: "Discount Given", type: "percent", demo: 0, optional: true, hint: "% off the project value" },
  { key: "overheadPct", label: "Overhead", type: "percent", demo: 6, optional: true, hint: "% of revenue for overhead" },
  { key: "durationMonths", label: "Project Duration", type: "number", demo: 4, optional: true, hint: "Months" },
  { key: "numProjects", label: "Deals / Year", type: "number", demo: 6, optional: true, hint: "Repeat volume" },
];

export type CalcValues = Record<string, number | "">;

export interface CalcResult {
  revenue: number;
  partnerPayment: number;
  yourCost: number;
  otherExpenses: number;
  overhead: number;
  totalCost: number;
  profit: number; // never negative
  isLoss: boolean; // true when raw profit < 0
  margin: number; // % of revenue (0 when loss)
  monthlyProfit: number;
  annualProfit: number;
  score: number; // 0..100
  status: string;
}

// Coerce anything to a safe non-negative number (empty/invalid/negative → 0).
function n(v: unknown): number {
  const num = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!isFinite(num) || isNaN(num) || num < 0) return 0;
  return num;
}

export function calculate(values: CalcValues): CalcResult {
  const projectValue = n(values.projectValue);
  const partnerSharePct = Math.min(100, n(values.partnerSharePct));
  const yourCost = n(values.yourCost);
  const otherExpenses = n(values.otherExpenses);
  const discountPct = Math.min(100, n(values.discountPct));
  const overheadPct = Math.min(100, n(values.overheadPct));
  const durationMonths = n(values.durationMonths);
  const numProjects = n(values.numProjects);

  const revenue = projectValue * (1 - discountPct / 100);
  const partnerPayment = revenue * (partnerSharePct / 100);
  const overhead = revenue * (overheadPct / 100);
  const totalCost = partnerPayment + yourCost + otherExpenses + overhead;

  const rawProfit = revenue - totalCost;
  const isLoss = rawProfit < 0;
  const profit = Math.max(0, rawProfit);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const monthlyProfit = profit / Math.max(1, durationMonths);
  const annualProfit = profit * Math.max(1, numProjects || 1);

  // Score from margin (clamped 0–100), only when there's real revenue & profit.
  let score = 0;
  if (revenue > 0 && !isLoss) {
    score = Math.round(Math.min(100, margin * 2.2));
  }

  let status = "Break Even";
  if (!isLoss && revenue > 0) {
    if (margin >= 40) status = "Excellent Partnership";
    else if (margin >= 25) status = "Good Partnership";
    else if (margin >= 10) status = "Healthy Partnership";
    else status = "Break Even";
  }

  return {
    revenue,
    partnerPayment,
    yourCost,
    otherExpenses,
    overhead,
    totalCost,
    profit,
    isLoss,
    margin,
    monthlyProfit,
    annualProfit,
    score,
    status,
  };
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatCurrency(v: number): string {
  return `₹${inr.format(Math.round(v))}`;
}
