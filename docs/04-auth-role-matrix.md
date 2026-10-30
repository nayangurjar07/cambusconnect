# 04 — Auth Flow & Role Permission Matrix
# Cambus Connect Enterprise

**Version:** 1.0 (September 2026)

---

## 1. Authentication System Overview

**Provider:** Firebase Authentication (Email/Password)  
**Session persistence:** Browser `localStorage` (primary) + Firebase Auth state  
**Profile storage:** Firestore `/users/{email}` or `/students/{email}`  

---

## 2. Auth Flow — Step by Step

```
┌──────────────────────────────────────────────────────────────┐
│                     LOGIN PAGE                               │
│  1. User selects portal tab (Student/Driver/Admin/Owner)     │
│  2. Enters email or username (e.g. "john" auto-appended      │
│     to "@indoreinstitute.com" if no @ present)               │
│  3. Clicks Sign In → loginUser(email, password, role)        │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                    auth.js loginUser()                       │
│  1. signInWithEmailAndPassword(auth, email, password)        │
│  2. getDoc(db, 'users', email) — check admin/driver/owner    │
│  3. If not found → getDoc(db, 'students', email)             │
│  4. If expectedRole mismatches userData.role → throw error   │
│  5. If student & passValidity expired → throw error          │
│  6. tenantId = 'default' (hardcoded)                         │
│  7. Store in localStorage: isLoggedIn, userEmail, userRole,  │
│     userTenantId, activeTenantKey, role-specific data        │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                 AuthContext onAuthStateChanged                │
│  (runs once on app load, syncs Firebase state to React)      │
│  1. Gets user from Firebase Auth                             │
│  2. getDoc(db, 'users', email) → or /students/{email}        │
│  3. Resolves canonical role from Firestore data or           │
│     localStorage fallback                                    │
│  4. Sets currentUser, profile, role in React state           │
│  5. Stores student JSON blob in localStorage for offline     │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                     AppShell (Route Guard)                   │
│  1. Checks isAuthenticated — truthy if:                      │
│     • Firebase currentUser !== null, OR                      │
│     • localStorage.isLoggedIn === 'true'  ⚠️ RISK           │
│  2. Checks role === allowedRole for the route                │
│  3. Redirects cross-role access to correct home              │
│  4. Enforces tenant boundary (non-owners cannot drift        │
│     to another tenant key)                                   │
└──────────────────────────────────────────────────────────────┘
```

### ⚠️ Security Gap in Auth

`isAuthenticated` in `AuthContext.jsx` line 131:
```js
isAuthenticated: Boolean(currentUser || localStorage.getItem('isLoggedIn') === 'true')
```
A user could manually set `localStorage.isLoggedIn = 'true'` and bypass the Firebase auth check at the React routing level. **Firestore rules still enforce server-side security**, but any client-rendered content would be accessible.

---

## 3. Role Definitions

| Role | Firestore Location | Portal Path | Description |
|------|-------------------|-------------|-------------|
| `student` | `/students/{email}` | `/student/*` | Bus pass holder |
| `driver` | `/users/{email}` | `/driver/*` | Vehicle operator |
| `conductor` | `/users/{email}` | `/driver/*` (same portal) | Bus conductor (shared with driver portal) |
| `staff` | `/users/{email}` | — (no dedicated portal yet) | General staff |
| `admin` | `/users/{email}` | `/admin/*` | Campus transport coordinator |
| `superadmin` | `/users/{email}` | `/admin/*` (treated as admin) | Elevated admin |
| `owner` | `/users/{email}` or synthesized | `/owner/*` | Platform SaaS owner |

---

## 4. Permission Matrix

### 4.1 Firestore Collection Permissions

| Action | Student | Driver/Conductor | Admin/Superadmin | Owner |
|--------|---------|-----------------|-----------------|-------|
| Read own user/student doc | ✅ | ✅ | ✅ | ✅ |
| Read other user docs | ❌ | ✅ (read-only) | ✅ | ✅ |
| Create/update user docs | ❌ | ❌ | ✅ | ✅ |
| Delete user docs | ❌ | ❌ | ✅ | ✅ |
| Read students | Self only | ❌ | ✅ | ✅ |
| Write students | ❌ | ❌ | ✅ | ✅ |
| Read buses | ✅ | ✅ | ✅ | ✅ |
| Create/delete buses | ❌ | ❌ | ✅ | ✅ |
| Update bus (location/headcount) | ❌ | ✅ (own bus only) | ✅ | ✅ |
| Read routes | ✅ | ✅ | ✅ | ✅ |
| Write routes | ❌ | ❌ | ✅ | ✅ |
| Read notifications | ✅ | ✅ | ✅ | ✅ |
| Write notifications | ❌ | ✅ | ✅ | ✅ |
| Read daily_boardings | Self only | ✅ | ✅ | ✅ |
| Create daily_boardings | Self (own records) | ✅ | ✅ | ✅ |
| Update/delete daily_boardings | ❌ | ❌ | ✅ | ✅ |
| Read lost-items | ✅ | ✅ | ✅ | ✅ |
| Create lost-items | ✅ (own) | ✅ | ✅ | ✅ |
| Update lost-items | Own only | ❌ | ✅ | ✅ |
| Read support-queries | Own only | ❌ | ✅ | ✅ |
| Create support-queries | ✅ (own) | ❌ | ✅ | ✅ |
| Update support-queries | Own only | ❌ | ✅ | ✅ |
| Read/write driverSessions | ❌ | Own session only | ✅ | ✅ |
| Read/write settings | ❌ (read only) | ❌ (read only) | ✅ | ✅ |
| Read/write tenants | ❌ (read only) | ❌ (read only) | ✅ | ✅ |

