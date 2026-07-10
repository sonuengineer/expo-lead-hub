import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Flame, Loader2, Globe, QrCode as QrIcon, UserPlus, CheckCircle2, X } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api-client";
import { RoastReport, type Analysis } from "../components/RoastReport";
import { QrImage } from "../components/QrImage";

export function WebsiteRoastPage() {
  const [url, setUrl] = useState("");
  const [eventId, setEventId] = useState("");
  const [boothId, setBoothId] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [showLead, setShowLead] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [queuePos, setQueuePos] = useState(0);
  const [lead, setLead] = useState({ name: "", company: "", email: "", phone: "", designation: "", consent: false });

  const { data: eventsData } = useQuery({
    queryKey: ["events-filter"],
    queryFn: async () => (await api.events.list({ take: 100 })).data,
  });
  const events: { id: string; name: string }[] = eventsData?.events ?? [];

  const { data: eventDetail } = useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: async () => (await api.events.get(eventId)).data,
    enabled: !!eventId,
  });
  const booths = eventDetail?.event?.booths ?? [];

  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0]!.id);
  }, [events, eventId]);
  useEffect(() => {
    if (eventId && !boothId && booths.length) setBoothId(booths[0].id);
  }, [eventId, booths, boothId]);

  const roastMutation = useMutation({
    mutationFn: () =>
      api.ai.roast({ url, eventId: eventId || undefined, boothId: boothId || undefined }),
    onSuccess: (res: any) => {
      setAnalysis(null);
      setLeadSaved(false);
      setPendingId(res.data.analysis.id);
      setQueuePos(res.data.queuePosition ?? 0);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? "Could not analyze that site. Check the URL and try again."),
  });

  // Poll the queued job until it's done.
  const { data: polled } = useQuery({
    queryKey: ["roast-poll", pendingId],
    queryFn: async () => (await api.ai.get(pendingId!)).data.analysis as Analysis & { status: string; error?: string },
    enabled: !!pendingId,
    refetchInterval: (q: any) => {
      const s = q.state.data?.status;
      return s === "COMPLETED" || s === "FAILED" ? false : 3000;
    },
  });

  useEffect(() => {
    if (!polled) return;
    if (polled.status === "COMPLETED") {
      setAnalysis(polled);
      setPendingId(null);
      toast.success("Roast ready 🔥");
    } else if (polled.status === "FAILED") {
      setPendingId(null);
      toast.error((polled as any).error || "Could not roast that site.");
    }
  }, [polled]);

  const busy = roastMutation.isPending || !!pendingId;

  const leadMutation = useMutation({
    mutationFn: () =>
      api.ai.saveLead(analysis!.id, { ...lead, eventId: eventId || undefined, boothId: boothId || undefined }),
    onSuccess: () => {
      setLeadSaved(true);
      setShowLead(false);
      toast.success("Lead saved to your event 🎉");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not save lead"),
  });

  const reportUrl = analysis ? `${window.location.origin}/ai/report/${analysis.id}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Flame className="text-orange-500" /> Website Roast
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter a visitor's website — we screenshot it, run a real Lighthouse audit, and the AI roasts &amp; audits it.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Website URL</label>
            <div className="relative">
              <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && url && !busy && roastMutation.mutate()}
                placeholder="https://company.com"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Event</label>
            <select value={eventId} onChange={(e) => { setEventId(e.target.value); setBoothId(""); }} className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none">
              <option value="">—</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Booth</label>
            <select value={boothId} onChange={(e) => setBoothId(e.target.value)} disabled={!eventId} className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50">
              <option value="">—</option>
              {booths.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button
            onClick={() => roastMutation.mutate()}
            disabled={!url || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Flame size={16} />}
            {busy ? "Roasting…" : "🔥 Roast My Website"}
          </button>
        </div>
        {busy && (
          <p className="mt-3 text-sm text-gray-400">
            {polled?.status === "PROCESSING"
              ? "Capturing the site + AI roast… this can take up to a minute."
              : queuePos > 0
                ? `In queue (position ${queuePos})… your roast will start shortly.`
                : "Queued — starting…"}
          </p>
        )}
      </div>

      {/* Result */}
      {analysis && (
        <>
          {/* Lead capture + QR bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <QrImage value={reportUrl} size={96} />
              <div>
                <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                  <QrIcon size={16} /> Scan to open this report
                </p>
                <a href={reportUrl} target="_blank" className="text-xs text-indigo-600 hover:underline">
                  {reportUrl}
                </a>
              </div>
            </div>
            {leadSaved ? (
              <span className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                <CheckCircle2 size={16} /> Lead captured
              </span>
            ) : (
              <button
                onClick={() => setShowLead(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <UserPlus size={16} /> Capture as lead
              </button>
            )}
          </div>

          <RoastReport analysis={analysis} />
        </>
      )}

      {/* Lead modal */}
      {showLead && analysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Get your full report</h3>
              <button onClick={() => setShowLead(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); leadMutation.mutate(); }}
              className="space-y-3"
            >
              {[
                ["name", "Name *", true],
                ["company", "Company", false],
                ["email", "Email *", true],
                ["phone", "Phone", false],
                ["designation", "Designation", false],
              ].map(([key, label, required]) => (
                <div key={key as string}>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{label as string}</label>
                  <input
                    type={key === "email" ? "email" : "text"}
                    required={required as boolean}
                    value={(lead as any)[key as string]}
                    onChange={(e) => setLead({ ...lead, [key as string]: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
              <label className="flex items-start gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={lead.consent} onChange={(e) => setLead({ ...lead, consent: e.target.checked })} className="mt-0.5 h-4 w-4 rounded text-indigo-600" />
                I agree to be contacted about my website report.
              </label>
              <button
                type="submit"
                disabled={leadMutation.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {leadMutation.isPending && <Loader2 size={16} className="animate-spin" />} Save &amp; continue
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
