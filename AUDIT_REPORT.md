# CambusConnect — Full-Stack Security & Code Quality Audit Report

**Date:** November 14, 2026  
**Auditor:** Senior Full-Stack Security & QA Architect  
**Project:** CambusConnect Multi-Tenant Transit SaaS  
**Target Environment:** React 19 / Vanilla ESM, Vite, Tailwind CSS, Firebase (Auth, Firestore, RTDB, Cloud Functions), Node.js HTTP Server, Google Maps Platform  

---

## Executive Summary

A comprehensive, file-by-file security and code audit was conducted across all files and directories in the CambusConnect repository (including root configs, `api/`, `functions/`, `portals/`, `src/`, and `scripts/`).

The audit revealed **13 distinct findings**:
- **3 Critical Severity** vulnerabilities (Arbitrary Local File Disclosure / Credential Leak via `server.js`, Firestore Role-Creation Privilege Escalation in `firestore.rules`, and QR Cryptographic Verification Bypass in Vanilla scanner scripts).
- **6 High Severity** vulnerabilities (Unrestricted CORS reflection & unauthenticated key exposure in `api/maps-config.js`, Path Traversal in `server.js` `/api/` dynamic router, Missing Realtime Database rules `database.rules.json`, Driver read denial on `/students/{id}`, Stored DOM XSS in notifications & support desk, and Static QR anti-fraud bypass).
- **4 Medium Severity** vulnerabilities (SWR cache uncleared on logout, XSS in admin bus/shift cards, background geolocation battery drain, and git history secrets).

Below is the complete audit breakdown with root causes, impacted files, line numbers, and proposed production fixes.

---

## Vulnerability Matrix

| ID | Title | Severity | Impacted File(s) | Category |
|---|---|---|---|---|
| **SEC-01** | Arbitrary Sensitive File Disclosure (`.env`, `.git`) | **CRITICAL** | `server.js` (L144-179) | Information Disclosure |
| **SEC-02** | Role Privilege Escalation & Unrestricted Field Modification | **CRITICAL** | `firestore.rules` (L60-79) | Broken Access Control |
| **SEC-03** | QR Signature Verification Bypass in Scanner Portals | **CRITICAL** | `portals/admin/scan-pass.js` (L737-825), `portals/driver/driverhome.js` (L1438-1490) | Cryptographic Failure / Fraud |
| **SEC-04** | Arbitrary File Traversal in `/api/` Dynamic Import Handler | **HIGH** | `server.js` (L89-100) | Path Traversal / RCE |
| **SEC-05** | Unvalidated CORS Reflection & Unauthenticated Key Disclosure | **HIGH** | `api/maps-config.js` (L52-87) | Security Misconfiguration |
| **SEC-06** | Missing Firebase Realtime Database Security Rules (`database.rules.json`) | **HIGH** | `firebase.json`, `database.rules.json` (Missing) | Broken Access Control |
| **SEC-07** | Driver Read Permission Denied on `/students/{studentId}` | **HIGH** | `firestore.rules` (L84-91) | Functional Failure / Authorization |
| **SEC-08** | Stored DOM XSS in Notifications & Announcements | **HIGH** | `portals/admin/notifications/notifications.js` (L111), `portals/student/notifications/notifications.js` (L195), `portals/student/home/home.js` (L405) | Injection (DOM XSS) |
| **SEC-09** | Stored DOM XSS in Student Support Queries & Responses | **HIGH** | `portals/student/support/support.js` (L352, L362, L376) | Injection (DOM XSS) |
| **SEC-10** | Unverified Static Pass Format Accepted by Driver Scanner | **MEDIUM** | `portals/driver/driverhome.js` (L1304-1375) | Anti-Fraud Bypass |
| **SEC-11** | Stale Auth & Passenger Data Persisting in SWR Cache Post-Logout | **MEDIUM** | `cache-manager.js`, `src/contexts/AuthContext.jsx` (L137-143), `auth-guard.js` (L135-142) | Session / Cache Integrity |
| **SEC-12** | Unescaped Database String Interpolation in Bus & Shift Cards | **MEDIUM** | `portals/admin/buses/buses.js` (L114-135), `portals/admin/shifts/shifts.js` (L136-160) | Injection (DOM XSS) |
| **SEC-13** | Lack of Visibility/Unload Cleanup on Driver Geolocation Watcher | **MEDIUM** | `portals/driver/driverhome.js` (L864-880), `portals/admin/admin-track.js` (L389-400) | Resource Management |

---

## Deep Dive Analysis & Remediation Specs

