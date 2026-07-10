# Exhibition Lead Capture Platform — Implementation Plan

> **Architecture:** Monorepo (pnpm workspaces) · React + Vite + Tailwind (frontend) · Express + TypeScript (backend) · PostgreSQL via Supabase · Vercel + Railway deployment

---

## Phase 0 — Project Scaffolding

| # | Task | Details |
|---|------|---------|
| 0.1 | **Initialize monorepo** | Root `package.json` with pnpm workspaces. Create `apps/frontend`, `apps/backend`, `packages/shared`, `packages/db` |
| 0.2 | **Frontend scaffold** | `pnpm create vite` with React + TypeScript. Add Tailwind CSS, React Router v6, React Query (TanStack Query), Zustand for state, Zod for validation, react-hook-form |
| 0.3 | **Backend scaffold** | Express + TypeScript with `ts-node-dev`. Add: `cors`, `helmet`, `morgan`, `express-rate-limit`, `jsonwebtoken`, `bcryptjs`, `multer`, `zod`, `drizzle-orm` or `prisma` |
| 0.4 | **Shared package** | TypeScript types, Zod schemas, constants, enums shared between frontend & backend |
| 0.5 | **Database package** | Prisma schema + migrations. Connection to Supabase PostgreSQL. Seed script |
| 0.6 | **Config & env** | `.env.example` files for each app. `dotenv` + config validation with Zod at startup |
| 0.7 | **Docker** | `docker-compose.yml` with Postgres (for local dev), backend, frontend services |
| 0.8 | **Tooling** | ESLint + Prettier (shared config in root), Husky pre-commit hooks, `tsconfig` base config |

---

## Phase 1 — Database Schema Design

### Core Tables

```
users
├── id (uuid, PK)
├── email (unique)
├── password_hash
├── name
├── role (enum: SUPER_ADMIN, ADMIN, STAFF)
├── is_active
├── created_at, updated_at

events
├── id (uuid, PK)
├── name
├── description
├── organizer
├── venue
├── city
├── country
├── start_date, end_date
├── status (enum: DRAFT, ACTIVE, COMPLETED, CANCELLED)
├── banner_image_url
├── logo_url
├── created_by (FK → users)
├── created_at, updated_at

booths
├── id (uuid, PK)
├── event_id (FK → events, CASCADE)
├── name
├── description
├── location_hint (e.g., "Hall A, Row 3")
├── is_active
├── created_at, updated_at

visitor_types
├── id (uuid, PK)
├── event_id (FK → events, CASCADE)
├── name
├── slug
├── color (for UI badges)
├── is_active
├── display_order
├── created_at

form_definitions
├── id (uuid, PK)
├── event_id (FK → events, CASCADE)
├── name
├── is_active
├── created_at, updated_at

form_fields
├── id (uuid, PK)
├── form_definition_id (FK → form_definitions, CASCADE)
├── field_key (unique per form — snake_case)
├── field_type (enum: TEXT, EMAIL, PHONE, NUMBER, TEXTAREA, DROPDOWN, RADIO, CHECKBOX, DATE, MULTI_SELECT, FILE_UPLOAD, URL)
├── label
├── placeholder
├── help_text
├── is_required
├── default_value (json)
├── validation_rules (json — {min, max, pattern, custom})
├── display_order
├── is_active
├── conditional_rules (json — future-ready visibility logic)
├── created_at, updated_at

field_options
├── id (uuid, PK)
├── form_field_id (FK → form_fields, CASCADE)
├── label
├── value
├── display_order
├── is_default

leads
├── id (uuid, PK)
├── event_id (FK → events)
├── booth_id (FK → booths)
├── visitor_type_id (FK → visitor_types)
├── form_definition_id (FK → form_definitions)
├── source (enum: QR_SCAN, OCR_SCAN, MANUAL)
├── submitted_by (FK → users, nullable — null for visitor QR submissions)
├── raw_form_data (jsonb — all field values)
├── ocr_raw_text (text, nullable)
├── ocr_confidence (float, nullable)
├── crm_synced (boolean, default false)
├── crm_response (jsonb, nullable)
├── sheets_synced (boolean, default false)
├── status (enum: NEW, SYNCED, FAILED, RETRYING)
├── created_at, updated_at

crm_configurations
├── id (uuid, PK)
├── event_id (FK → events, CASCADE)
├── api_url
├── method (enum: GET, POST, PUT, PATCH)
├── headers (jsonb)
├── auth_type (enum: NONE, API_KEY, BEARER, BASIC, CUSTOM)
├── auth_credentials (jsonb — encrypted)
├── payload_mapping (jsonb — maps form fields → CRM fields)
├── success_response_pattern (json)
├── failure_response_pattern (json)
├── timeout_ms (default 10000)
├── is_active
├── created_at, updated_at

sync_queue
├── id (uuid, PK)
├── lead_id (FK → leads)
├── target (enum: CRM, GOOGLE_SHEETS)
├── attempt_count (default 0)
├── max_attempts (default 5)
├── next_retry_at (timestamp)
├── status (enum: PENDING, PROCESSING, COMPLETED, FAILED)
├── last_error (text, nullable)
├── created_at, updated_at

sync_logs
├── id (uuid, PK)
├── lead_id (FK → leads)
├── target (enum: CRM, GOOGLE_SHEETS)
├── status (enum: SUCCESS, FAILURE)
├── request_payload (jsonb)
├── response_payload (jsonb)
├── http_status_code (int, nullable)
├── duration_ms (int)
├── created_at

google_sheets_config
├── id (uuid, PK)
├── event_id (FK → events, CASCADE)
├── spreadsheet_id
├── worksheet_name
├── column_mapping (jsonb — maps form fields → column letters)
├── service_account_credentials (jsonb — encrypted)
├── is_active
├── created_at, updated_at

audit_logs
├── id (uuid, PK)
├── user_id (FK → users, nullable)
├── action (string — e.g., "LEAD_CREATED", "EVENT_UPDATED")
├── entity_type (string)
├── entity_id (uuid)
├── old_value (jsonb, nullable)
├── new_value (jsonb, nullable)
├── ip_address
├── user_agent
├── created_at

notification_configs
├── id (uuid, PK)
├── event_id (FK → events, CASCADE)
├── channel (enum: EMAIL, WHATSAPP, SLACK, WEBHOOK)
├── is_active
├── config (jsonb — channel-specific settings)
├── events (jsonb — which events trigger: ["CRM_SUCCESS", "LEAD_RECEIVED"])
├── created_at, updated_at
```

