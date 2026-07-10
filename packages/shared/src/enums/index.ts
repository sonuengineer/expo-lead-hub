// ── Enums ─────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  STAFF = "STAFF",
}

export enum EventStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum FieldType {
  TEXT = "TEXT",
  EMAIL = "EMAIL",
  PHONE = "PHONE",
  NUMBER = "NUMBER",
  TEXTAREA = "TEXTAREA",
  DROPDOWN = "DROPDOWN",
  RADIO = "RADIO",
  CHECKBOX = "CHECKBOX",
  DATE = "DATE",
  MULTI_SELECT = "MULTI_SELECT",
  FILE_UPLOAD = "FILE_UPLOAD",
  URL = "URL",
}

export enum LeadSource {
  QR_SCAN = "QR_SCAN",
  OCR_SCAN = "OCR_SCAN",
  MANUAL = "MANUAL",
}

export enum LeadStatus {
  NEW = "NEW",
  SYNCED = "SYNCED",
  FAILED = "FAILED",
  RETRYING = "RETRYING",
}

export enum SyncTarget {
  CRM = "CRM",
  GOOGLE_SHEETS = "GOOGLE_SHEETS",
}

export enum SyncStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum CrmAuthType {
  NONE = "NONE",
  API_KEY = "API_KEY",
  BEARER = "BEARER",
  BASIC = "BASIC",
  CUSTOM = "CUSTOM",
}

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
}

export enum NotificationChannel {
  EMAIL = "EMAIL",
  WHATSAPP = "WHATSAPP",
  SLACK = "SLACK",
  WEBHOOK = "WEBHOOK",
}
