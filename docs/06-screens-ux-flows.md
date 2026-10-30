# 06 — Screens & UX Flows
# Cambus Connect Enterprise

**Version:** 1.0 (September 2026)

---

## 1. Public Pages

### Landing Page (`/`)
**File:** `src/pages/Landing.jsx` (9.9 KB)  
**Purpose:** Marketing/product homepage  
**Features:**
- Hero section
- Feature highlights
- Call-to-action to login portals

### Login Page (`/login`)
**File:** `src/pages/Login.jsx` (8.9 KB)  
**Purpose:** Unified login with role selection tabs  
**Flow:**
```
User lands on /login
  → Sees 4 tabs: Student | Driver | Admin | Owner
  → Selects tab (sets expectedRole context)
  → Enters email (or username auto-suffixed) + password
  → loginUser(email, password, role)
  → On success: navigate to /{role}/home or /{role}/dashboard
  → On error: display Firebase error or role-mismatch message
```

---

## 2. Student Portal (`/student/*`)

### Student Dashboard (`/student/home`)
**File:** `src/pages/student/Dashboard.jsx`

**Screen Layout:**
1. **Welcome Bar** — Avatar, greeting (Good morning/afternoon/evening), notification bell with unread dot
2. **Search Bar** — Pill-shaped search with "Find" button → navigates to `/student/search`
3. **Designated Stop Pill** — Shows `profile.pickupStop`, link to change via search
4. **Quick Action Grid** — 4 circular buttons: Live Track, Bus Pass, Routes, Support
5. **Active Transit Plan Card** — Blue card showing route name, Pass ID (enrollment), QR link, validity, assigned bus
6. **Ongoing Transit Card** — `TransitTimelineCard` with from/to stops, ETA, status
7. **Impact Stats** — CO₂ saved (trips × 2.3 kg), total rides count
8. **Recent Announcements** — Last 3 notifications filtered to student's route

**Data Sources:** `subscribeToBus(profile.assignedBusId)`, `subscribeToNotifications()`, `getStudentTripsCount(email)`

---

### Bus Pass (`/student/bus-pass`)
**File:** `src/pages/student/BusPass.jsx` (537 bytes — stub/placeholder)

> ⚠️ **Currently a stub** (537 bytes). Should render the TOTP QR code using `generateTotpPayload()` and `PassCard` component. The `PassCard.jsx` component exists in domain components but is not yet wired into `BusPass.jsx`.

---

### Live Track (`/student/track`)
**File:** `src/pages/student/Track.jsx` (2.3 KB)

**Purpose:** Shows student's assigned bus on a map  
**Note:** Small file — likely uses `FleetMap` component or placeholder.

---

### Route Search (`/student/search`)
**File:** `src/pages/student/Search.jsx` (3.8 KB)

**Purpose:** Search buses, routes, and stops  
**Features:** Query params for pre-populated search (`?q=...`)

---

### Notifications (`/student/notifications`)
**File:** `src/pages/student/Notifications.jsx` (1.4 KB)

**Purpose:** Full notification feed (route-filtered)

---

### Lost & Found (`/student/lost-found`)
**File:** `src/pages/student/LostFound.jsx` (16.7 KB)

**Features:**
- Real-time list of all lost items
- Filter by status (all/lost/found/claimed)
- Search by item name
- "Report Lost Item" modal with:
  - Item name, description
  - Location type: BUS or CAMPUS
  - Bus number (if BUS) or campus location
  - Contact phone
- Submission shows confirmation with reference number

---

### Support (`/student/support`)
**File:** `src/pages/student/Support.jsx` (3.8 KB)

**Purpose:** Submit support tickets to admin helpdesk  
**Flow:** Fill subject/category/message → `submitSupportQuery()`

---

### Profile (`/student/profile`)
**File:** `src/pages/student/Profile.jsx` (2.2 KB)

**Purpose:** View personal profile info (name, email, roll no, route, bus, stop)

---

## 3. Driver Portal (`/driver/*`)

### Driver Dashboard (`/driver/dashboard`)
**File:** `src/pages/driver/Dashboard.jsx` (13 KB — richest driver page)

**Screen Layout (2-column on desktop, stacked on mobile):**

**Left Column — Main Controls:**
1. **Shift Control Card:**
   - Bus number + assigned route label
   - Start/End Shift button (green → red toggle)
   - Telemetry grid: Shift Time (HH:MM:SS counter), Live GPS coordinates, Bus Status indicator, Live Riders count
   - Transit Condition buttons: On Time / Delayed / Breakdown