### Key Relationships
- An **Event** has many **Booths**, **Visitor Types**, **Form Definitions**, **CRM Configs**
- A **Form Definition** has many **Form Fields**, each with many **Field Options**
- A **Lead** belongs to one Event, Booth, Visitor Type, and Form Definition
- **Sync Queue** entries track retries for each Lead to each target (CRM / Sheets)

---

## Phase 2 — Authentication & Authorization

| # | Task | Details |
|---|------|---------|
| 2.1 | **Auth module** | Register, login, refresh token, logout endpoints |
| 2.2 | **JWT implementation** | Access token (15min) + refresh token (7d). Store refresh in httpOnly cookie |
| 2.3 | **Password hashing** | bcrypt with 12 rounds |
| 2.4 | **RBAC middleware** | Role guard: `requireRole(SUPER_ADMIN)`, `requireRole(ADMIN, STAFF)` |
| 2.5 | **Protected routes** | Middleware chain: auth → role check → handler |
| 2.6 | **Frontend auth flow** | Login page, auth store (Zustand), auto-refresh, protected route wrapper |
| 2.7 | **Seed admin user** | Default super admin: `admin@exhibition-lead.com` / `admin123` (force change on first login) |

---

## Phase 3 — Event & Booth Management

| # | Task | Details |
|---|------|---------|
| 3.1 | **Events CRUD API** | `POST /api/events`, `GET /api/events`, `GET /api/events/:id`, `PUT /api/events/:id`, `DELETE /api/events/:id` |
| 3.2 | **Events list page** | Card grid with status badges, search, filter by status |
| 3.3 | **Event create/edit form** | Full form with image upload for banner/logo |
| 3.4 | **Event detail page** | Overview, linked booths, visitor types, form config, stats |
| 3.5 | **Booths CRUD API** | Nested under events: `POST /api/events/:eventId/booths`, etc. |
| 3.6 | **Booth management UI** | Add/edit/remove booths within event detail page |
| 3.7 | **Visitor types CRUD API** | Nested under events with display order management |
| 3.8 | **Visitor types UI** | Inline add/edit with drag-to-reorder |

---

## Phase 4 — Dynamic Form Builder

