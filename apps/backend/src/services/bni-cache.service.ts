import { prisma } from "@elc/db";

// The BNI directory (~2,600 rows) is tiny and read-only during an event, but the
// Supabase project is far (region latency) so a DB round-trip on every typeahead
// keystroke feels slow. We load the whole directory into memory once and search
// in-process — lookups become instant. Refreshed lazily every REFRESH_MS.

export interface BniLite {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  phoneE164: string | null;
  website: string | null;
  chapter: string | null;
  region: string | null;
}

const REFRESH_MS = 10 * 60 * 1000; // 10 minutes
let cache: BniLite[] = [];
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  const fresh = cache.length > 0 && Date.now() - loadedAt < REFRESH_MS;
  if (fresh) return;
  if (loading) return loading; // coalesce concurrent loads
  loading = (async () => {
    const rows = await prisma.bniMember.findMany({
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        phoneE164: true,
        website: true,
        chapter: true,
        region: true,
      },
    });
    cache = rows;
    loadedAt = Date.now();
  })()
    .catch((e) => {
      // Keep any stale cache on failure; just log.
      console.error("BNI cache load failed:", e);
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export async function searchBni(q: string, limit = 8): Promise<BniLite[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  await ensureLoaded();

  const lower = query.toLowerCase();
  const digits = query.replace(/\D/g, "");
  const byDigits = digits.length >= 4 ? digits.slice(-10) : "";

  const out: BniLite[] = [];
  for (const m of cache) {
    const nameHit = m.name.toLowerCase().includes(lower);
    const emailHit = (m.email ?? "").toLowerCase().includes(lower);
    const phoneHit = byDigits && (m.phoneE164 ?? "").includes(byDigits);
    if (nameHit || emailHit || phoneHit) {
      out.push(m);
      if (out.length >= limit) break;
    }
  }
  return out;
}

// Exact-ish match by phone number (last 10 digits) — used to auto-enrich a
// scanned card or a phone-first entry. Returns the single best match, or null.
export async function lookupBniByPhone(phone: string): Promise<BniLite | null> {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  const last10 = digits.slice(-10);
  await ensureLoaded();
  for (const m of cache) {
    if ((m.phoneE164 ?? "").replace(/\D/g, "").endsWith(last10)) return m;
  }
  return null;
}

// Force a refresh (e.g. after re-importing the directory).
export function invalidateBniCache() {
  loadedAt = 0;
}