2. **Alert Form Card:**
   - Alert type selector (Traffic Delay / Breakdown / Max Capacity / Route Notice)
   - Message textarea
   - "Broadcast to Riders" button → `createNotification()`

**Right Column:**
1. **Headcount Counter Card:**
   - Large number display
   - +1 / -1 buttons → `updateBusHeadcount()`
   - Reset to 0 (with `window.confirm`)
2. **Alert Form Card** (same as above — displayed in right column on large screens)

**Key Behaviors:**
- On shift start: `navigator.geolocation.watchPosition()` → `updateBusLocation()` every GPS change
- Bus lookup: first by `driverEmails[]`, then by driver name match, then by `assignedBus` profile field, then `list[0]` as fallback

---

### Scan Pass (`/driver/scan-pass`)
**File:** `src/pages/driver/ScanPass.jsx` (32 KB)

**Purpose:** QR code pass scanning at bus boarding  
**Features:**
- Camera-based QR scanning via `Html5Qrcode`
- Image upload scanning via `decodeQrFromImageFile()`
- TOTP verification via `verifyTotp()`
- Real-time boarding record creation

---

### Support (`/driver/support`)
**File:** `src/pages/driver/Support.jsx` (2.3 KB)

**Purpose:** Driver contacts transport admin

---

### Stubbed Routes
- `/driver/alerts` → redirects to `DriverDashboard` (not a separate page)
- `/driver/schedule` → redirects to `DriverDashboard` (not a separate page)

---

## 4. Admin Portal (`/admin/*`)

### Admin Dashboard (`/admin/dashboard`)
**File:** `src/pages/admin/Dashboard.jsx` (5.8 KB)

**Layout:**
- 4 metric cards: Total Fleet, Active Riders, On Time count, Issues count
- Fleet Status table (8 buses max, live via `subscribeToBuses`)
- Recent Alerts panel (5 most recent notifications)

---

### Fleet Tracking (`/admin/track`)
**File:** `src/pages/admin/Tracking.jsx` (8.7 KB)

**Purpose:** Admin real-time map of entire fleet  
**Features:**
- `FleetMap` component (Leaflet-based, 519 lines)
- GPS staleness detection: LIVE (<3 min), STALE (3-15 min), OFFLINE (>15 min)
- Bus selection panel with status, headcount, ETA
- Optional Google Maps overlay

---

### Buses (`/admin/buses`)
**File:** `src/pages/admin/Buses.jsx` (13.3 KB)

**Features:**
- List of all buses with status, route, driver, headcount
- Add Bus modal (number, registration, route, capacity, driver, conductor)
- Edit Bus modal
- Delete Bus (with confirm)
- Uniqueness validation: bus number, registration, driver, conductor

---

### Routes (`/admin/routes`)
**File:** `src/pages/admin/Routes.jsx` (17.4 KB)

**Features:**
- List of routes with stop count, active/inactive status
- Add Route: code, name, stops (dynamic add/remove), shift assignment
- Edit Route
- Delete Route
- Uniqueness validation: code, name

---

### Students (`/admin/students`)
**File:** `src/pages/admin/Students.jsx` (35.8 KB — largest page)

**Features:**
- Paginated student table (25 per page, cursor-based)
- Filters: route, status (Active/Inactive/Revoked), name search
- Select all / bulk select checkboxes
- Add Student modal (full form)
- Edit Student modal
- Delete Student (with confirm)
- CSV Import modal → `StudentCsvImportModal.jsx`
- Download CSV template
- Bulk Generate Passwords (for selected students)
- Student schema customization link

---

### Staff (`/admin/staff`)
**File:** `src/pages/admin/Staff.jsx` (14 KB)

**Features:**
- Staff list filtered to drivers, conductors, admins
- Add Staff modal (name, email, role, phone, assigned bus, license)
- Edit Staff
- Delete Staff

---

### Shifts (`/admin/shifts`)
**File:** `src/pages/admin/Shifts.jsx` (25.9 KB)

**Tabs:**
1. **Live Runs** — Active `driverSessions` with bus/route/driver/headcount info
2. **History** — Stopped sessions, filterable by date/driver search
3. **Submitted Boardings** — `submitted-boardings` collection records
4. **Shift Settings** — Configure Shift 1 and Shift 2 (name, times, active days, enable/disable)

---

### Scan Pass (`/admin/scan-pass`)
**File:** `src/pages/admin/AdminScanPass.jsx` (40.5 KB — largest file)

