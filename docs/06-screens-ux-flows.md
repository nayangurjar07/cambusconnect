# Cambus Connect — Screens & UX Flows (`06-screens-ux-flows.md`)

## 1. Driver & Conductor Portal UX Flows (`/driver/*` & `/conductor/*`)
All primary driver and conductor routes are purpose-built, task-specific operational screens:

1. **Telemetry Cockpit (`/driver/dashboard`):**
   - Auto-selects the logged-in Driver or Conductor's assigned `busNumber`.
   - Provides a single high-contrast **Start / Stop Live Location Broadcast** button wired to native `navigator.geolocation.watchPosition` and Screen WakeLock (`navigator.wakeLock`).
   - Displays live GPS coordinates, speed, accuracy (`±m`), active watcher count (`activeWatchers`), and current sync cadence (`15s High-Freq` when watched vs. `60s Eco Mode` when idle).
   - Displays a **Standby Mode** banner if a higher-priority crew member on the same bus is already broadcasting.
2. **Shift & Route Timeline (`/driver/schedule`):**
   - Displays active shift timings (`Shift 1`, `Shift 2`) and an interactive vertical stop-by-stop route checklist with sequential completion check-offs.
3. **One-Tap Incident Dispatch (`/driver/alerts`):**
   - Provides 1-tap dispatch buttons (`Traffic Delay +10m`, `Heavy Congestion +20m`, `Bus Full`, `Mechanical Breakdown`) that immediately update the bus status and broadcast notifications to Admin and Students.
4. **Field Pass Verification Terminal (`/driver/scan-pass`):**
   - Uses hardware camera QR scanning (`BarcodeDetector` / `getUserMedia`) with corner-bracket reticle and manual Roll No / Email / Pass ID fallback.
   - Flashes full-contrast **VALID PASS · BOARDED** (emerald) or **EXPIRED / WRONG BUS** (crimson) cards and automatically increments bus occupancy via atomic transactions.

---

## 2. Admin Workforce & Fleet Tracking Flows (`/admin/*`)

1. **Primary & Secondary Crew Assignment (`/admin/staff`):**
   - Replaces manual bus text inputs with a dynamic **Bus Number Dropdown** populated from registered `buses`.
   - Requires selecting either `Primary` or `Secondary (Sub)` slot for Drivers and Conductors.
   - Automatically checks for slot conflicts via `validateStaffRoleConflict()` and auto-selects the `Secondary` slot if `Primary` is already occupied on the chosen bus.
2. **Vehicle Inventory & Crew Slots (`/admin/buses`):**
   - Dense fleet operations table detailing every vehicle's Primary & Secondary Driver, Primary & Secondary Conductor, assigned route, capacity, live headcount, and real-time telemetry status (`LIVE` vs `UNAVAILABLE`).
   - Create and edit modal with dynamic route selection and capacity validation.
3. **Live Fleet Console & Missing Signal Alerts (`/admin/track` & `/admin/dashboard`):**
   - Polls `/api/bus-location?busId=...&watch=true` for sub-20s RAM-cached coordinates.
   - Automatically highlights any bus whose live location is offline or stale (`Location Unavailable`) in a prominent top warning banner and filterable sidebar roster.
   - Embeds interactive `FleetMap` with high-contrast transit markers and instant offline vehicle overlays.

---

## 3. Student Portal Flows (`/student/*`)

1. **Live Bus Tracking (`/student/track`):**
   - Real-time bus marker rendering with 15s RAM cache polling via `/api/bus-location`.
   - Registers student viewer as an active watcher (`watch=true`), automatically shifting the onboard driver device into 15-second High-Frequency mode.
   - Clear offline status alert banner if the assigned bus has not started live broadcasting.
2. **Wallet-Grade QR Bus Pass (`/student/bus-pass`):**
   - High-contrast digital boarding pass with cryptographic TOTP QR payload and countdown ring.
   - Displays student name, roll number, photo, assigned bus, validity dates, and dynamic anti-screenshot live timestamp.
3. **Student Operations Hub (`/student/home`, `/student/notifications`, `/student/lost-found`, `/student/support`):**
   - Route-filtered transit alerts, real-time lost-and-found ticket submission, and student helpdesk ticketing.
