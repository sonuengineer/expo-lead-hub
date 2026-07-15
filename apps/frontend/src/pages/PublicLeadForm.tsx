import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Loader2, Gamepad2, Phone, ScanLine, Search } from "lucide-react";
import { publicApi } from "../lib/api-client";
import { DynamicForm, type FormFieldDef } from "../components/DynamicForm";
import { QrImage } from "../components/QrImage";
import { downscale } from "../lib/ocr";
import { applyContactToFields, bniToContact, cardToContact, type Contact } from "../lib/contact-fields";

interface FormPayload {
  qrCode: { id: string; shortCode: string; eventId: string; boothId: string; visitorTypeId: string };
  event: { id: string; name: string; bannerImageUrl?: string | null; logoUrl?: string | null };
  booth: { id: string; name: string };
  visitorType: { id: string; name: string; slug: string };
  form: { id: string; name: string; fields: FormFieldDef[] } | null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}

export function PublicLeadForm() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [playLink, setPlayLink] = useState<string | null>(null);

  // Quick-start: prefill the form from a phone lookup or a card scan.
  const [prefillFields, setPrefillFields] = useState<FormFieldDef[] | null>(null);
  const [prefillNonce, setPrefillNonce] = useState(0); // bump to remount DynamicForm with new defaults
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<null | "phone" | "card">(null);
  const [quickMsg, setQuickMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-form", shortCode],
    queryFn: async () => (await publicApi.getForm(shortCode!)).data as FormPayload,
    enabled: !!shortCode,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: (formData: Record<string, unknown>) => {
      if (!data) throw new Error("No form");
      return publicApi.submitLead({
        qrCodeId: data.qrCode.id,
        visitorTypeId: data.qrCode.visitorTypeId,
        boothId: data.qrCode.boothId,
        formDefinitionId: data.form!.id,
        eventId: data.qrCode.eventId,
        formData,
      });
    },
    onSuccess: (res) => {
      // Prefer the absolute link from the API; fall back to a same-origin path.
      const link: string | undefined = res?.data?.playLink;
      const token: string | undefined = res?.data?.playToken;
      setPlayLink(link ?? (token ? `${window.location.origin}/play/${token}` : null));
      setSubmitted(true);
    },
  });

  // Prefill the dynamic form with a contact, then remount it so defaults apply.
  const applyContact = (contact: Contact, msg: { tone: "ok" | "warn"; text: string }) => {
    if (!data?.form) return;
    const base = data.form.fields.filter((f: any) => f.isActive !== false);
    setPrefillFields(applyContactToFields(base, contact));
    setPrefillNonce((n) => n + 1);
    setQuickMsg(msg);
  };

  // Path 2 — phone-first BNI auto-fetch.
  const lookupPhone = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) {
      setQuickMsg({ tone: "warn", text: "Enter a valid phone number." });
      return;
    }
    setBusy("phone");
    try {
      const { data: res } = await publicApi.bniLookup(phone.trim());
      const m = res?.members?.[0];
      if (m) {
        applyContact({ ...bniToContact(m), phone: phone.trim() }, { tone: "ok", text: `Found you, ${m.name}! Please review and confirm below.` });
      } else {
        applyContact({ phone: phone.trim() }, { tone: "warn", text: "No match found — please fill in your details below." });
      }
    } catch {
      setQuickMsg({ tone: "warn", text: "Lookup failed — please fill in your details below." });
    } finally {
      setBusy(null);
    }
  };

  // Option B — scan a business card (OCR + BNI enrich).
  const scanCard = async (file: File) => {
    setBusy("card");
    setQuickMsg({ tone: "ok", text: "Reading your card…" });
    try {
      const dataUrl = await downscale(file);
      const { data: res } = await publicApi.cardScan(dataUrl);
      const card = cardToContact(res?.parsed ?? {});
      const bni: Contact | null = res?.bni ? bniToContact(res.bni) : null;
      // Card is primary; BNI fills any gaps (company, website, email).
      const merged: Contact = { ...(bni ?? {}) };
      for (const [k, v] of Object.entries(card)) {
        if (v) (merged as any)[k] = v;
      }
      applyContact(
        merged,
        bni
          ? { tone: "ok", text: `Matched BNI member ${res.bni.name} — please confirm below.` }
          : { tone: "ok", text: "Card read — please review and confirm below." },
      );
    } catch (e: any) {
      setQuickMsg({ tone: "warn", text: e?.response?.data?.message ?? "Could not read the card. Please fill in below." });
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="animate-spin" />
          Loading form…
        </div>
      </Shell>
    );
  }

  if (isError || !data) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
          <AlertTriangle className="mx-auto mb-3 text-amber-500" size={40} />
          <h1 className="text-lg font-semibold text-gray-900">QR code not found</h1>
          <p className="mt-1 text-sm text-gray-500">
            This QR code is invalid or no longer active. Please ask a staff member for help.
          </p>
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
          <CheckCircle2 className="mx-auto mb-3 text-green-500" size={48} />
          <h1 className="text-xl font-bold text-gray-900">Thank you!</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your details have been submitted to <span className="font-medium">{data.event.name}</span>.
            We've sent you a WhatsApp/email too.
          </p>

          {playLink && (
            <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-5">
              <p className="text-sm font-semibold text-indigo-900">🎮 One more thing — play a quick game!</p>
              <p className="mt-1 text-xs text-indigo-700">
                Get your instant AI website score, or run the profitability calculator.
              </p>
              <a
                href={playLink}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Gamepad2 size={16} /> Play now
              </a>
              <div className="mt-4 flex flex-col items-center">
                <QrImage value={playLink} size={132} />
                <p className="mt-2 text-[11px] text-indigo-400">Or scan on your phone</p>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setSubmitted(false);
              setPlayLink(null);
            }}
            className="mt-6 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Submit another
          </button>
        </div>
      </Shell>
    );
  }

  if (!data.form || data.form.fields.length === 0) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
          <AlertTriangle className="mx-auto mb-3 text-amber-500" size={40} />
          <h1 className="text-lg font-semibold text-gray-900">Form not available</h1>
          <p className="mt-1 text-sm text-gray-500">
            No active lead form is configured for this event yet.
          </p>
        </div>
      </Shell>
    );
  }

  const activeFields = data.form.fields.filter((f: any) => f.isActive !== false);

  return (
    <Shell>
      <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
        {data.event.bannerImageUrl && (
          <img src={data.event.bannerImageUrl} alt="" className="h-32 w-full object-cover" />
        )}
        <div className="p-6 sm:p-8">
          <div className="mb-6 text-center">
            {data.event.logoUrl && (
              <img src={data.event.logoUrl} alt="" className="mx-auto mb-3 h-12 object-contain" />
            )}
            <h1 className="text-xl font-bold text-gray-900">{data.event.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {data.booth.name} · <span className="font-medium text-indigo-600">{data.visitorType.name}</span>
            </p>
          </div>

          {/* Quick-start: phone-first lookup + card scan (both prefill the form). */}
          <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <p className="mb-3 text-sm font-semibold text-indigo-900">Fill in seconds</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3">
                <Phone size={15} className="text-indigo-400" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookupPhone()}
                  inputMode="tel"
                  placeholder="Your phone number"
                  className="w-full bg-transparent py-2 text-sm focus:outline-none"
                />
                <button
                  onClick={lookupPhone}
                  disabled={busy !== null}
                  className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === "phone" ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                </button>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                {busy === "card" ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                Scan card
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) scanCard(f);
                  e.target.value = "";
                }}
              />
            </div>
            {quickMsg && (
              <p className={`mt-2 text-xs ${quickMsg.tone === "ok" ? "text-emerald-600" : "text-amber-600"}`}>
                {quickMsg.text}
              </p>
            )}
          </div>

          {submitMutation.isError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Something went wrong submitting the form. Please try again.
            </div>
          )}

          <DynamicForm
            key={prefillNonce}
            fields={prefillFields ?? activeFields}
            submitting={submitMutation.isPending}
            onSubmit={(values) => submitMutation.mutate(values)}
          />

          <p className="mt-6 text-center text-xs text-gray-400">Powered by Exhibition Lead Capture</p>
        </div>
      </div>
    </Shell>
  );
}
