# 07 — Refactor Implementation Plan & Flutter MVP Migration
# Cambus Connect Enterprise

**Version:** 1.0 (September 2026)

---

## 1. Refactor Status Summary

### What's Done ✅

| Component | Status | Notes |
|-----------|--------|-------|
| `src/config/firebase.js` | ✅ Complete | Modular v9 SDK, secondary app pattern, persistence |
| `src/services/auth.js` | ✅ Complete | Clean, no legacy deps |
| `src/services/students.js` | ✅ Complete | CRUD, CSV pipeline, TOTP, schema, caching |
| `src/services/transit.js` | ✅ Complete | Bus/route CRUD, real-time subs, boarding logs |
| `src/services/workforce.js` | ✅ Complete | Staff CRUD, shift config, session tracking |
| `src/services/communications.js` | ✅ Complete | Notifications, support, lost & found |
| `src/services/qrDecoder.js` | ✅ Complete | 5-engine QR decode pipeline |
| `src/utils/crypto.js` | ✅ Complete | TOTP with Web Crypto API |
| `src/contexts/AuthContext.jsx` | ✅ Complete | Firebase auth state + profile resolution |
| `src/contexts/TenantContext.jsx` | ✅ Scaffolded | Branding works; tenant switching is stub |
| `src/components/layout/*` | ✅ Complete | AppShell, Sidebar, Topbar, MobileNav |
| `src/components/ui/*` | ✅ Complete | 13 primitive components |
| `src/components/domain/*` | ✅ Complete | 8 domain components |
| Admin Portal (all 11 pages) | ✅ Complete | Full feature set implemented |
| Driver Portal Dashboard | ✅ Complete | GPS tracking, headcount, alerts |
| Driver Scan Pass | ✅ Complete | QR scan + TOTP verification |
| Student Dashboard | ✅ Complete | Full UI, live data |
| Student Lost Found | ✅ Complete | Full CRUD with fallback |
| Student Support | ✅ Complete | Ticket submission |
| Student Notifications | ✅ Complete | |
| Student Profile | ✅ Complete | Read-only profile view |
| Student Search | ✅ Complete | Route/stop search |
| `firestore.rules` | ✅ Complete | Comprehensive role-based rules |
| `firestore.indexes.json` | ✅ Complete | 12 composite indexes defined |

---

### What's Incomplete / Legacy ⚠️🔴

| Item | Status | Priority |
|------|--------|----------|
| `BusPass.jsx` — Student bus pass screen | ⚠️ STUB (537 bytes) | 🔴 HIGH — core feature |
| `student/Track.jsx` — Bus tracker screen | ⚠️ Small file, needs validation | 🟡 MEDIUM |
| Owner tenant registration (persistence) | ⚠️ UI only, no backend save | 🟡 MEDIUM |
| Multi-tenant Firebase switching | 🔴 Disabled/stub | 🟡 MEDIUM (future) |
| Driver portal `alerts` + `schedule` routes | 🔴 No dedicated pages | 🟡 MEDIUM |
| Legacy `portals/` HTML pages | 🔴 LEGACY — superseded | 🟢 LOW (cleanup) |
| `firebase-config.js` root file | 🔴 LEGACY — hardcoded keys | 🟡 MEDIUM (delete) |
| `cambus-enterprise-ecosystem.js` | 🔴 LEGACY — unused | 🟢 LOW (cleanup) |
| `main.js`, `db-helper.js`, `auth-guard.js` | 🔴 LEGACY | 🟢 LOW (cleanup) |
| `api/bus-location.js` | ⚠️ Unclear if used | 🟢 LOW (audit) |
| `api/save-settings.js` | 🔴 LEGACY | 🟢 LOW (cleanup) |
| `bulkGeneratePasswords` — crypto security | ⚠️ Uses `Math.random()` | 🟡 MEDIUM |
| `deleteStaffMember` — Firebase Auth deletion | ⚠️ Firestore only, no Auth cleanup | 🟡 MEDIUM |
| `getStudentTripsCount` — inefficient query | ⚠️ Fetches all docs, counts in-memory | 🟢 LOW |
| Owner dashboard metrics | 🔴 Hardcoded static values | 🟡 MEDIUM |
| `activeTenantKey` not cleared on logout | ⚠️ Minor edge case | 🟢 LOW |
| `localStorage.isLoggedIn` auth bypass risk | 🔴 Security issue | 🔴 HIGH |

