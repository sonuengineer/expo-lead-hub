// Minimal in-memory TTL cache. Used to avoid repeated Postgres round-trips on
// hot public paths (e.g. form definitions per event, which change rarely).
// Single-process only — fine behind one instance, and consistent with the
// dashboard's existing in-memory cache pattern.
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}
