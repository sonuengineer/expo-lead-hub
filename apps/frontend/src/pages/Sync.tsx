import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Play, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api-client";
import { SyncStatusBadge, formatDate } from "../components/badges";

interface QueueItem {
  id: string;
  target: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  lastError: string | null;
  createdAt: string;
  lead?: { id: string; eventId: string; status: string } | null;
}

interface StatGroup {
  status: string;
  target: string;
  _count: number;
}

export function SyncPage() {
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => (await api.syncQueue.status({ take: 50 })).data,
    refetchInterval: 15000,
  });

  const retryMutation = useMutation({
    mutationFn: (queueItemId: string) => api.syncQueue.retry(queueItemId),
    onSuccess: () => {
      toast.success("Queued for retry");
      qc.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: () => toast.error("Retry failed"),
  });

  const processMutation = useMutation({
    mutationFn: () => api.syncQueue.process(),
    onSuccess: (res: any) => {
      toast.success(res.data?.message ?? "Queue processed");
      qc.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: () => toast.error("Processing failed (SUPER_ADMIN only)"),
  });

  const queueItems: QueueItem[] = data?.queueItems ?? [];
  const stats: StatGroup[] = data?.stats ?? [];

  const totalBy = (status: string) =>
    stats.filter((s) => s.status === status).reduce((sum, s) => sum + s._count, 0);

  const cards = [
    { label: "Pending", value: totalBy("PENDING"), color: "text-gray-700" },
    { label: "Processing", value: totalBy("PROCESSING"), color: "text-blue-600" },
    { label: "Completed", value: totalBy("COMPLETED"), color: "text-green-600" },
    { label: "Failed", value: totalBy("FAILED"), color: "text-red-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sync Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">CRM &amp; Google Sheets sync queue</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {processMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Process now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{c.label}</p>
            <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Target", "Status", "Attempts", "Next Retry", "Last Error", "Created", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : queueItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Sync queue is empty.
                </td>
              </tr>
            ) : (
              queueItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-700">{item.target}</td>
                  <td className="px-4 py-3">
                    <SyncStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.attemptCount}/{item.maxAttempts}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {item.nextRetryAt ? formatDate(item.nextRetryAt, true) : "—"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-red-600" title={item.lastError ?? ""}>
                    {item.lastError ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "FAILED" || item.status === "PENDING" ? (
                      <button
                        onClick={() => retryMutation.mutate(item.id)}
                        disabled={retryMutation.isPending}
                        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Retry
                      </button>
                    ) : null}
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
