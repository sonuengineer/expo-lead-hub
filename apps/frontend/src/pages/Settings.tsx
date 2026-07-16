import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, ShieldCheck, PlugZap, Save, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api-client";

export const OWNER_EMAIL = "sonu.prajapati@rathinfotech.com";

interface Setting {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  type: "text" | "select";
  options?: string[];
  configured: boolean;
  source: "portal" | "env" | "none";
  display: string;
}

const INTEGRATION_OF: Record<string, string> = {
  Gemini: "gemini",
  PageSpeed: "pagespeed",
  DataForSEO: "dataforseo",
  Email: "email",
  WhatsApp: "whatsapp",
};
function integrationFor(group: string): string {
  const hit = Object.keys(INTEGRATION_OF).find((k) => group.includes(k));
  return hit ? INTEGRATION_OF[hit]! : "";
}

// Where to sign in / create each key.
const HELP_LINK: Record<string, { url: string; label: string }> = {
  gemini: { url: "https://aistudio.google.com/app/apikey", label: "Get a Gemini key" },
  pagespeed: { url: "https://console.cloud.google.com/apis/credentials", label: "Get a PageSpeed key" },
  dataforseo: { url: "https://app.dataforseo.com/api-access", label: "DataForSEO account" },
  email: { url: "https://resend.com/api-keys", label: "Resend API keys" },
  whatsapp: { url: "https://docs.openwa.dev/", label: "OpenWA docs" },
};

export function SettingsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.settings.get()).data,
  });
  const settings: Setting[] = data?.settings ?? [];

  const balance = useQuery({
    queryKey: ["df-balance"],
    queryFn: async () => (await api.settings.dataforseoBalance()).data as { balance: number | null; currency: string },
  });

  // Form holds only *edited* values. Secrets start blank (masked); non-secrets
  // pre-fill their current value so admins can tweak in place.
  const [form, setForm] = useState<Record<string, string>>({});
  const val = (s: Setting) => (form[s.key] !== undefined ? form[s.key]! : s.secret ? "" : s.display);
  const set = (key: string, v: string) => setForm((f) => ({ ...f, [key]: v }));

  const groups = useMemo(() => {
    const g: Record<string, Setting[]> = {};
    for (const s of settings) (g[s.group] ??= []).push(s);
    return g;
  }, [settings]);

  const save = useMutation({
    mutationFn: () => {
      const updates: Record<string, string> = {};
      for (const s of settings) {
        const v = form[s.key];
        if (v === undefined) continue; // untouched
        // For secrets, an empty box means "leave unchanged" (use Clear to wipe).
        if (s.secret && v === "") continue;
        updates[s.key] = v;
      }
      return api.settings.save(updates);
    },
    onSuccess: async () => {
      // Which integrations had changed keys — auto-test them so you know they work.
      const changed = new Set<string>();
      for (const key of Object.keys(form)) {
        const s = settings.find((x) => x.key === key);
        const ig = s ? integrationFor(s.group) : "";
        if (ig) changed.add(ig);
      }
      toast.success("Settings saved");
      setForm({});
      refetch();
      balance.refetch();
      await Promise.all(
        [...changed].map(async (ig) => {
          const t = toast.loading(`Testing ${ig}…`);
          try {
            const { data: r } = await api.settings.test(ig);
            toast.success(`✓ ${ig}: ${r?.detail ?? "working"}`, { id: t });
          } catch (e: any) {
            toast.error(`✗ ${ig}: ${e?.response?.data?.message ?? "test failed"}`, { id: t });
          }
        }),
      );
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Save failed"),
  });

  const clearOne = useMutation({
    mutationFn: (key: string) => api.settings.save({ [key]: "" }),
    onSuccess: () => {
      toast.success("Cleared (using server default)");
      setForm({});
      refetch();
    },
    onError: () => toast.error("Failed"),
  });

  const test = useMutation({
    mutationFn: (integration: string) => api.settings.test(integration),
    onSuccess: (res: any) => toast.success(res?.data?.detail ?? "OK"),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Test failed"),
  });

  const input =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  const badge = (s: Setting) =>
    s.source === "portal" ? (
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">Portal override</span>
    ) : s.source === "env" ? (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">From server</span>
    ) : (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Not set</span>
    );

  if (isLoading) return <p className="text-gray-500">Loading settings…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ShieldCheck className="text-indigo-600" size={24} /> Integration Settings
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Add or switch API keys live — changes take effect immediately, no redeploy. Leaving a key blank falls back
          to the server's environment value.
        </p>
      </div>

      {Object.entries(groups).map(([group, items]) => {
        const integration = integrationFor(group);
        return (
          <div key={group} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-gray-900">{group}</h3>
                {group.includes("DataForSEO") && balance.data?.balance != null && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    Balance: ${balance.data.balance.toFixed(2)} {balance.data.currency}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {integration && HELP_LINK[integration] && (
                  <a
                    href={HELP_LINK[integration]!.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                  >
                    {HELP_LINK[integration]!.label}
                    <ExternalLink size={12} />
                  </a>
                )}
                {integration && (
                  <button
                    onClick={() => test.mutate(integration)}
                    disabled={test.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {test.isPending && test.variables === integration ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <PlugZap size={13} />
                    )}
                    Test
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {items.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">{s.label}</label>
                    <div className="flex items-center gap-2">
                      {badge(s)}
                      {s.source === "portal" && (
                        <button onClick={() => clearOne.mutate(s.key)} className="text-[11px] text-gray-400 hover:text-red-600">
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {s.type === "select" ? (
                    <select value={val(s)} onChange={(e) => set(s.key, e.target.value)} className={input}>
                      {(s.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={val(s)}
                      onChange={(e) => set(s.key, e.target.value)}
                      type={s.secret ? "password" : "text"}
                      placeholder={s.secret ? (s.display ? `${s.display} — leave blank to keep` : "Not set") : ""}
                      autoComplete="new-password"
                      className={input}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || Object.keys(form).length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save changes
        </button>
      </div>
    </div>
  );
}
