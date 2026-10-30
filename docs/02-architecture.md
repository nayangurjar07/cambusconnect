# 02 — System Architecture
# Cambus Connect Enterprise

**Version:** 1.0 (September 2026)

---

## 1. High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CAMBUS CONNECT PLATFORM                          │
├─────────────────┬─────────────────┬──────────────────┬─────────────┤
│  Web App        │  Flutter App    │  Backend Logic   │  Firebase   │
│  (Vite/React)   │  (Android/Web)  │  (Node.js/Expr.) │  Services   │
│                 │  [MVP In Dev]   │  [Minimal]       │             │
│  - Owner Portal │  - Student      │  - /api/bus-     │  - Auth     │
│  - Admin Portal │    Portal       │    location.js   │  - Firestore│
│  - Driver Portal│  - Admin        │  - /api/maps-    │  - IndexedDB│
│  - Student      │    Portal       │    config.js     │    Persist  │
│    Portal       │                 │  - /api/save-    │             │
│                 │                 │    settings.js   │             │
└─────────────────┴─────────────────┴──────────────────┴─────────────┘
```

---

## 2. Current Multi-Tenant Architecture (As-Built)

> ⚠️ **Important:** The multi-tenant architecture described in planning materials and visible in `firebase-config.js` (legacy) and `TenantContext.jsx` is **not operationally implemented**. Tenant switching is a **stub**. The platform currently operates as a **single-tenant system** against one Firebase project, with the multi-tenant layer scaffolded but disabled.

### Intended Architecture (Planned)
```
  cambusconnect.in/
  ├── iist.cambusconnect.in     → Firebase Project: cambus2-9bbb1  (LIVE)
  ├── medicaps.cambusconnect.in → Firebase Project: cambus-medicaps (PLACEHOLDER)
  └── [new-client].cambusconnect.in → Firebase Project: cambus-[client]
```

Each subdomain would resolve to a different Firebase project via `firebase-config.js`'s `getFirebaseConfig()` (domain-detection logic exists in legacy file). The React app's `src/config/firebase.js` reads from `.env` variables — it does **not** do domain detection, making it single-tenant.

### Actual Architecture (As-Built, September 2026)
```
  All portals → Single Firebase Project (cambus2-9bbb1 / indoreinstitute.com)
              → Single Firestore database
              → tenantId = "default" hardcoded in auth.js
```

### Tenancy in Data Layer
The `tenantId` field is present on user/student documents and referenced in rules (`/tenants/{tenantId}`), but:
- `loginUser()` always assigns `tenantId = 'default'`
- There is no Firestore query that filters by `tenantId` — all data is shared in one namespace
- The `/tenants` and `/sub-institutes` collections exist in rules but have no corresponding service code

---

## 3. Component Architecture (Web App)

```
src/
├── config/
│   └── firebase.js           — Firebase SDK init, exports, createSecondaryAuthUser()
├── contexts/
│   ├── AuthContext.jsx       — Auth state, role resolution, profile fetch
│   ├── TenantContext.jsx     — Branding, tenant key (stub switching)
│   └── ToastContext.jsx      — Global toast notification system
├── services/                 — Domain service layer (primary data access)
│   ├── auth.js               — loginUser(), logoutUser(), getCurrentSession()
│   ├── students.js           — Student CRUD, CSV import, schema, TOTP
│   ├── transit.js            — Bus CRUD, route CRUD, location updates, boardings
│   ├── workforce.js          — Staff CRUD, shift config, driver sessions
│   ├── communications.js     — Notifications, support tickets, lost & found
│   ├── qrDecoder.js          — Multi-engine QR image decoder (5-engine fallback)
│   └── googleMaps.js         — Maps API key fetch/update via /api/maps-config
├── pages/
│   ├── Landing.jsx           — Public marketing landing page
│   ├── Login.jsx             — Unified login with role-specific portal selection
│   ├── owner/Dashboard.jsx   — Owner tenant overview
│   ├── admin/                — 11 admin pages (full feature set)
│   ├── driver/               — 3 driver pages
│   └── student/              — 8 student pages
├── components/
│   ├── layout/               — AppShell (auth guard + layout), Sidebar, Topbar, MobileNav
│   ├── domain/               — FleetMap, PassCard, StudentCsvImportModal, ValidateBusPassScanner, etc.
│   └── ui/                   — 13 reusable primitive components (Button, Card, Modal, etc.)
└── utils/
    ├── crypto.js             — TOTP: generateQrSecret(), generateTotpPayload(), verifyTotp()
    └── cn.js                 — className utility (clsx + tailwind-merge)
