import { z } from "zod";

// ── Auth Schemas ─────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ── Event Schemas ────────────────────────

export const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  description: z.string().optional(),
  organizer: z.string().min(1, "Organizer is required"),
  venue: z.string().min(1, "Venue is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).default("DRAFT"),
  bannerImageUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

// ── Booth Schemas ────────────────────────

export const createBoothSchema = z.object({
  name: z.string().min(1, "Booth name is required"),
  description: z.string().optional(),
  locationHint: z.string().optional(),
});

export type CreateBoothInput = z.infer<typeof createBoothSchema>;

// ── Form Field Schemas ───────────────────

export const formFieldOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const createFormFieldSchema = z.object({
  fieldKey: z.string().regex(/^[a-z_]+$/, "Field key must be snake_case"),
  fieldType: z.enum([
    "TEXT", "EMAIL", "PHONE", "NUMBER", "TEXTAREA", "DROPDOWN",
    "RADIO", "CHECKBOX", "DATE", "MULTI_SELECT", "FILE_UPLOAD", "URL",
  ]),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  isRequired: z.boolean().default(false),
  defaultValue: z.any().optional(),
  validationRules: z.record(z.string(), z.any()).optional(),
  displayOrder: z.number().int().min(0),
  options: z.array(formFieldOptionSchema).optional(),
});

export type CreateFormFieldInput = z.infer<typeof createFormFieldSchema>;

// ── Lead Schemas ─────────────────────────

export const submitLeadSchema = z.object({
  eventId: z.string().uuid(),
  boothId: z.string().uuid(),
  visitorTypeId: z.string().uuid(),
  formDefinitionId: z.string().uuid(),
  source: z.enum(["QR_SCAN", "OCR_SCAN", "MANUAL"]),
  formData: z.record(z.string(), z.any()),
  ocrRawText: z.string().optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),
});

export type SubmitLeadInput = z.infer<typeof submitLeadSchema>;

// ── CRM Config Schemas ───────────────────

export const crmConfigSchema = z.object({
  apiUrl: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST"),
  headers: z.record(z.string(), z.string()).optional(),
  authType: z.enum(["NONE", "API_KEY", "BEARER", "BASIC", "CUSTOM"]).default("NONE"),
  authCredentials: z.record(z.string(), z.any()).optional(),
  payloadMapping: z.record(z.string(), z.string()),
  successResponsePattern: z.any().optional(),
  failureResponsePattern: z.any().optional(),
  timeoutMs: z.number().int().min(1000).max(60000).default(10000),
});

export type CrmConfigInput = z.infer<typeof crmConfigSchema>;

// ── Google Sheets Config ─────────────────

export const sheetsConfigSchema = z.object({
  spreadsheetId: z.string().min(1),
  worksheetName: z.string().min(1),
  columnMapping: z.record(z.string(), z.string()),
});

export type SheetsConfigInput = z.infer<typeof sheetsConfigSchema>;
