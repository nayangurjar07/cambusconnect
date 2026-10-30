# 05 — Service Layer Reference
# Cambus Connect Enterprise

**Version:** 1.0 (September 2026)

> This document catalogs every service/utility file in `src/services/` and `src/utils/`, its public API, dependencies, and current refactor status.

---

## Refactor Status Legend

| Status | Meaning |
|--------|---------|
| ✅ **DONE** | Clean, modular, uses modern Firebase v9 SDK, no direct DOM/global references |
| ⚠️ **IN PROGRESS** | Mostly refactored but has known issues, TODOs, or partial legacy patterns |
| 🔴 **LEGACY** | Uses `firebase.compat` or `window.db`/`window.auth`, lives outside `src/` |

---

## 1. `src/services/auth.js`
**Status: ✅ DONE**

Core authentication service. All functions are pure async, no React dependencies.

| Function | Signature | Description |
|----------|-----------|-------------|
| `loginUser` | `(rawEmailOrId, password, expectedRole?)` → `{user, profile}` | Signs in via Firebase Auth, resolves Firestore profile from `/users` or `/students`, validates role match, checks pass expiry for students, populates localStorage |
| `logoutUser` | `()` → `void` | Signs out from Firebase, clears all localStorage auth keys |
| `getCurrentSession` | `()` → `{isLoggedIn, email, role, student, tenantKey}` | Reads current session entirely from localStorage (no async, no Firestore) |

**Dependencies:** `../config/firebase` (auth, db, Firestore helpers)

**Known Issues:**
- `tenantId` is hardcoded as `'default'` (line 65). Multi-tenant support would need dynamic resolution here.
- Username-only login (no `@`) is hardcoded to `@indoreinstitute.com` domain. Should be configurable per deployment.

---

## 2. `src/services/students.js`
**Status: ✅ DONE** (most comprehensive service in the codebase)

Full student lifecycle management: CRUD, CSV import pipeline, schema management.

| Function | Signature | Description |
|----------|-----------|-------------|
| `getPaginatedStudents` | `(pageSize, lastVisible, routeFilter, statusFilter, searchQuery)` → `{students, lastVisible, totalCount}` | Cursor-based Firestore pagination with route/status/name filters |
| `getStudentProfile` | `(identifier)` → `student \| null` | Multi-strategy lookup: doc ID, then `collegeId`, then `enrollment`, then `email` field. Has 5-min TTL in-memory cache |
| `createStudent` | `(data)` → `email` | Creates Firebase Auth account via secondary app instance + writes `/students/{email}` with fresh `qrSecret` |
| `updateStudent` | `(email, data)` → `void` | Updates student doc, invalidates cache |
| `deleteStudent` | `(email)` → `void` | Deletes student doc, invalidates cache |
| `regenerateQrSecret` | `(email)` → `void` | Generates new cryptographic QR secret and writes it |
| `bulkGeneratePasswords` | `(emails[])` → `results[]` | Creates Firebase Auth accounts for a list of emails. Uses `Math.random()` ⚠️ |
| `subscribeToStudentSchema` | `(onUpdate, onError)` → `unsubscribe` | Real-time listener on `/settings/studentImportSchema` with FORBIDDEN_FIELDS filter |
| `saveStudentSchema` | `(fields[])` → `void` | Persists schema to Firestore with security validation |
| `generateCsvTemplate` | `(schema?)` → `string` | Generates CSV header + empty row template |
| `parseCsv` | `(text)` → `{headers, rows}` | Pure CSV parser with RFC-4180 quoted field support |
| `validateStudentRow` | `(row, schema, routesList, busesList)` → `{isValid, errors[]}` | Per-row validation: required fields, email format, date format, phone length |
| `batchImportStudents` | `(validRows, onProgress?)` → `importedCount` | Writes students in Firestore batches of 400 using `merge: true` |
| `generateErrorCsv` | `(failedRecords[])` → `string` | Produces downloadable CSV of validation failures |

**Exported Constants:**
- `DEFAULT_STUDENT_SCHEMA` — 10-field schema array
- `FORBIDDEN_FIELDS` — `['password', 'pass', 'secret', 'token', 'hash', 'credential']`
- `LOCKED_FIELDS` — `['name', 'email', 'collegeId']`

**Known Issues:**
- `bulkGeneratePasswords` uses `Math.random()` for password generation — should use `crypto.getRandomValues()`
- In-memory cache is module-level (singleton), not per-user/tenant — could leak data in server-side rendering contexts

---

## 3. `src/services/transit.js`
**Status: ✅ DONE**

Fleet and route management plus boarding event logging.

