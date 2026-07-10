import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ExternalLink, UserCheck } from "lucide-react";
import { api } from "../lib/api-client";
import { formatDate } from "../components/badges";

interface Row {
  id: string;
  url: string;
  title?: string | null;
  audit?: { overallScore?: number } | null;
  leadId?: string | null;
  createdAt: string;
}

function scoreColor(v?: number) {
  if (v == null) return "text-gray-400";
  if (v >= 90) return "text-green-600";
  if (v >= 50) return "text-amber-600";
  return "text-red-600";
}

export function AnalysisHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-history"],
    queryFn: async () => (await api.ai.history({ take: 50 })).data,
  });
  const items: Row[] = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analysis History</h2>
        <p className="mt-1 text-sm text-gray-500">{data?.total ?? 0} website roasts</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Website", "Overall", "Lead", "Date", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No roasts yet.</td></tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.title || r.url}</div>
                    <div className="text-xs text-gray-400">{r.url}</div>
                  </td>
                  <td className={`px-4 py-3 font-bold ${scoreColor(r.audit?.overallScore)}`}>
                    {r.audit?.overallScore ?? "–"}
                  </td>
                  <td className="px-4 py-3">
                    {r.leadId ? <UserCheck size={16} className="text-green-600" /> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/ai/report/${r.id}`} target="_blank" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                      Report <ExternalLink size={13} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
