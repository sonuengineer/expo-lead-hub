import axios from "axios";
import { env } from "../config/env";

// Domain-level SEO metrics for the AI Score game. These describe the whole
// domain (not just the homepage): DA/PA-style authority ranks + keyword data.
// Every call is wrapped so a failure degrades to null rather than failing the
// analysis — the booth must never hang on a slow/paid API.
export interface DomainMetrics {
  da: number | null; // domain rank 0-1000 (DataForSEO), ~ Domain Authority
  pa: number | null; // page rank 0-1000 for the submitted URL, ~ Page Authority
  keywordCount: number | null; // organic keywords the domain ranks for
  organicTraffic: number | null; // estimated traffic value (etv)
  referringDomains: number | null; // unique domains linking to this site
  backlinks: number | null; // total backlinks
  topKeywords: string[]; // a few example ranking keywords
}

export interface CompetitorLite {
  domain: string;
  sharedKeywords: number | null;
}

const EMPTY: DomainMetrics = {
  da: null,
  pa: null,
  keywordCount: null,
  organicTraffic: null,
  referringDomains: null,
  backlinks: null,
  topKeywords: [],
};

function authHeader(): string {
  return "Basic " + Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString("base64");
}

async function post(path: string, body: unknown, timeout = 20_000): Promise<any> {
  const { data } = await axios.post(`https://api.dataforseo.com/v3/${path}`, body, {
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    timeout,
  });
  return data;
}

// Strip to a bare hostname (no scheme, no path, no www).
function toDomain(url: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]!;
  }
}

// DA (domain) + PA (page) via one Backlinks bulk_ranks call.
async function fetchRanks(domain: string, url: string): Promise<{ da: number | null; pa: number | null }> {
  try {
    const data = await post("backlinks/bulk_ranks/live", [{ targets: [domain, url] }]);
    const items: any[] = data?.tasks?.[0]?.result?.[0]?.items ?? [];
    const byTarget = (t: string) =>
      items.find((i) => (i?.target ?? "").replace(/^www\./i, "") === t.replace(/^www\./i, ""));
    const daItem = byTarget(domain);
    const paItem = items.find((i) => (i?.target ?? "").includes(url.replace(/^https?:\/\//i, ""))) ?? byTarget(url);
    const num = (v: any) => (typeof v === "number" ? Math.round(v) : null);
    return { da: num(daItem?.rank), pa: num(paItem?.rank) };
  } catch (e) {
    console.warn("[dataforseo] bulk_ranks failed:", (e as Error).message);
    return { da: null, pa: null };
  }
}

// Organic keyword count + traffic value via Labs domain_rank_overview.
async function fetchKeywordOverview(domain: string): Promise<{ keywordCount: number | null; organicTraffic: number | null }> {
  try {
    const data = await post("dataforseo_labs/google/domain_rank_overview/live", [
      { target: domain, location_code: env.DATAFORSEO_LOCATION_CODE, language_code: env.DATAFORSEO_LANGUAGE_CODE },
    ]);
    const organic = data?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic ?? {};
    const num = (v: any) => (typeof v === "number" ? Math.round(v) : null);
    return { keywordCount: num(organic.count), organicTraffic: num(organic.etv) };
  } catch (e) {
    console.warn("[dataforseo] domain_rank_overview failed:", (e as Error).message);
    return { keywordCount: null, organicTraffic: null };
  }
}

// Referring domains + total backlinks via Backlinks summary.
async function fetchBacklinks(domain: string): Promise<{ referringDomains: number | null; backlinks: number | null }> {
  try {
    const data = await post("backlinks/summary/live", [
      { target: domain, internal_list_limit: 1, backlinks_status_type: "live" },
    ]);
    const r = data?.tasks?.[0]?.result?.[0] ?? {};
    const num = (v: any) => (typeof v === "number" ? v : null);
    return { referringDomains: num(r.referring_domains), backlinks: num(r.backlinks) };
  } catch (e) {
    console.warn("[dataforseo] backlinks summary failed:", (e as Error).message);
    return { referringDomains: null, backlinks: null };
  }
}

// Top organic competitors (by shared keywords) via Labs competitors_domain.
// Filters out the site itself and obvious non-competitors (social/directories).
const NON_COMPETITORS = /(facebook|instagram|linkedin|twitter|x|youtube|pinterest|justdial|indiamart|wikipedia|google|amazon)\./i;
export async function fetchCompetitors(domain: string, limit = 5): Promise<CompetitorLite[]> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) return [];
  try {
    const data = await post("dataforseo_labs/google/competitors_domain/live", [
      { target: domain, location_code: env.DATAFORSEO_LOCATION_CODE, language_code: env.DATAFORSEO_LANGUAGE_CODE, limit: limit + 6 },
    ]);
    const items: any[] = data?.tasks?.[0]?.result?.[0]?.items ?? [];
    const self = domain.replace(/^www\./, "");
    return items
      .map((i) => ({ domain: String(i?.domain ?? ""), sharedKeywords: typeof i?.intersections === "number" ? i.intersections : null }))
      .filter((c) => c.domain && c.domain.replace(/^www\./, "") !== self && !NON_COMPETITORS.test(c.domain))
      .slice(0, limit);
  } catch (e) {
    console.warn("[dataforseo] competitors failed:", (e as Error).message);
    return [];
  }
}

// A few example ranking keywords via Labs ranked_keywords.
async function fetchTopKeywords(domain: string, limit = 10): Promise<string[]> {
  try {
    const data = await post("dataforseo_labs/google/ranked_keywords/live", [
      {
        target: domain,
        location_code: env.DATAFORSEO_LOCATION_CODE,
        language_code: env.DATAFORSEO_LANGUAGE_CODE,
        limit,
        order_by: ["ranked_serp_element.serp_item.rank_group,asc"],
      },
    ]);
    const items: any[] = data?.tasks?.[0]?.result?.[0]?.items ?? [];
    return items
      .map((i) => i?.keyword_data?.keyword)
      .filter((k): k is string => typeof k === "string" && k.length > 0)
      .slice(0, limit);
  } catch (e) {
    console.warn("[dataforseo] ranked_keywords failed:", (e as Error).message);
    return [];
  }
}

export async function fetchDomainMetrics(url: string): Promise<DomainMetrics> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) return EMPTY;
  const domain = toDomain(url);
  const [ranks, overview, backlinks, topKeywords] = await Promise.all([
    fetchRanks(domain, url),
    fetchKeywordOverview(domain),
    fetchBacklinks(domain),
    fetchTopKeywords(domain),
  ]);
  return { ...ranks, ...overview, ...backlinks, topKeywords };
}