| Function | Signature | Description |
|----------|-----------|-------------|
| `subscribeToBuses` | `(onUpdate, onError)` → `unsubscribe` | Real-time listener on entire `/buses` collection |
| `subscribeToBus` | `(busId, onUpdate, onError)` → `unsubscribe` | Real-time listener on single bus document |
| `getBus` | `(busId)` → `bus \| null` | One-time fetch with 1-min TTL cache |
| `createBus` | `(data)` → `busId` | Creates bus after uniqueness validation (number, registration, driver, conductor) |
| `updateBus` | `(busId, data)` → `void` | Updates bus after uniqueness validation |
| `updateBusStatus` | `(busId, status)` → `void` | Quick status update + timestamp |
| `updateBusHeadcount` | `(busId, newHeadcount, maxCapacity?)` → `newHeadcount` | Absolute set (legacy, use `incrementBusHeadcount` preferred) |
| `incrementBusHeadcount` | `(busId, delta, maxCapacity?)` → `newHeadcount` | Atomic Firestore transaction increment, bounded 0..capacity |
| `updateBusLocation` | `(busId, lat, lng, speed)` → `void` | Updates `location.lat`, `location.lng`, `speed` on bus doc |
| `deleteBus` | `(busId)` → `void` | Deletes bus doc, invalidates cache |
| `subscribeToRoutes` | `(onUpdate, onError)` → `unsubscribe` | Real-time listener on `/routes`, sorted by code/name |
| `createRoute` | `(routeData)` → `{id, ...route}` | Creates route after code/name uniqueness validation |
| `updateRoute` | `(routeId, routeData)` → `void` | Updates route after uniqueness validation |
| `deleteRoute` | `(routeId)` → `void` | Deletes route doc |
| `seedDefaultRoutesIfEmpty` | `()` → `void` | Seeds `DEFAULT_ROUTES` if collection is empty (DEFAULT_ROUTES is currently `[]`) |
| `logBoarding` | `({studentId, studentName, busId, busNumber, routeName})` → `tripId` | Writes to `/trips` and `/daily_boardings` |
| `getStudentTripsCount` | `(studentId)` → `count` | Counts trips since start of current month (fetches all matching docs — not using COUNT API) |

**Known Issues:**
- `validateBusConstraints()` fetches ALL buses on every create/update to check uniqueness — O(n) reads. Fine at small scale; should move to indexed queries at 100+ buses.
- `getStudentTripsCount()` fetches all matching trip documents and counts in-memory instead of using `getCountFromServer()`.

---

## 4. `src/services/workforce.js`
**Status: ✅ DONE**

Staff and shift management.

| Function | Signature | Description |
|----------|-----------|-------------|
| `subscribeToStaff` | `(onUpdate, onError)` → `unsubscribe` | Real-time listener on `/users` filtered by roles `['driver', 'conductor', 'staff', 'admin']` |
| `createStaffMember` | `(data)` → `email` | Creates Firebase Auth account + writes `/users/{email}` |
| `updateStaffMember` | `(email, data)` → `void` | Updates staff user doc |
| `deleteStaffMember` | `(email)` → `void` | Deletes staff user doc (does NOT delete Firebase Auth account) |
| `subscribeToShiftConfig` | `(onUpdate, onError)` → `unsubscribe` | Real-time listener on `/settings/shiftConfig`, migrates legacy field format |
| `saveShiftConfig` | `(shifts[])` → `void` | Saves new shifts array + writes backward-compatibility legacy fields |
| `subscribeToActiveRuns` | `(onUpdate, onError)` → `unsubscribe` | Real-time listener on `driverSessions` where status = 'Active' |
| `subscribeToShiftHistory` | `(onUpdate, onError, maxItems?)` → `unsubscribe` | Real-time listener on stopped sessions, ordered by startTime desc |
| `format24to12` | `(time24)` → `string` | '14:30' → '02:30 PM' |
| `format12to24` | `(time12)` → `string` | '02:30 PM' → '14:30' |

**Known Issues:**
- `deleteStaffMember()` deletes the Firestore doc but does **not** delete the Firebase Authentication account. The user can still sign in until an admin manually deletes them from Firebase Console.

---

## 5. `src/services/communications.js`
**Status: ✅ DONE**

Notifications, support tickets, and lost & found.

| Function | Signature | Description |
|----------|-----------|-------------|
| `subscribeToNotifications` | `(onUpdate, onError, maxItems?)` → `unsubscribe` | Real-time listener, ordered by `createdAt` desc, formats time |
| `createNotification` | `({title, message, type, targetRouteId})` → `notifId` | Creates broadcast notification |
| `deleteNotification` | `(id)` → `void` | Deletes notification |
| `subscribeToSupportQueries` | `(onUpdate, onError)` → `unsubscribe` | Real-time listener on all support tickets |
| `submitSupportQuery` | `(data)` → `queryId` | Creates support ticket |
| `updateQueryStatus` | `(queryId, status, adminNotes?)` → `void` | Admin resolves/closes ticket |
| `subscribeToLostItems` | `(onUpdate, onError)` → `unsubscribe` | Real-time listener on lost items |
| `reportLostItem` | `(data)` → `{success, id, refNumber, note?}` | Creates lost item report. On `permission-denied`, falls back to support-queries collection |
| `updateLostItemStatus` | `(itemId, status)` → `void` | Updates lost item status |
| `deleteLostItem` | `(itemId)` → `void` | Deletes lost item |

