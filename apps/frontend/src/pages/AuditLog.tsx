import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { formatDate } from "../components/badges";

const PAGE_SIZE = 25;

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

export function AuditLogPage() {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const filters = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, filters],
    queryFn: async () =>
      (await api.audit.list({ ...filters, skip: page * PAGE_SIZE, take: PAGE_SIZE })).data,
    placeholderData: keepPreviousData,
  });

  const logs: AuditEntry[] = data?.logs ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actions: string[] = data?.filters?.actions ?? [];
  const entityTypes: string[] = data?.filters?.entityTypes ?? [];

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
        <p className="mt-1 text-sm text-gray-500">{total} entries</p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <select
          value={action}
          onChange={(e) => reset(() => setAction(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={entityType}
          onChange={(e) => reset(() => setEntityType(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All entities</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Action", "Entity", "User", "IP", "When"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  No audit entries.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{log.action}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.entityType}
                    <span className="ml-1 text-xs text-gray-400">{log.entityId.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{log.user?.name ?? "System"}</td>
                  <td className="px-4 py-3 text-gray-500">{log.ipAddress ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {formatDate(log.createdAt, true)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page {page + 1} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            disabled={page + 1 >= totalPages}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