| # | Task | Details |
|---|------|---------|
| 4.1 | **Form definition API** | CRUD for form definitions per event |
| 4.2 | **Form fields API** | CRUD for fields within a form definition. Reorder endpoint |
| 4.3 | **Field options API** | CRUD for dropdown/radio/checkbox options |
| 4.4 | **Form builder UI (admin)** | Visual builder with field type selector, drag-to-reorder, field configuration panel (label, placeholder, required, validation, help text) |
| 4.5 | **Field type components** | Render each field type: TextInput, EmailInput, PhoneInput, NumberInput, TextareaInput, SelectInput, RadioGroup, CheckboxGroup, DatePicker, MultiSelect, FileUpload, URLInput |
| 4.6 | **Form preview** | Real-time preview of the form as admin builds it |
| 4.7 | **Form renderer (visitor-facing)** | Generic `DynamicForm` component that takes a form definition JSON and renders the correct fields |
| 4.8 | **Validation engine** | Zod schema generator from form field definitions. Client-side + server-side validation |

---

## Phase 5 — QR Code System

| # | Task | Details |
|---|------|---------|
| 5.1 | **QR generation API** | `POST /api/events/:eventId/booths/:boothId/qr` — generates QR encoding `{eventId, boothId, visitorTypeId}` as a short URL |
| 5.2 | **Short URL system** | `/v/:shortCode` redirects to the public lead form with params. Use nanoid for codes |
| 5.3 | **QR management UI** | Generate, download (PNG/SVG), print QR codes per booth × visitor type. Bulk generation |
| 5.4 | **Public lead form page** | `GET /v/:shortCode` → parses QR data → loads event form → renders DynamicForm. No auth required |
| 5.5 | **Lead submission API** | `POST /api/public/leads` — validates via Zod, saves lead, queues CRM + Sheets sync |
| 5.6 | **Thank you page** | Post-submission confirmation with optional event info |

---

## Phase 6 — Business Card OCR

| # | Task | Details |
|---|------|---------|
| 6.1 | **OCR service module** | Abstract `OcrService` interface with two implementations: `GoogleVisionOcr` and `TesseractOcr` |
| 6.2 | **Google Cloud Vision integration** | `@google-cloud/vision` library. Annotate image → extract text |
| 6.3 | **Tesseract.js integration** | `tesseract.js` for offline/browser-based OCR |
| 6.4 | **Fallback logic** | Try Google Vision first. If API key missing or fails, fall back to Tesseract |
| 6.5 | **Text parsing engine** | Regex + heuristic parser to extract: company name, contact person, phone, email, website, address, designation from raw OCR text |
| 6.6 | **OCR API endpoint** | `POST /api/ocr/scan` — accepts image upload, returns parsed fields |
| 6.7 | **Staff scan UI** | Mobile camera capture using `navigator.mediauseDevices.getUserMedia` or file upload. Shows extracted fields for editing before submission |
| 6.8 | **OCR history** | Store raw text + confidence score in lead record for auditing |

---

## Phase 7 — CRM API Integration

| # | Task | Details |
|---|------|---------|
| 7.1 | **CRM config CRUD API** | Admin configures per event: URL, method, headers, auth, payload mapping |
| 7.2 | **CRM config UI** | Form with field mapping builder: map `form_field_key` → `crm_field_name` |
| 7.3 | **CRM sync service** | `CrmSyncService` — builds HTTP request from config + lead data, sends to CRM API |
| 7.4 | **Retry queue** | After failed CRM call: create `sync_queue` entry with exponential backoff (1min, 5min, 30min, 2hr, 12hr) |
| 7.5 | **Retry worker** | Cron/scheduled job (node-cron) that processes `sync_queue` every minute. Picks PENDING entries where `next_retry_at <= now` |
| 7.6 | **Sync log** | Log every attempt: request, response, status, duration |
| 7.7 | **Manual retry** | Admin endpoint to manually retry a failed sync |
| 7.8 | **Webhook support** | Generic webhook integration — same retry queue, configurable URL + headers + payload template |

---

## Phase 8 — Google Sheets Integration