```

---

## 4. Data Flow Diagrams

### Auth Flow
```
User enters email+password
      ↓
signInWithEmailAndPassword(auth, email, password)
      ↓
getDoc(db, 'users', email)        [Admin, Driver, Owner]
      ↓ (if not found)
getDoc(db, 'students', email)     [Student]
      ↓
Validate role match (if expectedRole passed)
      ↓
Check passValidity expiry (students only)
      ↓
Store in localStorage + React state
      ↓
AppShell renders correct portal
```

### Real-Time Bus Tracking Flow
```
Driver (mobile) → GPS watchPosition()
      ↓
updateBusLocation(busId, lat, lng, speed) → Firestore /buses/{busId}
      ↓
onSnapshot(collection(db, 'buses')) → FleetMap.jsx / AdminTracking.jsx
      ↓
Leaflet map re-renders bus markers in real time
```

### QR Pass Verification Flow
```
Student → BusPass.jsx → generateTotpPayload(email, qrSecret)
      ↓ QR contains: { email, totp: SHA256(secret:timeIndex)[0:16], t: timeIndex }
Driver/Admin → QR Camera / Image Upload
      ↓
getStudentProfile(scannedEmail) → Firestore /students/{email}
      ↓
verifyTotp(scannedTotp, student.qrSecret)
      [checks current window + previous window for grace period]
      ↓
if valid: incrementBusHeadcount(busId, +1) + logBoarding(...)
      ↓
sets submitted-boardings/{id} for daily record
```

---

## 5. Backend API (Minimal Express Server)

`server.js` + `/api/` folder provides a thin Node.js Express layer:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/maps-config` | GET | Returns Google Maps API key (reads from in-memory / env) |
| `POST /api/maps-config` | POST | Updates Google Maps key (admin settings) |
| `POST /api/bus-location` | POST | Legacy location update endpoint (may be superseded by direct Firestore writes) |
| `POST /api/save-settings` | POST | Legacy settings save endpoint |

> *The React/Vite app uses Firestore directly for almost everything. The Express server is used only for the Maps key proxy and legacy endpoints.*

---

## 6. Flutter App Architecture (MVP — In Development)

```
lib/
├── app/                      — CambusConnectApp widget, GoRouter setup
├── data/                     — Firestore data layer (repositories)
├── features/
│   ├── auth/                 — login_screen.dart, auth_controller.dart
│   ├── student/              — home, pass, tracking, notifications, buses, profile
│   ├── admin/                — Admin screens (early stage)
│   ├── driver/               — Driver screens (early stage)
│   ├── owner/                — Owner screens (early stage)
│   └── support/              — Support screens
```

**State management:** Riverpod (`flutter_riverpod: ^3.4.3`)  
**Routing:** GoRouter (`go_router: ^18.0.1`)  
**Maps:** `google_maps_flutter: ^2.5.3`  
**QR scanning:** `mobile_scanner: ^6.0.3`  
**QR generation:** `qr_flutter: ^4.1.0`  
**TOTP:** `crypto: ^3.0.7`

> ⚠️ **Critical inconsistency:** Flutter `main.dart` seeds dummy students to the `/users` collection. The web app stores students in the `/students` collection. These are different Firestore collections. The Flutter app and web app may not see each other's student data.

---

## 7. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19.x |
| Build Tool | Vite | 8.x |
| Styling | Tailwind CSS | 4.x |
| Routing | React Router DOM | 7.x |
| Icons | Lucide React | 1.x |
| Firebase SDK | firebase (JS modular) | 12.x |
| QR Decode | jsQR + Html5Qrcode + BarcodeDetector | multi-engine |
| Maps | Leaflet (primary) + Google Maps (optional) | 1.9.x |
| Mobile App | Flutter + Dart | SDK ^3.13.1 |
| Backend | Node.js + Express (minimal) | — |
| Hosting | Firebase Hosting (firebase.json present) | — |