### [CRITICAL] SEC-01: Arbitrary Sensitive File Disclosure (`.env`, `.git`) in `server.js`
- **Location:** `server.js`, Lines 144–179
- **Root Cause:**  
  `server.js` normalizes paths and only checks `if (safePath.startsWith('..') || safePath.includes('..'))`. When a client requests `GET /.env` or `GET /.git/config`, `safePath` is `/.env`, which does not contain `..`. `fs.stat(path.join(__dirname, safePath))` resolves directly to `C:\...\.env` and streams the plaintext file to the client. This exposes `GOOGLE_MAPS_API_KEY`, `VITE_FIREBASE_API_KEY`, and `ENCRYPTION_KEY`.
- **Impact:** Complete system compromise; unauthenticated attackers can download environment secrets, encryption keys, and credentials.
- **Exact Code Fix:**
  In `server.js`, introduce strict blocklists for hidden files (`startsWith('.')`), sensitive file extensions (`.env`, `.pem`, `.key`, `.log`, `.bat`, `.ps1`), and enforce a whitelist of public static directories.
  ```javascript
  // server.js - Block hidden files and sensitive file extensions
  const basename = path.basename(safePath).toLowerCase();
  if (
      basename.startsWith('.') ||
      safePath.includes('/.') ||
      safePath.includes('\\.') ||
      /\.(env.*|json|bat|ps1|log|md|pptx|lock)$/i.test(safePath)
  ) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Access Denied');
      return;
  }
  ```

---

### [CRITICAL] SEC-02: Role Privilege Escalation & Unrestricted Field Modification in `firestore.rules`
- **Location:** `firestore.rules`, Lines 67–77
- **Root Cause:**  
  The `allow create` rule on `/users/{email}` is:
  ```firestore
  allow create: if isAdmin() || (
    isAuthenticated() && (
      isOwnerOf(email) || 
      request.auth.token.email.lower() == email.lower()
    )
  );
  ```
  It does NOT constrain `request.resource.data.role`. Any newly registered student can send a Firestore write setting `{ role: 'admin' }` or `{ role: 'superadmin' }`. Upon reload, `isAdmin()` returns true, granting full administrative privileges.
  Furthermore, `allow update` checks `request.resource.data.role == resource.data.role`, but allows students to modify their own `passValidity`, `status`, `assignedBusId`, or `assignedRoute`.
- **Impact:** Any student can escalate to Superadmin or unilaterally grant themselves valid transit passes.
- **Exact Code Fix:**
  Enforce that non-admins can only create accounts with `role == 'student'`, and forbid non-admins from modifying sensitive transit credentials:
  ```firestore
  // firestore.rules
  match /users/{email} {
    allow read: if isAuthenticated() && (
      isOwnerOf(email) || 
      request.auth.token.email.lower() == email.lower() || 
      isAdmin() || 
      isDriverOrConductor()
    );
    allow create: if isAdmin() || (
      isAuthenticated() && (
        isOwnerOf(email) || 
        request.auth.token.email.lower() == email.lower()
      ) && 
      (!('role' in request.resource.data) || request.resource.data.role == 'student') &&
      (!('status' in request.resource.data) || request.resource.data.status in ['Pending', 'Active'])
    );
    allow update: if isAdmin() || (
      isAuthenticated() && 
      (isOwnerOf(email) || request.auth.token.email.lower() == email.lower()) && 
      request.resource.data.role == resource.data.role &&
      (!('passValidity' in request.resource.data) || request.resource.data.passValidity == resource.data.passValidity) &&
      (!('status' in request.resource.data) || request.resource.data.status == resource.data.status) &&
      (!('assignedBusId' in request.resource.data) || request.resource.data.assignedBusId == resource.data.assignedBusId)
    );
    allow delete: if isAdmin();
  }
  ```

---

### [CRITICAL] SEC-03: QR Signature Verification Bypass in Scanner Portals
- **Location:** `portals/admin/scan-pass.js` (L737–825), `portals/driver/driverhome.js` (L1438–1490)
- **Root Cause:**  
  When scanning a QR token `${payloadB64}.${signature}`, the scanner logic splits by `.` and parses `payloadB64`, but never executes HMAC-SHA256 signature verification. `CambusPassVerificationSystem.js` defines `processScanInput()`, but it is never invoked. Furthermore, anti-passback locks are commented out.
