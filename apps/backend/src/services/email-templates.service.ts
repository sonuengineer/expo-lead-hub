import { settingWithDefault } from "./settings.service";

// Renders the DB-editable result-email templates (Settings → Email templates).
// Placeholders look like {clients}; unknown ones render as empty. The signature
// (also editable) is appended so it lands as the final block for textToHtml.

function render(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

function withSignature(body: string): string {
  return `${body.trim()}\n\n${settingWithDefault("EMAIL_SIGNATURE")}`;
}

export interface CalcVars {
  [k: string]: string | number;
  period: string; // "monthly" | "yearly"
  clients: string | number;
  revenue: string;
  rathCharges: string;
  internalExpenses: string;
  profit: string;
}

export function buildCalcEmail(vars: CalcVars): string {
  return withSignature(render(settingWithDefault("EMAIL_CALC_TEMPLATE"), vars));
}

export interface ReportVars {
  [k: string]: string | number;
  yourScore: string | number;
  competitorScore: string | number;
  reasoning: string;
  da: string;
  pa: string;
  referringDomains: string;
  backlinks: string;
  keywords: string;
  traffic: string;
  reportLink: string;
}

export function buildReportEmail(vars: ReportVars): string {
  return withSignature(render(settingWithDefault("EMAIL_REPORT_TEMPLATE"), vars));
}
