import clsx from "clsx";

export function formatDate(value: string | Date, withTime = false) {
  const d = new Date(value);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

const LEAD_STATUS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  SYNCED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  RETRYING: "bg-amber-100 text-amber-800",
};

const SYNC_STATUS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

const SOURCE: Record<string, string> = {
  QR_SCAN: "bg-indigo-100 text-indigo-800",
  OCR_SCAN: "bg-purple-100 text-purple-800",
  MANUAL: "bg-gray-100 text-gray-700",
};

export function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: string }) {
  return <Badge label={status} className={LEAD_STATUS[status] ?? "bg-gray-100 text-gray-700"} />;
}

export function SyncStatusBadge({ status }: { status: string }) {
  return <Badge label={status} className={SYNC_STATUS[status] ?? "bg-gray-100 text-gray-700"} />;
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <Badge label={source.replace("_", " ")} className={SOURCE[source] ?? "bg-gray-100 text-gray-700"} />
  );
}