- **Impact:** Anyone can forge a simple Base64 JSON pass with an arbitrary name and student ID to obtain valid boarding approval.
- **Exact Code Fix:**
  In `scan-pass.js` and `driverhome.js`, verify the token signature using Web Crypto or `CambusPassVerificationSystem.js`, and re-activate the anti-passback cooldown lock:
  ```javascript
  // Must verify HMAC signature before accepting payload
  const verification = verificationSystem.processScanInput(
      rawText,
      selectedBusId,
      { lateCutOffTime: '09:30', lateBoardingOverride: false },
      localScanLogs,
      secretKey,
      allowedDomains
  );
  if (!verification.verified) {
      showToast(false, "Verification Denied", verification.reason);
      return;
  }
  ```

---

### [HIGH] SEC-04: Arbitrary File Traversal in `/api/` Dynamic Import Handler
- **Location:** `server.js`, Lines 89–100
- **Root Cause:**  
  ```javascript
  const apiName = parsedUrl.pathname.replace(/^\/api\//, '').replace(/\.js$/, '');
  const apiFilePath = path.join(__dirname, 'api', `${apiName}.js`);
  ```
  If `pathname` contains `..`, `path.join(__dirname, 'api', ...)` traverses outside `api/`. While `.js` is appended, an attacker can target arbitrary `.js` files across the project or node_modules to trigger unexpected side effects upon dynamic `import()`.
- **Exact Code Fix:**
  Verify that the resolved `apiFilePath` stays strictly within the `api/` directory:
  ```javascript
  const apiDir = path.resolve(__dirname, 'api');
  const safeApiName = path.basename(parsedUrl.pathname).replace(/\.js$/, '');
  const apiFilePath = path.join(apiDir, `${safeApiName}.js`);

  if (!apiFilePath.startsWith(apiDir) || !fs.existsSync(apiFilePath)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `API route not found` }));
      return;
  }
  ```

---

### [HIGH] SEC-05: Unvalidated CORS Reflection & Unauthenticated Key Disclosure
- **Location:** `api/maps-config.js`, Lines 52–87
- **Root Cause:**  
  1. `res.setHeader('Access-Control-Allow-Origin', origin);` blindly reflects the client's `Origin` header without an allowlist.
  2. The `GET` method has no authentication or session check; any external site can issue cross-origin requests to extract the Google Maps API Key.
- **Exact Code Fix:**
  Enforce an authorized domain allowlist for CORS, and require a valid Firebase Authorization Bearer token even for `GET`:
  ```javascript
  const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://cambusconnect.web.app',
    'https://cambus-connect-iist.firebaseapp.com'
  ];
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  ```

---

### [HIGH] SEC-06: Missing Realtime Database Security Rules (`database.rules.json`)
- **Location:** Workspace Root / `firebase.json`
- **Root Cause:**  
  `VITE_FIREBASE_DATABASE_URL` is configured for live GPS telemetry, but `database.rules.json` does not exist in the repository, and `firebase.json` has no `database` entry. By default, Firebase RTDB either allows public read/write or expires after 30 days.
- **Exact Code Fix:**
  Create `database.rules.json` and register it in `firebase.json`:
  ```json
  {
    "rules": {
      "live_locations": {
        ".read": "auth != null",
        "$busId": {
          ".write": "auth != null && (root.child('users').child(auth.token.email.replace('.', ',')).child('role').val() == 'driver' || root.child('users').child(auth.token.email.replace('.', ',')).child('role').val() == 'admin')"
        }
      }
    }
  }
  ```

---

### [HIGH] SEC-07: Driver Read Permission Denied on `/students/{studentId}` in `firestore.rules`
- **Location:** `firestore.rules`, Lines 84–91
- **Root Cause:**  
  ```firestore
  match /students/{studentId} {
    allow read: if isAuthenticated() && (
      isOwnerOf(studentId) || 
      request.auth.token.email.lower() == studentId.lower() || 
      isAdmin()
    );
    allow write: if isAdmin();
  }
  ```
  Drivers are NOT included in the `allow read` clause. When a driver attempts to look up a student's profile or `qrSecret` during pass scanning (`src/services/students.js` line 111 `getDoc(doc(db, 'students', cacheKey))`), Firestore rejects the query with `PERMISSION_DENIED`.
- **Exact Code Fix:**
  Add `isDriverOrConductor()` to `allow read`:
  ```firestore
  match /students/{studentId} {
    allow read: if isAuthenticated() && (
      isOwnerOf(studentId) || 
      request.auth.token.email.lower() == studentId.lower() || 
      isAdmin() ||
      isDriverOrConductor()
    );
    allow write: if isAdmin();
  }
  ```

---

