import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { publicApi } from "../lib/api-client";

// Dark-themed "already filled the form?" matcher for the game pages. Looks up a
// lead by name / email / mobile and hands back its play token so the visitor's
// results reach the email they gave — no need to re-enter it.
export function FindEntry({ onFound }: { onFound: (token: string, name: string) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const find = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await publicApi.findSession(q.trim());
      if (data?.match?.token) onFound(data.match.token, data.match.name || "");
      else setMsg("No match found — enter your details below instead.");
    } catch {
      setMsg("Lookup failed — enter your details below.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-slate-400">Already filled the form? Link your entry</p>
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3">
        <Search size={15} className="text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && find()}
          placeholder="Your name, email or mobile"
          className="w-full bg-transparent py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none"
        />
        <button
          onClick={find}
          disabled={busy || q.trim().length < 2}
          className="shrink-0 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : "Find"}
        </button>
      </div>
      {msg && <p className="mt-1.5 text-xs text-amber-400">{msg}</p>}
    </div>
  );
}
