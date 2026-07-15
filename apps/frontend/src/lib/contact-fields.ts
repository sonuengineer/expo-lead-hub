import type { FormFieldDef } from "../components/DynamicForm";

// A flat contact shape produced by a BNI lookup or a card scan.
export interface Contact {
  name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  designation?: string | null;
  address?: string | null;
}

// Prefill a dynamic form by matching each field's key to a contact property
// (same regex approach as the OCR scan page). Returns a new fields array with
// `defaultValue` set so the DynamicForm renders it pre-filled — the visitor
// then just confirms or edits.
export function applyContactToFields(fields: FormFieldDef[], c: Contact): FormFieldDef[] {
  return fields.map((f) => {
    const k = f.fieldKey.toLowerCase();
    let v: string | null | undefined;
    if (/company|organi/.test(k)) v = c.company;
    else if (/contact|person|full.?name|^name$/.test(k)) v = c.name;
    else if (/email/.test(k)) v = c.email;
    else if (/mobile|phone/.test(k)) v = c.phone;
    else if (/website|url|web/.test(k)) v = c.website;
    else if (/designation|title|role/.test(k)) v = c.designation;
    else if (/address/.test(k)) v = c.address;
    return v ? { ...f, defaultValue: v } : f;
  });
}

// Map the backend BNI record (searchBni / card-scan `bni`) to a Contact.
export function bniToContact(m: {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
}): Contact {
  return {
    name: m.name ?? "",
    company: m.company ?? "",
    email: m.email ?? "",
    phone: m.phone ?? "",
    website: m.website ?? "",
  };
}

// Map the card-scan parsed fields to a Contact.
export function cardToContact(p: {
  contactPerson?: string;
  companyName?: string;
  email?: string;
  mobileNumber?: string;
  website?: string;
  designation?: string;
  address?: string;
}): Contact {
  return {
    name: p.contactPerson ?? "",
    company: p.companyName ?? "",
    email: p.email ?? "",
    phone: p.mobileNumber ?? "",
    website: p.website ?? "",
    designation: p.designation ?? "",
    address: p.address ?? "",
  };
}
