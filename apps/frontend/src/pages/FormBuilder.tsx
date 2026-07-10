import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Trash2, Plus, Loader2, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api-client";

const FIELD_TYPES = [
  "TEXT", "EMAIL", "PHONE", "NUMBER", "TEXTAREA", "DROPDOWN",
  "RADIO", "CHECKBOX", "DATE", "MULTI_SELECT", "FILE_UPLOAD", "URL",
];

interface Field {
  id: string;
  fieldKey: string;
  fieldType: string;
  label: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
}

export function FormBuilderPage() {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [adding, setAdding] = useState(false);
  const [newField, setNewField] = useState({ label: "", fieldKey: "", fieldType: "TEXT", isRequired: false });

  const { data: eventsData } = useQuery({
    queryKey: ["events-filter"],
    queryFn: async () => (await api.events.list({ take: 100 })).data,
  });
  const events: { id: string; name: string }[] = eventsData?.events ?? [];

  // Default the Event dropdown to the first available option.
  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0]!.id);
  }, [events, eventId]);

  const { data: eventDetail } = useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: async () => (await api.events.get(eventId)).data,
    enabled: !!eventId,
  });
  const formId: string | undefined = eventDetail?.event?.formDefinitions?.[0]?.id;
  const formName: string | undefined = eventDetail?.event?.formDefinitions?.[0]?.name;

  const { data: fieldsData, isLoading } = useQuery({
    queryKey: ["form-fields", eventId, formId],
    queryFn: async () => (await api.formFields.list(eventId, formId!)).data,
    enabled: !!eventId && !!formId,
  });
  const fields: Field[] = fieldsData?.fields ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["form-fields", eventId, formId] });

  const updateField = useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: any }) =>
      api.formFields.update(eventId, formId!, fieldId, data),
    onSuccess: invalidate,
    onError: () => toast.error("Update failed"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ fieldId, active }: { fieldId: string; active: boolean }) =>
      active
        ? api.formFields.deactivate(eventId, formId!, fieldId)
        : api.formFields.activate(eventId, formId!, fieldId),
    onSuccess: invalidate,
    onError: () => toast.error("Failed to toggle visibility"),
  });

  const removeField = useMutation({
    mutationFn: (fieldId: string) => api.formFields.remove(eventId, formId!, fieldId),
    onSuccess: () => {
      toast.success("Field deleted");
      invalidate();
    },
    onError: () => toast.error("Delete failed"),
  });

  const addField = useMutation({
    mutationFn: () =>
      api.formFields.create(eventId, formId!, {
        label: newField.label,
        fieldKey: newField.fieldKey || newField.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
        fieldType: newField.fieldType,
        isRequired: newField.isRequired,
      }),
    onSuccess: () => {
      toast.success("Field added");
      setAdding(false);
      setNewField({ label: "", fieldKey: "", fieldType: "TEXT", isRequired: false });
      invalidate();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Add failed"),
  });

  const activeCount = fields.filter((f) => f.isActive !== false).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Form Builder</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose which fields appear on the visitor form and which are required.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Event</label>
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Select an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        {eventId && !formId && (
          <p className="mt-2 text-sm text-amber-600">This event has no form definition yet.</p>
        )}
      </div>

      {eventId && formId && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <div>
              <h3 className="font-semibold text-gray-900">{formName ?? "Lead Form"}</h3>
              <p className="text-xs text-gray-400">
                {activeCount} of {fields.length} fields visible to visitors
              </p>
            </div>
            <button
              onClick={() => setAdding((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={16} /> Add field
            </button>
          </div>

          {adding && (
            <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4">
              <div className="min-w-[180px] flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600">Label</label>
                <input
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  placeholder="e.g. Company Name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
                <select
                  value={newField.fieldType}
                  onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={newField.isRequired}
                  onChange={(e) => setNewField({ ...newField, isRequired: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600"
                />
                Required
              </label>
              <button
                onClick={() => addField.mutate()}
                disabled={!newField.label || addField.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {addField.isPending && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          )}

          {isLoading ? (
            <p className="px-5 py-10 text-center text-gray-400">Loading fields…</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {fields.map((f) => {
                const visible = f.isActive !== false;
                return (
                  <li
                    key={f.id}
                    className={`flex flex-wrap items-center gap-3 px-5 py-3 ${visible ? "" : "bg-gray-50/60 opacity-70"}`}
                  >
                    <GripVertical size={16} className="text-gray-300" />
                    <input
                      defaultValue={f.label}
                      onBlur={(e) => {
                        if (e.target.value !== f.label && e.target.value.trim()) {
                          updateField.mutate({ fieldId: f.id, data: { label: e.target.value } });
                        }
                      }}
                      className="min-w-[160px] flex-1 rounded-lg border border-transparent px-2 py-1.5 text-sm font-medium text-gray-900 hover:border-gray-200 focus:border-indigo-500 focus:outline-none"
                    />
                    <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{f.fieldKey}</code>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                      {f.fieldType}
                    </span>

                    <label className="flex items-center gap-1.5 text-sm text-gray-600" title="Required">
                      <input
                        type="checkbox"
                        checked={f.isRequired}
                        onChange={(e) => updateField.mutate({ fieldId: f.id, data: { isRequired: e.target.checked } })}
                        className="h-4 w-4 rounded text-indigo-600"
                      />
                      Required
                    </label>

                    <button
                      onClick={() => toggleActive.mutate({ fieldId: f.id, active: visible })}
                      title={visible ? "Visible — click to hide" : "Hidden — click to show"}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                        visible ? "border-green-200 text-green-600" : "border-gray-200 text-gray-400"
                      } hover:bg-gray-50`}
                    >
                      {visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Delete field "${f.label}"?`)) removeField.mutate(f.id);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
            Tip: hide the fields you don't need with the eye icon — hidden fields won't appear on the QR / scan form.
          </div>
        </div>
      )}
    </div>
  );
}