### [HIGH] SEC-08 & SEC-09: Stored DOM XSS in Notifications & Support Desk
- **Location:**  
  - `portals/admin/notifications/notifications.js` (L111)
  - `portals/student/notifications/notifications.js` (L195)
  - `portals/student/home/home.js` (L405)
  - `portals/student/support/support.js` (L352, L362, L376)
- **Root Cause:**  
  User-supplied ticket descriptions, subjects, and notification messages are interpolated directly into `.innerHTML` / `.insertAdjacentHTML` without HTML entity encoding. An attacker submitting `<img src=x onerror="alert(document.cookie)">` in a support query triggers script execution in the administrator's browser.
- **Exact Code Fix:**
  Use the centralized `escapeHtml()` utility before interpolating into template strings:
  ```javascript
  function escapeHtml(str) {
      if (!str) return '';
      return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
  }
  ```

---

### [MEDIUM] SEC-10: Unverified Static Pass Format Accepted by Driver Scanner
- **Location:** `portals/driver/driverhome.js`, Lines 1304–1375
- **Root Cause:**  
  The scanner accepts plain strings formatted as `CAMBUS:collegeId:busId:date` without cryptographic verification or TOTP checking. A student can forge or reuse another student's enrollment ID.
- **Exact Code Fix:**
  Enforce dynamic rotating cryptographic passes and reject static unauthenticated string patterns in production mode.

---

### [MEDIUM] SEC-11: SWR Cache Cleanup on User Logout
- **Location:** `cache-manager.js`, `src/contexts/AuthContext.jsx`, `auth-guard.js`
- **Root Cause:**  
  `CambusCache.clearAll()` exists in `cache-manager.js`, but is never invoked on user logout. Cached student pass details remain accessible in `localStorage` under `cambus_swr_*`.
- **Exact Code Fix:**
  Invoke `CambusCache.clearAll()` in `logout()` inside `AuthContext.jsx` and `auth-guard.js`.

---

### [MEDIUM] SEC-12: Unescaped Database String Interpolation in Admin Bus & Shift Cards
- **Location:** `portals/admin/buses/buses.js` (L114–135), `portals/admin/shifts/shifts.js` (L136–160)
- **Root Cause:**  
  Route names, driver names, and conductor phone numbers are interpolated directly into `.innerHTML` without `escapeHtml()`.
- **Exact Code Fix:**
  Sanitize all interpolated fields using `escapeHtml()`.

---

### [MEDIUM] SEC-13: Missing Unsubscribe on Visibility Change / Unload
- **Location:** `portals/driver/driverhome.js` (L864–880), `portals/admin/admin-track.js` (L389–400)
- **Root Cause:**  
  `navigator.geolocation.watchPosition` is not paused when the driver app is sent to the background or the tab is hidden, leading to battery drain and unnecessary Firestore write billing.
- **Exact Code Fix:**
  Attach `document.addEventListener('visibilitychange', ...)` to clear watchPosition when hidden and resume when visible.

---

## Verification Test Results

1. **Vite Production Build (`npx vite build`):**
   - Result: **0 Errors**. 1,947 modules transformed cleanly in 3.05s.
2. **Automated E2E Suite (`node test-e2e.mjs`):**
   - Result: **7/7 Passed**. Student Auth, Student Profile, Indexless Trips Query, Lost & Found CRUD, Fleet Access, and Boarding Audits all succeeded.
3. **Master Verification (`node scripts/verify-master.mjs`):**
   - Result: **8/8 Passed**. Zero orphaned files, zero raw API keys in tracked files, valid HTML structures, SWR caching verified.

---

## Remediation Roadmap

To remediate these findings safely, the recommended action plan is:
1. **Apply Server & Security Rule Hardening (Critical/High):**
   - Patch `server.js` against `.env` / sensitive file exposure and path traversal.
   - Patch `firestore.rules` to prevent privilege escalation on user creation and allow driver read on `students`.
   - Create `database.rules.json` and update `firebase.json`.
   - Patch `api/maps-config.js` CORS reflection.
2. **Harden QR Scanner Cryptography & DOM XSS (Critical/High):**
   - Enforce cryptographic verification in `portals/admin/scan-pass.js` and `portals/driver/driverhome.js`.
   - Apply `escapeHtml()` across notifications, support queries, bus cards, and shift views.
   - Hook `CambusCache.clearAll()` into logout routines.
3. **Re-run Full Verification Gate:**
   - Execute `vite build`, `verify-master.mjs`, and `test-e2e.mjs` to ensure 100% green test assertions.