**Features:**
- Select bus from dropdown
- Scan Mode selector: Check-in / Check-out / Verify
- Camera QR scanner (Html5Qrcode)
- Image upload QR scanner (multi-engine fallback)
- Manual ID entry
- Fast Mode toggle
- Late Override toggle
- Same-Bus Scan Lock (prevents student boarding different bus)
- Configurable lockout period (default 240 min)
- TOTP verification with audio feedback (Web Audio API tones)
- Live boarding log panel
- `ValidateBusPassScanner` embedded component

---

### Notifications (`/admin/notifications`)
**File:** `src/pages/admin/Notifications.jsx` (6.2 KB)

**Features:**
- List of recent notifications with delete
- Create notification form: title, message, type, target route

---

### Helpdesk (`/admin/helpdesk`)
**File:** `src/pages/admin/HelpDesk.jsx` (12.4 KB)

**Features:**
- List of all support tickets with status badges
- Filter/search
- View ticket detail
- Update status (Pending → In Progress → Resolved)
- Add admin notes

---

### Settings (`/admin/settings`)
**File:** `src/pages/admin/Settings.jsx` (17 KB)

**Tabs:**
1. **General** — Institution name, short name, primary color, GPS telemetry interval, pass lockout minutes, auto-verify boardings toggle
2. **Maps** — Google Maps API key input (saved to backend + localStorage)
3. **Security** — Pass expiry policy, boarding lockout settings
4. **Student Schema** — `StudentSchemaEditor` component (add/remove/reorder student fields)

---

## 5. Owner Portal (`/owner/*`)

### Owner Dashboard (`/owner/dashboard`)
**File:** `src/pages/owner/Dashboard.jsx` (7.6 KB)

**Layout:**
- 4 platform KPI metrics (⚠️ hardcoded: "48 Buses", "3,840" boardings, "99.98%" health)
- University Campuses grid — shows tenants from `TenantContext.allTenants`
- Each tenant card shows: Firebase Project ID, tenant key, "Switch Tenant" button (stub)
- "Add Tenant" button → modal with Firebase project credentials form → currently only shows toast, doesn't persist

---

## 6. Navigation Structure

### Sidebar (`Sidebar.jsx`)
Role-conditional navigation items:

| Role | Nav Items |
|------|-----------|
| Student | Home, Live Track, Bus Pass, Search, Notifications, Lost & Found, Support, Profile |
| Driver | Dashboard, Scan Pass, Alerts\*, Schedule\*, Support |
| Admin | Dashboard, Track, Buses, Routes, Students, Staff, Shifts, Scan Pass, Notifications, Helpdesk, Settings |
| Owner | Dashboard, Tenants\*, Settings |

*\* Stub routes — currently render parent dashboard component*

### Mobile Navigation (`MobileNav.jsx`)
Bottom tab bar for mobile viewports — role-specific quick actions.

---

## 7. Component Library (UI Primitives)

| Component | Purpose |
|-----------|---------|
| `Button.jsx` | Multi-variant button (primary/secondary/outline/ghost/danger/success) with loading state |
| `Card.jsx` | Container card with optional header/body |
| `Input.jsx` | Labeled text input with error state |
| `Select.jsx` | Labeled select dropdown |
| `Modal.jsx` | Accessible modal overlay |
| `Badge.jsx` | Status/category badge (primary/success/warning/danger/neutral) |
| `Tabs.jsx` | Horizontal tab navigation |
| `DataTable.jsx` | Simple table wrapper |
| `MetricCard.jsx` | Stat card with icon, value, subtitle |
| `StatusIndicator.jsx` | Colored dot + label for bus status |
| `EmptyState.jsx` | Empty list placeholder |
| `LoadingSkeleton.jsx` | Loading placeholder skeleton |
| `CircularAction.jsx` | Circular icon button with label (used in student dashboard quick actions) |

### Domain Components

| Component | Purpose |
|-----------|---------|
| `FleetMap.jsx` | Leaflet map with live bus markers, GPS staleness display, Google Maps fallback (519 lines) |
| `PassCard.jsx` | Student bus pass card display (TOTP QR rendering) |
| `StudentCsvImportModal.jsx` | Full CSV import wizard: upload → preview → validate → import |
| `StudentSchemaEditor.jsx` | Visual field editor for the student import schema |
| `TransitTimelineCard.jsx` | Journey timeline from pickup stop to campus with ETA |
| `ValidateBusPassScanner.jsx` | Embedded QR scanner sub-component |
| `VehicleCard.jsx` | Bus info card |
| `NotificationItem.jsx` | Single notification list item |

