import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ScanLine, Gamepad2 } from "lucide-react";
import { api } from "../lib/api-client";
import { appUrl } from "../lib/app-url";
import { QrImage } from "../components/QrImage";
import { LeadStatusBadge, SourceBadge, SyncStatusBadge, formatDate } from "../components/badges";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => (await api.leads.get(id!)).data,
    enabled: !!id,
  });

  if (isLoading) return <p className="text-gray-500">Loading lead…</p>;
  if (isError || !data) return <p className="text-red-600">Lead not found.</p>;

  const { lead, summary, auditTrail } = data;
  const rawFormData: Record<string, any> = lead.rawFormData ?? {};
  const fields: { fieldKey: string; label: string; fieldType: string }[] =
    lead.formDefinition?.fields ?? [];

  // Map field keys to labels; fall back to raw keys not covered by the form.
  const labelFor = (key: string) => fields.find((f) => f.fieldKey === key)?.label ?? key;
  const orderedKeys = fields.length
    ? [...fields.map((f) => f.fieldKey), ...Object.keys(rawFormData).filter((k) => !fields.some((f) => f.fieldKey === k))]
    : Object.keys(rawFormData);

  return (
    <div className="space-y-5">
      <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
        <ArrowLeft size={16} /> Back to leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{summary.name || "Unnamed Lead"}</h2>
          <p className="mt-1 text-gray-500">{summary.company || lead.event?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <SourceBadge source={lead.source} />
          <LeadStatusBadge status={lead.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Form data */}
          <Section title="Form Data">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {orderedKeys.length === 0 && <p className="text-sm text-gray-400">No form data.</p>}
              {orderedKeys.map((key) => {
                const value = rawFormData[key];
                if (value === undefined || value === null || value === "") return null;
                return (
                  <div key={key}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      {labelFor(key)}
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Section>

          {/* OCR */}
          {lead.ocrRawText && (
            <Section title="OCR Text">
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                <ScanLine size={16} />
                {lead.ocrConfidence != null && (
                  <span>Confidence: {(lead.ocrConfidence * 100).toFixed(0)}%</span>
                )}
              </div>
              <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                {lead.ocrRawText}
              </pre>
            </Section>
          )}

          {/* Sync history */}
          <Section title="Sync History">
            {(!lead.syncLogs || lead.syncLogs.length === 0) && (!lead.syncQueue || lead.syncQueue.length === 0) ? (
              <p className="text-sm text-gray-400">No sync activity yet.</p>
            ) : (
              <div className="space-y-4">
                {lead.syncQueue?.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Queue</p>
                    <div className="space-y-2">
                      {lead.syncQueue.map((q: any) => (
                        <div key={q.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                          <span className="font-medium text-gray-700">{q.target}</span>
                          <span className="text-gray-500">attempts: {q.attemptCount}/{q.maxAttempts}</span>
                          <SyncStatusBadge status={q.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lead.syncLogs?.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Logs</p>
                    <div className="space-y-2">
                      {lead.syncLogs.map((log: any) => (
                        <div key={log.id} className="rounded-lg border border-gray-100 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-700">{log.target}</span>
                            <span
                              className={
                                log.status === "SUCCESS" ? "text-green-600" : "text-red-600"
                              }
                            >
                              {log.status}
                              {log.httpStatusCode ? ` · ${log.httpStatusCode}` : ""}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {formatDate(log.createdAt, true)}
                            {log.durationMs != null ? ` · ${log.durationMs}ms` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Audit trail */}
          <Section title="Audit Trail">
            {!auditTrail || auditTrail.length === 0 ? (
              <p className="text-sm text-gray-400">No audit entries.</p>
            ) : (
              <ol className="space-y-3">
                {auditTrail.map((entry: any) => (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                    <div>
                      <p className="text-gray-800">
                        <span className="font-medium">{entry.action}</span>
                        {entry.user && <span className="text-gray-500"> by {entry.user.name}</span>}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(entry.createdAt, true)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        {/* Meta sidebar */}
        <div className="space-y-5">
          <Section title="Details">
            <dl className="space-y-3 text-sm">
              <MetaRow label="Event" value={lead.event?.name} />
              <MetaRow label="Booth" value={lead.booth?.name} />
              <MetaRow label="Visitor Type" value={lead.visitorType?.name} />
              <MetaRow label="Email" value={summary.email} />
              <MetaRow label="Phone" value={summary.phone} />
              <MetaRow label="Submitted By" value={lead.submittedByUser?.name ?? "Public (QR)"} />
              <MetaRow label="CRM Synced" value={lead.crmSynced ? "Yes" : "No"} />
              <MetaRow label="Sheets Synced" value={lead.sheetsSynced ? "Yes" : "No"} />
              <MetaRow label="Created" value={formatDate(lead.createdAt, true)} />
            </dl>
          </Section>

          {lead.playToken && (
            <Section title="Play on booth screen">
              <p className="mb-3 text-sm text-gray-500">
                Open this visitor's game on the booth iPad/TV, or let them scan it on a phone.
              </p>
              <a
                href={appUrl(`/play/${lead.playToken}`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Gamepad2 size={16} /> Open game
              </a>
              <div className="mt-4 flex flex-col items-center">
                <QrImage value={appUrl(`/play/${lead.playToken}`)} size={150} />
                <p className="mt-2 text-xs text-gray-400">Scan to play on a phone</p>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value || "—"}</dd>
    </div>
  );
}