| # | Task | Details |
|---|------|---------|
| 8.1 | **Google OAuth setup** | Service account or OAuth2 flow for Google Sheets API access |
| 8.2 | **Sheets config CRUD API** | Per event: spreadsheet ID, worksheet name, column mapping |
| 8.3 | **Sheets config UI** | Select spreadsheet → worksheet → map form fields to columns |
| 8.4 | **Sheets sync service** | `GoogleSheetsSyncService` — append row to worksheet using mapped columns |
| 8.5 | **Retry integration** | Same `sync_queue` mechanism as CRM — Google Sheets failures go to the same queue |
| 8.6 | **Sync status UI** | Show sync status per lead, pending queue count, success/failure rates |
| 8.7 | **Spreadsheet browser** | API endpoint to list available spreadsheets and worksheets from connected Google account |

---

## Phase 9 — Admin Dashboard

| # | Task | Details |
|---|------|---------|
| 9.1 | **Dashboard layout** | Sidebar nav + top bar. Responsive (collapses on mobile) |
| 9.2 | **Stats API** | `GET /api/dashboard/stats` — total leads, today's leads, by event, by booth, by visitor type, API success/fail rates, sync status |
| 9.3 | **Dashboard page** | KPI cards (total, today, synced, pending), charts (Chart.js or Recharts): leads over time, by event, by visitor type |
| 9.4 | **Leads table page** | Paginated, sortable, filterable table. Columns: name, company, event, booth, visitor type, source, status, date. Search by name/email/phone |
| 9.5 | **Lead detail page** | Full lead info, raw form data, OCR text (if any), sync history, audit trail |
| 9.6 | **Export module** | `POST /api/leads/export` — generate Excel (exceljs), CSV, PDF (pdfkit/puppeteer). Stream download |
| 9.7 | **Sync dashboard** | Pending queue, success/failure rates, retry controls, last sync times |
| 9.8 | **Audit log viewer** | Filterable audit log table for admin actions |
| 9.9 | **User management** | CRUD for admin/staff users (SUPER_ADMIN only) |

---

## Phase 10 — Notifications

| # | Task | Details |
|---|------|---------|
| 10.1 | **Notification service** | Abstract `NotificationService` with channel implementations |
| 10.2 | **Email notifications** | Nodemailer + SMTP config. Templates for lead received, CRM sync success/failure |
| 10.3 | **Slack notifications** | Slack webhook integration. Send to configured channel on events |
| 10.4 | **Webhook notifications** | Generic HTTP webhook with configurable payload |
| 10.5 | **WhatsApp (future)** | Design the interface, stub implementation (Twilio API integration point) |
| 10.6 | **Notification config UI** | Per-event toggle channels, configure credentials, select trigger events |
| 10.7 | **Notification queue** | Async processing via BullMQ or in-process queue to avoid blocking lead submission |

---

## Phase 11 — Security Hardening

| # | Task | Details |
|---|------|---------|
| 11.1 | **Rate limiting** | Global: 100 req/min. Public lead form: 30 req/min per IP. Auth endpoints: 10 req/min |
| 11.2 | **Input validation** | Zod validation on all API inputs. Sanitize HTML (DOMPurify on frontend, xss on backend) |
| 11.3 | **CSRF protection** | csurf middleware for cookie-based auth flows |
| 11.4 | **reCAPTCHA** | Google reCAPTCHA v3 on public lead form. Configurable per event |
| 11.5 | **Helmet.js** | Security headers (already in scaffold) |
| 11.6 | **Secrets encryption** | Encrypt CRM auth credentials, Google service account keys at rest using AES-256 |
| 11.7 | **Audit logging** | Auto-log all create/update/delete operations via Prisma middleware |
| 11.8 | **API logging** | Request/response logging with morgan. Error logging with winston |

---

## Phase 12 — Offline Support & Sync

| # | Task | Details |
|---|------|---------|
| 12.1 | **Service Worker** | Register SW for caching static assets and form definitions |
| 12.2 | **IndexedDB storage** | Store offline submissions in IndexedDB when network is unavailable |
| 12.3 | **Network detection** | `navigator.onLine` + custom `NetworkProvider` context |
| 12.4 | **Auto-sync on reconnect** | Process IndexedDB queue when connection is restored |
| 12.5 | **Sync indicator** | UI component showing online/offline status + pending sync count |

---

## Phase 13 — Reporting & Analytics

| # | Task | Details |
|---|------|---------|
| 13.1 | **Reports API** | `GET /api/reports?event=&booth=&visitorType=&dateFrom=&dateTo=&source=&method=` |
| 13.2 | **Report builder UI** | Filter panel with multi-select for each dimension. Real-time chart updates |
| 13.3 | **Lead source analytics** | Pie/donut chart: QR vs OCR vs Manual |
| 13.4 | **Time-series charts** | Leads per hour/day during event. Compare across events |
| 13.5 | **Export from reports** | Apply current filters to Excel/CSV/PDF export |

