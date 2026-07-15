import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { publicApi } from "../lib/api-client";
import { AuditProgress } from "../components/AuditProgress";
import { ScoreReport, type Comparison } from "../components/ScoreReport";

interface PlaySession {
  visitor: { name: string; company: string };
  event: { id: string; name: string };
}

export function PublicScoreGame() {
  const { token } = useParams<{ token: string }>();

  const [url, setUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [competitorUrl2, setCompetitorUrl2] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [queuePos, setQueuePos] = useState(0);
  const [analysis, setAnalysis] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session = useQuery({
    queryKey: ["play-session", token],
    queryFn: async () => (await publicApi.getPlaySession(token!)).data as PlaySession,
    enabled: !!token,
    retry: false,
  });

  const start = useMutation({
    mutationFn: () =>
      publicApi.submitScore({ url, competitorUrl, competitorUrl2: competitorUrl2.trim() || undefined, playToken: token }),
    onSuccess: (res: any) => {
      setAnalysis(null);
      setError(null);
      setPendingId(res.data.analysisId);
      setQueuePos(res.data.queuePosition ?? 0);
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? "Could not start the analysis. Check the URLs."),
  });

  const { data: polled } = useQuery({
    queryKey: ["public-score-poll", pendingId],
    queryFn: async () => (await publicApi.getAnalysis(pendingId!)).data.analysis,
    enabled: !!pendingId,
    refetchInterval: (query: any) => {
      const s = query.state.data?.status;
      return s === "COMPLETED" || s === "FAILED" ? false : 3000;
    },
  });

  useEffect(() => {
    if (!polled) return;
    if (polled.status === "COMPLETED") {
      setAnalysis(polled);
      setPendingId(null);
    } else if (polled.status === "FAILED") {
      setPendingId(null);
      setError(polled.error || "Analysis failed. Please try again.");
    }
  }, [polled]);

  const busy = start.isPending || !!pendingId;
  const canStart = url.trim().length > 3 && competitorUrl.trim().length > 3;
  const company = session.data?.visitor.company || session.data?.visitor.name || "";

  if (busy) {
    return (
      <AuditProgress
        company={company}
        yourUrl={url}
        competitorUrl={competitorUrl}
        queuePosition={polled?.status === "PROCESSING" ? 0 : queuePos}
      />
    );
  }

  if (analysis) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="mx-auto max-w-4xl">
          <ScoreReport data={analysis} />
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAnalysis(null);
                setUrl("");
                setCompetitorUrl("");
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Run another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <Sparkles size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">AI Website Score</h1>
          <p className="mt-1 text-sm text-gray-500">
            {session.data?.visitor.name ? `${session.data.visitor.name}, see ` : "See "}
            how your site stacks up against a competitor — in under 90 seconds.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Your website</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yourcompany.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Competitor website</label>
            <input
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              placeholder="competitor.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              2nd competitor <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              value={competitorUrl2}
              onChange={(e) => setCompetitorUrl2(e.target.value)}
              placeholder="another-competitor.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => start.mutate()}
            disabled={!canStart || start.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {start.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Analyze my website
          </button>
        </div>
      </div>
    </div>
  );
}
