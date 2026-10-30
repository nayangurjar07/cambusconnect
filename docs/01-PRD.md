# 01 — Product Requirements Document (PRD)
# Cambus Connect Enterprise

**Version:** 1.0 (September 2026)  
**Status:** Active Development — Refactor Phase  
**Author:** Inferred from codebase — please confirm  

---

## 1. Problem Statement

Campus bus transportation at Indian educational institutions is largely undigitized. Administrators manually track attendance, drivers lack real-time tools, and students have no visibility into bus locations or pass validity. Lost item tracking, support ticketing, and workforce scheduling are handled through spreadsheets or verbal communication.

**Core pain points identified in the codebase:**
- No digital student pass (QR-based) system → schools rely on paper passes
- No real-time fleet visibility → admin cannot see where buses are
- No structured driver-to-institution communication channel
- No automated boarding count → headcounts are manual
- No centralized lost & found system
- No shift management / driver session logging

---

## 2. Target Users

| Role | Description | Count (Typical Deployment) |
|------|-------------|---------------------------|
| **Owner** | Platform operator (SaaS provider) managing all institutional clients | 1 per platform |
| **Admin** | Campus transport coordinator — manages fleet, routes, students, staff | 1–3 per institution |
| **Driver / Conductor** | Bus operators who scan passes, report status, and broadcast alerts | 5–30 per institution |
| **Student** | Bus pass holders who view their pass, track their bus, and submit requests | 100–5,000 per institution |

> *Inferred from codebase — please confirm: "conductor" and "driver" are treated as equivalent roles in `firestore.rules` (`isDriverOrConductor()` helper). In the UI, only "driver" appears as a distinct portal.*

---

## 3. Product Goals

### Primary Goals
1. **Digitize the bus pass** — TOTP-secured QR code replacing paper passes
2. **Enable real-time fleet tracking** — GPS telemetry from drivers' phones to admin map
3. **Automate boarding verification** — Camera/image-based QR scan with audio feedback
4. **Provide student self-service** — Dashboard, pass display, notifications, lost & found, support
5. **Support campus operations** — Driver session management, shift scheduling, staff management

### Secondary Goals
6. **Multi-institution SaaS** — Single platform serving multiple campuses as isolated tenants
7. **Bulk student import** — CSV import with schema validation for onboarding thousands of students
8. **Offline capability** — Firestore IndexedDB persistence for driver portal during poor connectivity

---

## 4. Functional Scope (What Is Built)

### ✅ Student Portal (Web + Flutter MVP planned)
- Personal dashboard with bus info, trip count, eco savings
- TOTP QR Bus Pass (rotates every 15 minutes)
- Bus tracker (Leaflet map / Google Maps, live via Firestore subscription)
- Route/stop search
- Notification feed (real-time, route-filtered)
- Lost & Found reporting with fallback to support queue
- Support ticket submission
- Profile view

### ✅ Driver Portal (Web)
- Shift start/stop with GPS `watchPosition` → live Firestore location updates
- Passenger headcount (+1 / −1 / reset with Firestore transaction)
- Bus status broadcast (On Time / Delayed / Breakdown)
- Alert composition and push to `notifications` collection
- Camera QR pass scanning (same `Html5Qrcode` scanner as admin)
- Support contact

### ✅ Admin Portal (Web)
- Dashboard: fleet metrics, bus status table, recent alerts
- Fleet management: CRUD for buses with uniqueness validation (number, registration, driver)
- Route management: CRUD with stop array, shift assignment
- Student management: paginated table, add/edit/delete, CSV bulk import, schema editor, bulk password generator
- Staff management: add/remove drivers & conductors with Firebase Auth creation
- Shift management: live sessions, history log, shift timing configuration
- QR pass scanner: camera scan + image upload, check-in / check-out / verify modes, scan lockout policy
- Notifications: create/delete broadcast notifications
- Helpdesk: view and resolve student support tickets
- Settings: branding (name, logo, color), GPS interval, Google Maps key, pass lockout policy, student schema editor

### ✅ Owner Portal (Web)
- Platform overview: tenant count, total fleet, daily boardings (hardcoded placeholders — see risks)
- Tenant directory: list of registered campuses with Firebase Project ID
- Add Tenant modal (UI only — backend saving not implemented)
- Shared `AdminSettings` page reused for Owner settings

---

## 5. Out of Scope (Current Version)

| Feature | Status |
|---------|--------|
| iOS native app | Not started |
| Payment / pass fee collection | Not present |
| Firebase Cloud Messaging (push notifications) | Not implemented (in-app only via Firestore) |
| Admin analytics / historical reports | Not present |
| Parent portal / guardian app | Not present |
| Fleet maintenance scheduling | Not present |
| Route optimization (AI) | Present as `cambus-enterprise-ecosystem.js` (legacy, not connected to React app) |
| Student seat reservation | Not present |
| True multi-Firebase-instance switching | Stub/disabled (see Architecture doc) |

---

## 6. Non-Functional Requirements

| Requirement | Specification |
|-------------|--------------|
| **Security** | TOTP-secured QR (SHA-256, 15-min window, 1-window grace) |
| **Auth** | Firebase Authentication (email/password) |
| **Offline** | Firestore IndexedDB persistence enabled on `db` init |
| **Performance** | In-memory TTL cache (5 min) for student profiles; 1-min cache for count queries |
| **Scale** | Batch import up to 400 students/Firestore batch, paginated at 25 rows |
| **Responsiveness** | Mobile-first layout with `MobileNav`, `Sidebar`, `Topbar` responsive breakpoints |
| **Browser** | Modern Chromium-based browsers required (BarcodeDetector API preference) |

---

## 7. Constraints & Risks Identified

| Risk | Severity | Detail |
|------|----------|--------|
| **Auth trusts localStorage for role** | 🔴 HIGH | `isAuthenticated` in `AuthContext` is `true` if `localStorage.isLoggedIn === 'true'` even if Firebase session is null. Role spoofing is possible client-side. |
| **Users doc keyed by email (not UID)** | 🟡 MEDIUM | Firestore doc IDs = email address. Email change = broken profile. Firebase UID not used as primary key. |
| **Owner dashboard metrics hardcoded** | 🟡 MEDIUM | "48 Buses", "3,840", "99.98%" are static strings, not live aggregations. |
| **Tenant switching disabled** | 🟡 MEDIUM | `switchTenant()` and `changeTenant()` are stubs. Multi-tenant is aspirational, not operational. |
| **Google Maps key in localStorage** | 🟡 MEDIUM | `localStorage.setItem('custom_maps_key', newKey)` exposes API key client-side. |
| **No Firebase Rules for `tenants` write auth** | 🟡 MEDIUM | Any `isAdmin()` can write to `/tenants` — no owner-only guard. |
| **Driver bus assignment is fuzzy** | 🟡 MEDIUM | Bus lookup uses `driverEmails[]`, `driver` name match, OR `assignedBus` profile field — no single canonical field. |
| **Password generation is `Math.random()`** | 🟡 MEDIUM | `bulkGeneratePasswords()` uses `Math.random()` (not crypto-random). |
| **Flutter seeds to `users` collection, web to `students`** | 🔴 HIGH | Flutter `seedDummyStudents()` writes to `/users`, web app writes students to `/students`. Two different collections for the same entity. |

