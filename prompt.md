# Build an Exhibition Lead Capture Platform (Standalone Project)

I want to build a completely separate web application called **Exhibition Lead Capture**. This project should be independent of my CRM, but it must be designed so it can easily integrate with any CRM through APIs.

The application must be production-ready, scalable, mobile-first, and reusable for unlimited exhibitions.

---

# Primary Goal

Companies participate in exhibitions, expos, trade fairs, and dealer meets.

At every event, sales representatives collect hundreds or thousands of leads.

This platform should make lead collection extremely fast.

Leads can come from:

1. Visitor scans a QR code and fills the form.
2. Staff scans a visitor's business card using OCR.

Both methods should end in the same lead capture form.

---

# Data Storage

Every submitted lead should be stored in two places.

## Primary

Send data to an external CRM API.

The CRM API URL, authentication method, headers, and payload should be configurable from the admin panel.

I will provide the API later.

---

## Backup

Every submission must also be saved to Google Sheets.

If the CRM API fails:

* Save locally.
* Retry automatically.
* Keep Google Sheets as a permanent backup.

Never lose a lead.

Implement retry queues, logging, and failure tracking.

---

# Event Management

Support unlimited exhibitions.

Each event should contain:

* Event Name
* Description
* Organizer
* Venue
* City
* Country
* Start Date
* End Date
* Status
* Banner Image
* Logo

Examples:

* Jio Expo 2026
* IMTEX
* Auto Expo
* Dealer Meet
* Vendor Meet

---

# Booth Management

Each event can have multiple booths.

Example:

Hall A

Hall B

Reception

Left Booth

Right Booth

Outdoor Booth

Every booth should have its own QR codes.

---

# Visitor Types

Support configurable visitor categories.

Example:

* End User
* Competitor
* Dealer
* Distributor
* OEM
* Vendor
* Consultant
* Architect
* Builder

Admin should be able to add new visitor types without code changes.

---

# QR Code System

Each booth can generate multiple QR codes.

Examples:

Left Booth → End User

Right Booth → Competitor

Reception → Dealer

Each QR should automatically identify:

* Event
* Booth
* Visitor Type

No login should be required for visitors.

---

# Dynamic Form Builder (Core Feature)

The lead form must be completely dynamic.

Do NOT hardcode fields.

Create an admin interface where new fields can be added without deployment.

Support field types:

* Text
* Email
* Phone
* Number
* Textarea
* Dropdown
* Radio
* Checkbox
* Date
* Multi Select
* File Upload
* URL

Each field should support:

* Label
* Placeholder
* Required
* Default Value
* Validation Rules
* Display Order
* Active / Inactive
* Help Text
* Conditional Visibility (future-ready)

Example fields:

Company Name

Contact Person

Mobile Number

Email

Designation

City

State

Country

Website

GST Number

Industry

Annual Turnover

Products Interested

Budget

Remarks

Future fields should automatically appear without any code changes.

---

# Business Card OCR

Staff should be able to:

Click

Scan Business Card

Use the camera.

Extract:

* Company Name
* Contact Person
* Mobile
* Email
* Website
* Address
* Designation

Populate the dynamic form automatically.

Allow editing before submission.

---

# Admin Dashboard

Dashboard should include:

Total Leads

Today's Leads

Event-wise Leads

Booth-wise Leads

Visitor Type Statistics

API Success Rate

API Failure Rate

Google Sheet Sync Status

Pending Sync Queue

OCR Usage

QR Usage

Recent Leads

Export Data

---

# Integrations

Design the application so additional integrations can be added later.

Examples:

CRM APIs

Google Sheets

Webhook

Slack

Microsoft Teams

WhatsApp

Email

Zapier

Power Automate

---

# API Configuration

Admin should be able to configure:

CRM API URL

Method

Headers

Authentication

Payload Mapping

Success Response

Failure Response

Retry Settings

Timeout

No code changes should be required.

---

# Google Sheets

Connect Google Sheets.

Allow selecting:

Spreadsheet

Worksheet

Column Mapping

Every lead must also be written to Google Sheets.

---

# Offline Support

If internet fails:

Store leads locally.

Automatically sync later.

No lead should ever be lost.

---

# Security

Rate limiting

Spam protection

Google reCAPTCHA support

CSRF protection

Audit logs

Activity logs

API logs

Encrypted secrets

---

# Reports

Generate reports by:

Event

Booth

Visitor Type

Date

Source

Submission Method

Export:

Excel

CSV

PDF

---

# Notifications

Admin can enable:

Email notifications

WhatsApp notifications

Webhook notifications

Slack notifications

CRM success notifications

---

# Mobile Experience

The application will mainly be used at exhibitions.

It must be:

Mobile-first

Fast

Responsive

Touch-friendly

Large buttons

Minimal typing

Optimized for slow internet

---

# Technology Stack

Use modern technologies.

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS

Backend:

* Node.js
* Express (or NestJS if justified)

Database:

* PostgreSQL

Authentication:

* JWT

Storage:

* Local + Cloud ready

Architecture:

* Modular
* Clean
* Scalable
* SOLID principles
* Repository pattern where appropriate

---

# Deliverables

Create a production-ready application with:

* Complete project architecture
* Database schema
* ER diagram
* API architecture
* Folder structure
* Authentication
* Dynamic form builder
* Event management
* Booth management
* QR generation
* OCR module
* Google Sheets integration
* External CRM API integration
* Retry queue
* Offline sync strategy
* Reporting
* Admin dashboard
* Deployment guide
* Docker support
* Environment configuration
* Future scalability recommendations

Do not build this as a one-time exhibition application. Build it as a reusable SaaS platform that any company can use to manage lead collection across unlimited exhibitions and integrate with different CRMs.

free to host 