---

## Phase 14 — Testing

| # | Task | Details |
|---|------|---------|
| 14.1 | **Unit tests** | Jest for backend services/utils. Vitest for frontend components |
| 14.2 | **API integration tests** | Supertest for Express routes. Test CRUD, auth, validation, error handling |
| 14.3 | **Form builder tests** | Dynamic form rendering, validation, field ordering |
| 14.4 | **OCR tests** | Mock Google Vision responses, test text parsing logic |
| 14.5 | **Sync queue tests** | Retry logic, exponential backoff, failure handling |
| 14.6 | **E2E tests** | Playwright: full lead capture flow (QR → form → submit → verify in dashboard) |
| 14.7 | **Load testing** | k6 or artillery: simulate 1000 concurrent lead submissions |

---

## Phase 15 — Deployment

| # | Task | Details |
|---|------|---------|
| 15.1 | **Vercel config** | `vercel.json` for frontend. Environment variables for API URL |
| 15.2 | **Railway config** | `railway.toml` for backend. Connect to Supabase PostgreSQL |
| 15.3 | **Supabase setup** | Create project, run migrations, configure connection pooling |
| 15.4 | **Environment variables** | Document all env vars: DATABASE_URL, JWT_SECRET, GOOGLE_VISION_API_KEY, GOOGLE_SHEETS_CREDS, etc. |
| 15.5 | **CI/CD** | GitHub Actions: lint → typecheck → test → deploy (frontend on push to main, backend on push to main) |
| 15.6 | **Domain setup** | Custom domain for frontend. CORS config for backend |
| 15.7 | **Monitoring** | Sentry for error tracking. Uptime monitoring |

---

## Phase 16 — Documentation

| # | Task | Details |
|---|------|---------|
| 16.1 | **README.md** | Project overview, setup instructions, architecture diagram |
| 16.2 | **API documentation** | Auto-generate from route definitions (swagger-jsdoc + swagger-ui) |
| 16.3 | **Deployment guide** | Step-by-step Vercel + Railway + Supabase deployment |
| 16.4 | **Admin guide** | How to set up events, forms, QR codes, CRM integration |
| 16.5 | **Environment reference** | All variables documented with descriptions |

---

## Build Order (Critical Path)

```
Phase 0 (Scaffold)
  └── Phase 1 (DB Schema)
       └── Phase 2 (Auth)
            └── Phase 3 (Events/Booths) ──→ Phase 4 (Form Builder)
                 │                               │
                 │                               └── Phase 5 (QR System)
                 │                                       │
                 │                                       └── Phase 6 (OCR)
                 │
                 └── Phase 7 (CRM Integration) ──→ Phase 8 (Google Sheets)
                      │
                      └── Phase 9 (Dashboard) ──→ Phase 13 (Reports)
                           │
                           └── Phase 10 (Notifications)
                                │
                                └── Phase 11 (Security)
                                     │
                                     └── Phase 12 (Offline)
                                          │
                                          └── Phase 14 (Testing)
                                               │
                                               └── Phase 15 (Deploy)
                                                    │
                                                    └── Phase 16 (Docs)
```

### Estimated Effort per Phase

| Phase | Description | Est. Days |
|-------|-------------|-----------|
| 0 | Scaffolding | 1-2 |
| 1 | Database Schema | 1-2 |
| 2 | Auth | 1-2 |
| 3 | Events/Booths | 2-3 |
| 4 | Form Builder | 4-5 |
| 5 | QR System | 2-3 |
| 6 | OCR | 3-4 |
| 7 | CRM Integration | 3-4 |
| 8 | Google Sheets | 2-3 |
| 9 | Dashboard | 4-5 |
| 10 | Notifications | 2-3 |
| 11 | Security | 2-3 |
| 12 | Offline Support | 2-3 |
| 13 | Reports | 2-3 |
| 14 | Testing | 5-7 |
| 15 | Deployment | 2-3 |
| 16 | Documentation | 2-3 |
| **Total** | | **~40-55 days** |

---

## Recommended Start

Begin with **Phase 0 → 1 → 2 → 3 → 4** in sequence. These form the foundation everything else builds on. Once Phase 4 (Form Builder) is complete, the core value proposition works and you can demo lead collection via the QR flow.
