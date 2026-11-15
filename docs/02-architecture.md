# Cambus Connect — System Architecture (`02-architecture.md`)

## 1. High-Level Overview
Cambus Connect is a multi-portal campus transit operations platform built with React (Vite), Tailwind CSS, Firebase Authentication, Cloud Firestore, Firebase Realtime Database, and Serverless API Routes (`/api/*`).

The platform serves four distinct operational portals:
- **Student Portal (`/student/*`):** Live bus tracking (`Track.jsx`), digital QR bus pass (`BusPass.jsx`), route lookup, and alerts.
- **Driver & Conductor Portal (`/driver/*`, `/conductor/*`):** Hardware GPS telemetry cockpit (`Dashboard.jsx`), route stop checklist (`Schedule.jsx`), one-tap incident dispatch (`Alerts.jsx`), and QR pass terminal (`ScanPass.jsx`).
- **Admin Portal (`/admin/*`):** Split-pane live fleet console (`Tracking.jsx`), workforce assignment with Primary/Secondary conflict validation (`Staff.jsx`), bus/route management, and shift configuration.
- **Owner Portal (`/owner/*`):** Executive KPIs and multi-tenant oversight.

---

## 2. Zero-Waste Live Telemetry & Backend RAM Caching Architecture

To prevent N×M Firebase read/write amplification when hundreds of students track buses simultaneously, Cambus Connect implements a **Demand-Driven 3-Tier Telemetry Pipeline**:

### Tier 1: Onboard Hardware Geolocation & Single Active Stream Guard
- Both the **Driver Portal** and **Conductor Portal** capture real device coordinates via `navigator.geolocation.watchPosition` (`enableHighAccuracy: true`) with Screen WakeLock (`navigator.wakeLock`).
- **Priority Hierarchy:** `Primary Driver (1)` > `Secondary Driver (2)` > `Primary Conductor (3)` > `Secondary Conductor (4)`.
- If both a Driver and Conductor are logged into the same bus simultaneously, lower-priority crew members are automatically placed in **Standby Mode** while the higher-priority device broadcasts.

### Tier 2: Serverless In-Memory Telemetry Cache (`/api/bus-location.js`)
- **Write Path (`POST /api/bus-location`):** Driver/Conductor devices push coordinates to the backend API route, which immediately updates `busTelemetryMemoryCache[busId]` in server RAM (0 Firebase cost).
- **Read Path (`GET /api/bus-location?busId=...&watch=true`):** Student and Admin maps poll the cached endpoint every 15 seconds. Requests served from server RAM incur **0 Firestore/RTDB reads**.

### Tier 3: Watcher-Aware Dynamic Throttling
- Every `GET` request from a Student or Admin registers an `activeWatcher` lease in `busTelemetryMemoryCache[busId].watchers` with a **45-second TTL**.
- **High-Frequency Mode (`activeWatchers > 0`):** Driver device broadcasts every **15 seconds**, and Firebase syncs every **25 seconds**.
- **Eco / Idle Mode (`activeWatchers === 0`):** When no student or admin is actively viewing a bus, the driver's sync cadence automatically relaxes to **60–120 seconds** (or when displacement exceeds **120 meters**), cutting idle Firebase writes by over **80%** while keeping the Admin's online heartbeat green.

---

## 3. High-Fidelity Mapping Engine
- **Native Google Maps Integration:** All map rendering (`FleetMap.jsx`, `Tracking.jsx`, `Track.jsx`) uses native Google Maps JavaScript API with vector markers, custom vehicle callouts, smooth camera re-centering, and traffic layers.
- **Zero Third-Party Tile Dependencies:** No external OSM or Leaflet dependencies in production tracking pipelines.
- **Dynamic Key Management:** Fetches the Google Maps API key via `/api/maps-config` with runtime fallback and strict admin key rotation capabilities.

---

## 4. Hardware-Style Pass Verification & Headcount Synchronization
- **Optical Scanner HUD:** High-contrast camera viewport with corner-bracket framing, dual-engine QR parsing (`BarcodeDetector` native API with `jsQR` high-speed frame fallback), and instantaneous full-contrast flash cards (`VALID PASS · BOARDED`, `WRONG BUS`, `EXPIRED PASS`).
- **Headcount Ledger:** Every valid scan triggers an atomic transaction on `buses/{busId}` (`incrementBusHeadcount`) and logs a passenger boarding record (`logBoarding`) in both `trips` and `daily_boardings` collections.
- **Manual Input Fallback:** Supports keyboard entry of Student Email, College ID, or Pass ID for students with damaged mobile screens.
