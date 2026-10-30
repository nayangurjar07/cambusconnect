# 10 — Product Roadmap
# Cambus Connect Enterprise

> Items marked **[PROPOSAL]** are proposed additions not currently in the codebase.

**Version:** 1.0 (September 2026)

---

## Current Status (September 2026)

- ✅ Web platform live (React/Vite, Firebase)
- ✅ Admin, Driver, Student portals feature-complete
- ✅ TOTP QR bus pass system
- ✅ Real-time fleet tracking (GPS from driver phone)
- ✅ CSV bulk student import with schema management
- ⚠️ Flutter mobile app in active development
- ⚠️ Multi-tenant switching stubbed (single tenant live)
- ⚠️ Student `BusPass.jsx` screen stub

---

## Near-Term: Finish & Ship (Q4 2026)

### Milestone 1: Web Platform Stabilization (October 2026)
- [ ] Fix `isAuthenticated` localStorage bypass security issue
- [ ] Complete `BusPass.jsx` — wire TOTP QR generation via `PassCard` component
- [ ] Fix `bulkGeneratePasswords()` — use cryptographically secure randomness
- [ ] Fix collection mismatch: Flutter `/users` vs Web `/students` for students
- [ ] Implement `deleteStaffMember` Firebase Auth cleanup via Cloud Function
- [ ] Replace Owner dashboard hardcoded metrics with live Firestore aggregations
- [ ] Delete all legacy root files (`firebase-config.js`, `portals/`, etc.)

### Milestone 2: Flutter MVP — Student Portal (November 2026)
- [ ] Auth flow (login, role routing, session persistence)
- [ ] Student Dashboard — live bus info, trip count
- [ ] Bus Pass screen — TOTP QR code display with auto-refresh
- [ ] Live tracking — Google Maps with assigned bus marker
- [ ] Notifications feed — FCM push + in-app
- [ ] Support ticket submission
- [ ] Profile screen
- [ ] Google Play Store submission (Android)

### Milestone 3: Flutter MVP — Admin Mobile (December 2026)
- [ ] Admin dashboard — fleet metrics
- [ ] QR pass scanner — `mobile_scanner` + TOTP verification in Dart
- [ ] Boarding log review
- [ ] Notification creation
- [ ] Internal beta testing at IIST

---

## Mid-Term: Growth & Second Client (Q1–Q2 2027)

### Milestone 4: Multi-Tenant Enablement [PROPOSAL]
- [ ] Enable `switchTenant()` in `TenantContext` / `firebase.js`
- [ ] Provision Medicaps University on separate Firebase project
- [ ] Deploy per-tenant Firestore rules via Firebase CLI scripts
- [ ] Owner dashboard shows live aggregates across all tenants
- [ ] Automated tenant provisioning workflow (Owner registers → Firebase project created)

### Milestone 5: FCM Push Notifications [PROPOSAL]
- [ ] Firebase Cloud Messaging integration for Flutter app
- [ ] Student receives push when bus is delayed/breakdown
- [ ] Student receives push when pass expires in 7/1 days
- [ ] Admin can send targeted route notifications from web dashboard

### Milestone 6: Analytics Module [PROPOSAL]
- [ ] Historical boarding data visualization (charts)
- [ ] Route utilization reports (daily/weekly/monthly)
- [ ] Driver session efficiency reports
- [ ] Export to PDF/Excel
- [ ] Occupancy heatmap by route

### Milestone 7: Parent Portal [PROPOSAL]
- [ ] Guardian registration linked to student account
- [ ] Guardian receives boarding confirmation (student boarded / alighted)
- [ ] Emergency contact notification on bus breakdown
- [ ] Web + Flutter

---

## Long-Term: Scale & Platform (Q3 2027+)

### Milestone 8: GPS Hardware Integration [PROPOSAL]
- [ ] REST API endpoint for external GPS trackers (not just phone GPS)
- [ ] Support common Indian GPS tracker protocols (Teltonika, Queclink)
- [ ] Admin can configure GPS source per bus (phone vs hardware tracker)
- [ ] Geofence alerts (bus enters/exits campus boundary)

### Milestone 9: AI Route Optimization [PROPOSAL]
- [ ] Activate `cambus-enterprise-ecosystem.js` logic (currently dormant)
- [ ] Student commute intention collection (day before)
- [ ] Automated route merge/split recommendations based on occupancy
- [ ] Integration with admin approval workflow

### Milestone 10: iOS App [PROPOSAL]
- [ ] Flutter iOS build
- [ ] App Store submission
- [ ] iCloud-backed session handling

### Milestone 11: SAML/SSO Integration [PROPOSAL]
- [ ] Login via institution's existing SSO (Google Workspace, Microsoft Azure AD)
- [ ] Removes need for separate Firebase Auth accounts for admin/staff
- [ ] Students still use email/password (most don't have institutional SSO)

### Milestone 12: White-Label Mobile App [PROPOSAL]
- [ ] Per-tenant branded Flutter app (custom logo, colors, app name)
- [ ] Automated build pipeline per tenant
- [ ] Play Store listing per institution

---

## Dependency Graph

```
M1 (Web Stabilization)
  ↓
M2 (Flutter Student) ─────────────── Play Store Alpha
  ↓
M3 (Flutter Admin)
  ↓
M4 (Multi-Tenant) ←──── M5 (FCM Push Notifications)
  ↓
M6 (Analytics) ←───────────────────── M7 (Parent Portal)
  ↓
M8 (GPS Hardware) ←──── M9 (AI Route Optimization)
  ↓
M10 (iOS) + M11 (SSO) + M12 (White-Label)
```

---

## Success Metrics

| Metric | M3 Target | M6 Target | M12 Target |
|--------|-----------|-----------|-----------|
| Paying institutions | 1 (IIST) | 5 | 30 |
| Active students (WAU) | 200 | 5,000 | 50,000 |
| Daily QR scans | 200 | 3,000 | 30,000 |
| Monthly Recurring Revenue | ₹3,000 | ₹30,000 | ₹3,00,000 |
| Flutter app installs | 200 | 5,000 | 50,000 |