---

## 2. Immediate Fix Queue (Ordered by Priority)

### Phase 0: Critical Security (Do First)
1. **Fix `isAuthenticated` localStorage bypass**
   - File: `src/contexts/AuthContext.jsx` line 131
   - Change: Remove `|| localStorage.getItem('isLoggedIn') === 'true'` from `isAuthenticated` value
   - Route guards should only trust Firebase Auth state
   
2. **Fix `bulkGeneratePasswords` weak randomness**
   - File: `src/services/students.js`
   - Change: Replace `Math.random()` with `crypto.getRandomValues()` or a secure character set
   
3. **Delete `firebase-config.js`** (root level — contains hardcoded real API keys in plain text)

---

### Phase 1: Core Feature Completion

4. **Complete `BusPass.jsx`**
   - Wire `generateTotpPayload(profile.email, profile.qrSecret)` → QR component
   - Use `PassCard.jsx` domain component (already built)
   - Auto-refresh QR every 15 minutes
   - Display pass details: name, enrollment, route, validity, bus

5. **Complete `Track.jsx`** (student bus tracking)
   - Confirm it uses `FleetMap` or equivalent
   - Should show only student's assigned bus, not entire fleet

6. **Implement Owner Tenant Registration persistence**
   - Connect form data to a `createTenant()` service function
   - Write to `/tenants/{tenantId}` in Firestore
   
---

### Phase 2: Data Quality & Consistency

7. **Fix student collection split (Flutter vs Web)**
   - Flutter seeds to `/users`, web uses `/students`
   - Decision: Pick one canonical collection for students
   - Recommended: keep `/students` for pass holders, `/users` for staff only
   - Update Flutter `main.dart` seed + all queries

8. **Fix `deleteStaffMember` — delete Firebase Auth account**
   - Requires a Cloud Function (client SDK cannot delete other users)
   - Create `functions/deleteUser.js` Cloud Function triggered by admin

9. **Replace getUserData() Firestore reads in rules with Custom Claims**
   - Each role change → set custom claim via Admin SDK Cloud Function
   - Eliminates per-request `get()` calls in Firestore rules (cost + latency)

10. **Fix lost-items permission-denied fallback**
    - Root cause: Students can't write to `lost-items` in some configurations
    - Fix the Firestore rule rather than the fallback
    - Remove the fallback to `support-queries` or clearly document it

11. **Clean up `lost-items` field redundancy**
    - `title`, `itemName`, `item` → pick one
    - `userId`, `userEmail`, `userName`, `reportedBy`, `contactName` → normalize to 3 fields
    
---

### Phase 3: Architecture & Cleanup

12. **Remove all legacy files from root**
    - `portals/` directory
    - `firebase-config.js`
    - `cambus-enterprise-ecosystem.js`
    - `main.js`, `db-helper.js`, `auth-guard.js`
    - `api/save-settings.js`

13. **Implement multi-tenant Firebase switching**
    - Remove `console.warn("Tenant switching is disabled")` stubs
    - Implement `switchTenant()` to actually call `initializeApp(tenantConfig, tenantName)`
    - Test data isolation between tenants

14. **Replace Owner dashboard hardcoded metrics**
    - Fetch real aggregates: bus count, daily boarding count via `getCountFromServer()`
    - Or implement a Cloud Function that aggregates cross-tenant stats

15. **Add Driver dedicated pages**
    - `/driver/alerts` → dedicated alerts/notifications page
    - `/driver/schedule` → shift schedule view

---

## 3. Flutter MVP Implementation Plan

### Scope Decision (Inferred — please confirm)
> The Flutter MVP should cover **Student** and **Admin** roles only, running on Android (and optionally Flutter Web).

### Current Flutter State

| Feature | Status |
|---------|--------|
| Project bootstrapped | ✅ Done |
| Firebase initialized | ✅ Done |
| Riverpod state management | ✅ Set up |
| GoRouter navigation | ✅ Set up |
| Feature folder structure | ✅ Done |
| Auth login screen | ✅ Done |
| Student feature dirs (home, pass, tracking, notifications, buses, profile) | ✅ Created |
| Admin feature dir | ✅ Created |
| Driver feature dir | ✅ Created |
| Student data/UI wired | ❓ Unknown (need to audit .dart files) |
| QR pass display | ❓ `qr_flutter` installed, not confirmed wired |
| Maps | ❓ `google_maps_flutter` installed |
| Mobile QR scanning | ❓ `mobile_scanner` installed |

