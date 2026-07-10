import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { publicApi } from "../lib/api-client";
import { DynamicForm, type FormFieldDef } from "../components/DynamicForm";

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
    onSuccess: () => setSubmitted(true),
  });

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
            Our team will be in touch shortly.
          </p>
          <button
            onClick={() => setSubmitted(false)}
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

          {submitMutation.isError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Something went wrong submitting the form. Please try again.
            </div>
          )}

          <DynamicForm
            fields={activeFields}
            submitting={submitMutation.isPending}
            onSubmit={(values) => submitMutation.mutate(values)}
          />

          <p className="mt-6 text-center text-xs text-gray-400">Powered by Exhibition Lead Capture</p>
        </div>
      </div>
    </Shell>
  );
}