### 4.2 UI Feature Permissions

| Feature | Student | Driver | Admin | Owner |
|---------|---------|--------|-------|-------|
| View personal bus pass (QR) | ✅ | ❌ | ❌ | ❌ |
| View live bus tracking (map) | ✅ (own bus) | ✅ (own bus) | ✅ (all buses) | ✅ |
| Search routes/stops | ✅ | ❌ | ❌ | ❌ |
| View notifications | ✅ | ✅ | ✅ | ✅ |
| Report lost item | ✅ | ❌ | ❌ | ❌ |
| Submit support ticket | ✅ | ✅ | ❌ | ❌ |
| Scan/verify bus pass | ❌ | ✅ | ✅ | ❌ |
| Broadcast alerts to riders | ❌ | ✅ | ✅ | ❌ |
| Update bus status | ❌ | ✅ | ✅ | ❌ |
| Update headcount (+/-) | ❌ | ✅ | ✅ | ❌ |
| Start/stop shift with GPS | ❌ | ✅ | ❌ | ❌ |
| Manage fleet (buses) | ❌ | ❌ | ✅ | ❌ |
| Manage routes | ❌ | ❌ | ✅ | ❌ |
| Manage students | ❌ | ❌ | ✅ | ❌ |
| Manage staff | ❌ | ❌ | ✅ | ❌ |
| View shift history | ❌ | ❌ | ✅ | ❌ |
| Manage helpdesk tickets | ❌ | ❌ | ✅ | ❌ |
| Create notifications | ❌ | ✅ | ✅ | ❌ |
| Configure app settings | ❌ | ❌ | ✅ | ✅ |
| View platform-wide tenant list | ❌ | ❌ | ❌ | ✅ |
| Add new tenant | ❌ | ❌ | ❌ | ✅ (UI only — not persisted) |

---

## 5. Account Creation Flow

### Student Account Creation (Admin-initiated)
```
Admin → /admin/students → "Add Student" modal
  → createStudent(data) in students.js
    → createSecondaryAuthUser(email, password) 
       [Uses temporary secondary Firebase App to avoid admin sign-out]
    → setDoc(db, 'students', email, {...studentData, qrSecret: generateQrSecret()})
```

### Bulk Student Creation (CSV Import)
```
Admin → uploads CSV → parseCsv() → validateStudentRow() per row
  → batchImportStudents(validRows)
    → Firestore writeBatch (chunks of 400) with merge: true
    → Does NOT create Firebase Auth accounts (separate step: "Generate Passwords")
```

### Staff Account Creation (Admin-initiated)
```
Admin → /admin/staff → "Add Staff" modal
  → createStaffMember(data) in workforce.js
    → createSecondaryAuthUser(email, password)
    → setDoc(db, 'users', email, {...staffData})
```

---

## 6. TOTP (QR Pass) Security Details

```
Secret generation: 16 random bytes via window.crypto.getRandomValues()
                   → 32-char hex string stored in student.qrSecret

QR payload: JSON.stringify({ email, totp: SHA256(secret:timeIndex)[0:16], t: timeIndex })
            where timeIndex = Math.floor(Date.now() / 900000)  [15-minute windows]

Verification:
  - Check hash against current timeIndex
  - Check hash against (timeIndex - 1)  [grace period for clock skew]
  - ONLY the stored qrSecret allows verification → cannot forge without DB access
```

**Security strength:** SHA-256 truncated to 16 hex chars (64 bits). Acceptable for transit pass use case. Not equivalent to FIDO2 or full TOTP (RFC 6238) — no hardware secret, no 6-digit standard format — but functionally appropriate.

---

## 7. Logout

```js
logoutUser() in auth.js:
  1. firebaseSignOut(auth)
  2. Remove from localStorage:
     isLoggedIn, userEmail, userRole, userTenantId,
     student (JSON blob), adminName, ownerName
  3. React state cleared: currentUser=null, profile=null, role=null
```

> Note: `activeTenantKey` is NOT cleared on logout. Minor edge case: tenant context persists across sessions.

