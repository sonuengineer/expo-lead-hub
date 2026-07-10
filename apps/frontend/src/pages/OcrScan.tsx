import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Camera, ScanLine, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api-client";
import { scanCard } from "../lib/ocr";
import { useAuthStore } from "../stores/auth.store";
import { DynamicForm, type FormFieldDef } from "../components/DynamicForm";

interface ParsedData {
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  designation?: string;
}

// Map OCR-parsed business-card data onto the dynamic form's field keys.
function injectOcr(fields: FormFieldDef[], parsed: ParsedData): FormFieldDef[] {
  const fullName = [parsed.firstName, parsed.lastName].filter(Boolean).join(" ");
  return fields.map((f) => {
    const k = f.fieldKey.toLowerCase();
    let v: string | undefined;
    if (/company|organi/.test(k)) v = parsed.companyName;
    else if (/contact|person|full.?name|^name$/.test(k)) v = fullName || undefined;
    else if (/email/.test(k)) v = parsed.email;
    else if (/mobile|phone/.test(k)) v = parsed.phone;
    else if (/website|url|web/.test(k)) v = parsed.website;
    else if (/designation|title|role/.test(k)) v = parsed.designation;
    else if (/address/.test(k)) v = parsed.address;
    return v ? { ...f, defaultValue: v } : f;
  });
}

export function OcrScanPage() {
  const user = useAuthStore((s) => s.user);
  const [eventId, setEventId] = useState("");
  const [boothId, setBoothId] = useState("");
  const [visitorTypeId, setVisitorTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [scan, setScan] = useState<{ rawText: string; confidence: number; parsed: ParsedData } | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [showRaw, setShowRaw] = useState(false);
  const [done, setDone] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

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
  const visitorTypes = eventDetail?.event?.visitorTypes ?? [];
  const form = eventDetail?.event?.formDefinitions?.[0];

  // The event-detail endpoint returns the form definition but not its fields,
  // so fetch them separately (same source the Form Builder uses).
  const { data: fieldsData } = useQuery({
    queryKey: ["ocr-form-fields", eventId, form?.id],
    queryFn: async () => (await api.formFields.list(eventId, form!.id)).data,
    enabled: !!eventId && !!form?.id,
  });
  const activeFields: FormFieldDef[] = (fieldsData?.fields ?? []).filter(
    (f: any) => f.isActive !== false,
  );

  const ready = eventId && boothId && visitorTypeId;

  const onFileChange = (f: File | null) => {
    setFile(f);
    setScan(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : "");
  };

  // OCR runs in the browser (Tesseract.js) — no server round-trip, works on the
  // free tier, and the phone does the heavy lifting.
  const runScan = async () => {
    if (!file) return;
    setScanning(true);
    setProgress(0);
    try {
      const result = await scanCard(file, (p) => setProgress(p));
      setScan(result);
      setScanKey((k) => k + 1);
      if (!result.rawText.trim()) {
        toast("No text detected — you can still fill the form manually.", { icon: "✏️" });
      } else {
        toast.success("Card scanned — review the details below");
      }
    } catch {
      toast.error("Couldn't read the image. Try again or enter details manually.");
    } finally {
      setScanning(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: (formData: Record<string, unknown>) =>
      api.ocr.submit({
        eventId,
        boothId,
        visitorTypeId,
        formDefinitionId: form!.id,
        ocrRawText: scan?.rawText ?? "",
        ocrConfidence: scan?.confidence ?? 0,
        formData,
        submittedBy: user!.id,
      }),
    onSuccess: () => setDone(true),
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Submit failed"),
  });

  const reset = () => {
    onFileChange(null);
    setScan(null);
    setDone(false);
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-3 text-green-500" size={48} />
        <h2 className="text-xl font-bold text-gray-900">Lead captured</h2>
        <p className="mt-2 text-sm text-gray-600">The scanned card was saved and queued for sync.</p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <RotateCcw size={16} /> Scan another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Scan Business Card</h2>
        <p className="mt-1 text-sm text-gray-500">
          Capture a card, review the auto-filled details, and save the lead.
        </p>
      </div>

      {/* Context selectors */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-3">
        <Select label="Event" value={eventId} onChange={(v) => { setEventId(v); setBoothId(""); setVisitorTypeId(""); }}
          options={events.map((e) => ({ value: e.id, label: e.name }))} placeholder="Select event…" />
        <Select label="Booth" value={boothId} onChange={setBoothId} disabled={!eventId}
          options={booths.map((b: any) => ({ value: b.id, label: b.name }))} placeholder="Select booth…" />
        <Select label="Visitor type" value={visitorTypeId} onChange={setVisitorTypeId} disabled={!eventId}
          options={visitorTypes.map((v: any) => ({ value: v.id, label: v.name }))} placeholder="Select type…" />
      </div>

      {!ready ? (
        <p className="text-sm text-gray-400">Select an event, booth, and visitor type to begin.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Capture */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-3 font-semibold text-gray-900">1 · Capture card</h3>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-10 text-gray-500 hover:border-indigo-400 hover:bg-indigo-50/40">
              <Camera size={28} />
              <span className="text-sm font-medium">Tap to take a photo or upload</span>
              <span className="text-xs text-gray-400">JPEG / PNG / WebP · max 5MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              />
            </label>

            {preview && (
              <div className="mt-4">
                <img src={preview} alt="card preview" className="max-h-56 w-full rounded-lg object-contain" />
                <button
                  onClick={runScan}
                  disabled={scanning}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
                  {scanning ? `Reading card… ${Math.round(progress * 100)}%` : "Scan card"}
                </button>
                {scanning && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {scan && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    OCR confidence: <b className="text-gray-800">{Math.round(scan.confidence * 100)}%</b>
                  </span>
                  <button onClick={() => setShowRaw((v) => !v)} className="text-xs font-medium text-indigo-600 hover:underline">
                    {showRaw ? "Hide" : "Show"} raw text
                  </button>
                </div>
                {showRaw && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-gray-600">
                    {scan.rawText || "(no text detected)"}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Review + submit */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-3 font-semibold text-gray-900">2 · Review &amp; save</h3>
            {!scan ? (
              <p className="py-10 text-center text-sm text-gray-400">Scan a card to auto-fill the form.</p>
            ) : activeFields.length === 0 ? (
              <p className="py-10 text-center text-sm text-amber-600">No active form fields for this event.</p>
            ) : (
              <DynamicForm
                key={scanKey}
                fields={injectOcr(activeFields, scan.parsed)}
                submitting={submitMutation.isPending}
                onSubmit={(values) => submitMutation.mutate(values)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Select({
  label, value, onChange, options, placeholder, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