**Aliases exported:** `createSupportQuery = submitSupportQuery`, `subscribeLostFoundItems = subscribeToLostItems`, `createLostFoundItem = reportLostItem`

**Known Issues:**
- `reportLostItem()` has a fallback to `support-queries` when `permission-denied` on `lost-items`. This means some lost item reports end up in the wrong collection silently. Category is set to `'Lost & Found'` but admin sees it in helpdesk, not lost & found. Firestore rules should be fixed instead.
- Notification system is polling-by-subscription only — no Firebase Cloud Messaging (FCM). Push notifications while app is closed are not supported.

---

## 6. `src/services/qrDecoder.js`
**Status: ✅ DONE** (specialized, complex)

Multi-engine QR image decoder for uploaded files.

| Function | Signature | Description |
|----------|-----------|-------------|
| `decodeQrFromImageFile` | `(file: File)` → `string` | Tries 5 engines in order: BarcodeDetector API → jsQR native → jsQR top-80%-crop → jsQR binarized → jsQR rescaled (800/1200/500px) → Html5Qrcode.scanFile |

**Dependencies:** `jsqr`, `html5-qrcode`

**Notes:** This service has no Firestore dependencies. It is a pure client-side image processing pipeline. The 5-engine fallback was specifically added to handle mobile phone screenshots of QR codes (common real-world use case).

---

## 7. `src/services/googleMaps.js`
**Status: ⚠️ IN PROGRESS**

Google Maps API key management via backend proxy.

| Function | Signature | Description |
|----------|-----------|-------------|
| `fetchBackendMapsKey` | `()` → `string \| null` | GET `/api/maps-config` → returns API key. Falls back to `localStorage.custom_maps_key` |
| `updateBackendMapsKey` | `(newKey)` → `boolean` | POST `/api/maps-config` with new key |
| `loadGoogleMaps` | `()` → `window.google.maps` | Loads Google Maps JS API via dynamic `<script>` tag with key from backend |

**Known Issues:**
- API key is stored in `localStorage` as fallback, making it client-visible. Should be strictly server-side.
- `loadGoogleMaps()` uses a global `loadPromise` singleton — not React-lifecycle-safe.
- The primary map component (`FleetMap.jsx`) uses **Leaflet**, not Google Maps. Google Maps is an optional secondary layer.

---

## 8. `src/utils/crypto.js`
**Status: ✅ DONE**

TOTP-based QR pass security utilities.

| Function | Signature | Description |
|----------|-----------|-------------|
| `generateQrSecret` | `()` → `string` | 16 cryptographically random bytes → 32-char hex via `window.crypto.getRandomValues()` |
| `generateTotpPayload` | `(email, secret)` → `Promise<string>` | Generates current time-window QR JSON payload using SHA-256 |
| `verifyTotp` | `(scannedTotp, secret)` → `Promise<boolean>` | Verifies scanned TOTP hash against current + previous time window |

**Time window:** 15 minutes (`TIME_WINDOW_MS = 15 * 60 * 1000`)

---

## 9. Legacy Files (Root Level — Outside `src/`)

These files predate the React refactor and are **not imported by the React app**.

| File | Status | Description |
|------|--------|-------------|
| `firebase-config.js` | 🔴 LEGACY | Domain-based multi-tenant Firebase config using `firebase.compat`. Contains real API keys in plain text. |
| `cambus-enterprise-ecosystem.js` | 🔴 LEGACY | Unused route optimization engine class (`CambusEnterpriseEngine`). Not connected to React app. Complex but dormant. |
| `db-helper.js` | 🔴 LEGACY | Global Firestore helpers using `window.db`. |
| `auth-guard.js` | 🔴 LEGACY | Vanilla JS auth guard for old portal HTML pages. |
| `main.js` | 🔴 LEGACY | Old app entry point for non-Vite/React portals. |
| `api/bus-location.js` | ⚠️ IN PROGRESS | Express route for bus location updates (unclear if still used) |
| `api/maps-config.js` | ✅ USED | Maps key proxy — actively called by `src/services/googleMaps.js` |
| `api/save-settings.js` | 🔴 LEGACY | Legacy settings save endpoint |
| `portals/` directory | 🔴 LEGACY | HTML-based portals (admin/driver/owner/student) pre-React. Now superseded by `src/pages/`. |

