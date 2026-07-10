# Feature Request: AI Website Roast & Audit Module for Expo Lead Hub

Do NOT create a new project.

Extend the existing Expo Lead Hub application by adding a new module called **AI Experience Hub**.

The implementation must follow the current architecture, design system, authentication, routing, and coding standards already used in the project.

---

# Purpose

During exhibitions and trade shows, visitors can enter their company website URL.

The AI will automatically analyze their homepage and provide a fun, engaging website roast followed by a professional website audit.

The goal is to attract visitors to our booth, generate conversations, and automatically capture qualified sales leads.

---

# Navigation

Add a new sidebar section:

AI Experience Hub

Inside it create:

• Website Roast
• Website Audit
• Analysis History
• Settings

---

# Website Roast Flow

User enters:

Website URL

Example

https://company.com

Click:

🔥 Roast My Website

Backend should

1. Launch Playwright
2. Capture Desktop Screenshot
3. Capture Mobile Screenshot
4. Run Lighthouse Audit
5. Extract HTML Title and Meta Description
6. Pass all collected information to AI

AI should generate

• Funny roast
• UI comments
• UX comments
• Branding comments
• CTA comments
• Color comments
• Typography comments
• Mobile comments

The roast should be humorous but respectful and must avoid offensive or abusive language.

---

# Voice Narration

After the roast is generated

Generate AI narration using a configurable Text-to-Speech provider.

Display

Play

Pause

Replay

---

# Live Highlight Mode

Display the captured screenshot.

While narration is playing

Highlight

Hero Section

Navigation

Buttons

Cards

Forms

Footer

Use

Glow

Animated border

Zoom

Pointer

No video rendering is required in MVP.

---

# Professional Audit

Add another tab

Professional Audit

Generate

Overall Score

UI Score

UX Score

SEO Score

Accessibility Score

Performance Score

Conversion Score

Each section should include

Current problem

Business impact

Recommendation

Priority

Estimated improvement

---

# AI Suggestions

Generate

Improved Hero Headline

Better CTA

Suggested Color Palette

Typography Recommendation

Trust Elements

Missing Sections

Conversion Improvements

Mobile Improvements

---

# Lead Capture

Before showing the final report

Display a modal

Name

Company

Email

Phone

Designation

Consent Checkbox

Save this information into the existing Expo Lead Hub Lead Management module.

Associate every lead with

Event

Booth

Campaign

Timestamp

---

# QR Code

Generate a QR code that links to the completed report.

The QR code can be scanned by visitors to open their report on their own device.

---

# Database

Reuse the existing PostgreSQL database.

Create new tables only if required.

Possible tables

website_analysis

analysis_history

analysis_settings

voice_settings

Do not duplicate existing Lead tables.

---

# Dashboard

Create analytics widgets

Total Websites Analyzed

Average Website Score

Average Roast Duration

Most Common Website Problems

Most Requested Improvements

Leads Generated from AI Roast

---

# Settings

Allow administrators to configure

Playwright timeout

Lighthouse timeout

AI Provider

Text-to-Speech Provider

Maximum Roast Duration

Voice Language

Brand Theme

---

# Backend

Node.js

Express

REST APIs

Background Job Queue for analysis

Retry handling

Logging

Error monitoring

---

# Frontend

React

TypeScript

Vite

Tailwind CSS

Responsive Design

Modern animations

Dark and Light mode

Loading states

Progress indicators

Toast notifications

---

# UI Theme

Keep the existing Expo Lead Hub design.

Use glassmorphism cards.

Gradient accents.

Smooth animations.

Professional enterprise appearance.

---

# Code Quality

Use reusable React components.

Strict TypeScript.

Modular architecture.

Production-ready code.

Clean folder structure.

Proper error handling.

Proper API abstraction.

No mock data.

Everything should integrate with the existing Expo Lead Hub project.