### Flutter Student Portal — Screen Checklist

| Screen | Web Equivalent | Flutter Priority |
|--------|---------------|-----------------|
| Login | `Login.jsx` | ✅ Must have |
| Student Dashboard | `student/Dashboard.jsx` | ✅ Must have |
| Bus Pass (QR) | `student/BusPass.jsx` | ✅ Must have |
| Live Tracking | `student/Track.jsx` | ✅ Must have |
| Notifications | `student/Notifications.jsx` | ✅ Must have |
| Support | `student/Support.jsx` | 🟡 Should have |
| Lost & Found | `student/LostFound.jsx` | 🟡 Should have |
| Profile | `student/Profile.jsx` | 🟡 Should have |
| Route Search | `student/Search.jsx` | 🟢 Nice to have |

### Flutter Admin Portal — Screen Checklist

| Screen | Web Equivalent | Flutter Priority |
|--------|---------------|-----------------|
| Admin Dashboard | `admin/Dashboard.jsx` | ✅ Must have |
| QR Scan Pass | `admin/AdminScanPass.jsx` | ✅ Must have |
| Notifications | `admin/Notifications.jsx` | 🟡 Should have |
| Student List | `admin/Students.jsx` | 🟡 Should have |
| Fleet Tracking | `admin/Tracking.jsx` | 🟡 Should have |
| Helpdesk | `admin/HelpDesk.jsx` | 🟢 Nice to have |
| Staff | `admin/Staff.jsx` | 🟢 Nice to have |
| Buses | `admin/Buses.jsx` | 🟢 Nice to have |
| Routes | `admin/Routes.jsx` | 🟢 Nice to have |
| Shifts | `admin/Shifts.jsx` | 🟢 Nice to have |
| Settings | `admin/Settings.jsx` | 🟢 Nice to have |

### Flutter Implementation Phases

**Phase F1: Foundation (2-3 weeks)**
- [ ] Fix collection mismatch: use `/students` for students in Flutter
- [ ] Implement `AuthController` (login, role resolution, session persistence)
- [ ] Wire GoRouter with role-based routes and guards
- [ ] Implement Riverpod providers for auth state, student profile
- [ ] Implement Student Dashboard screen with live Firestore data

**Phase F2: Core Student Features (3-4 weeks)**
- [ ] Bus Pass screen with TOTP QR generation (re-implement `crypto.js` logic in Dart using `crypto` package)
- [ ] Live bus tracking with `google_maps_flutter` and Firestore `onSnapshot` equivalent
- [ ] Push notifications via Firebase Cloud Messaging (FCM) — must-add for mobile
- [ ] Notifications feed
- [ ] Support ticket submission

**Phase F3: Admin Mobile Features (3-4 weeks)**
- [ ] Admin dashboard with Firestore aggregations
- [ ] QR pass scanner using `mobile_scanner`
- [ ] TOTP verification in Dart
- [ ] Boarding log and headcount update

**Phase F4: Polish & Release (2 weeks)**
- [ ] Offline support (Firestore offline persistence)
- [ ] Onboarding flow for first-time students
- [ ] App icons, splash screen, branding
- [ ] Play Store submission

---

## 4. TOTP in Flutter (Port from JS)

The web TOTP logic must be ported to Dart:

```dart
// Web (JS):
const hash = SHA256(`${secret}:${timeIndex}`).hex.substring(0, 16)
const timeIndex = Math.floor(Date.now() / 900000) // 15 minutes

// Dart equivalent:
import 'package:crypto/crypto.dart';
final timeIndex = DateTime.now().millisecondsSinceEpoch ~/ (15 * 60 * 1000);
final data = utf8.encode('$secret:$timeIndex');
final hash = sha256.convert(data).toString().substring(0, 16);
```

Verification window logic (current + previous window) must be reproduced exactly.

---

## 5. Recommended Documentation Updates

After completing Phase 1, update:
- [ ] `03-database-schema.md` — if student collection is unified
- [ ] `04-auth-role-matrix.md` — when Custom Claims are implemented
- [ ] `06-screens-ux-flows.md` — when BusPass.jsx and Track.jsx are complete
- [ ] `02-architecture.md` — when multi-tenant switching is enabled

