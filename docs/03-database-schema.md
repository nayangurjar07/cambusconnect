# 03 — Database Schema Reference
# Cambus Connect Enterprise — Firestore

**Version:** 1.0 (September 2026)

> All Firestore document IDs and field names are inferred directly from service files, page components, and `firestore.rules`.

---

## 1. Collections Overview

| Collection | Document ID Pattern | Primary Owner |
|-----------|--------------------|----|
| `users` | `{email}` (lowercase) | Admin, Driver, Conductor, Owner |
| `students` | `{email}` (lowercase) | Student bus pass holders |
| `buses` | Auto-ID | Fleet vehicles |
| `routes` | Auto-ID | Bus routes |
| `trips` | Auto-ID | Individual boarding events |
| `daily_boardings` | Auto-ID | Daily aggregation of boardings |
| `submitted-boardings` | Auto-ID | Scan-submitted boarding records |
| `driverSessions` | Auto-ID | Active/historical shift sessions |
| `notifications` | Auto-ID | Broadcast alerts |
| `lost-items` | Auto-ID | Lost & found reports |
| `support-queries` | Auto-ID | Student helpdesk tickets |
| `settings` | Fixed doc IDs | App configuration |
| `sub-institutes` | Auto-ID | Sub-campus units |
| `tenants` | `{tenantId}` | Multi-tenant registry (stub) |

---

## 2. Document Schemas

### 2.1 `/users/{email}`
Used for admin, driver, conductor, owner accounts.

```js
{
  name: string,
  email: string,              // lowercase, same as doc ID
  role: 'admin' | 'driver' | 'conductor' | 'staff' | 'owner' | 'superadmin',
  phone: string,
  assignedBus: string,        // Bus number (e.g., "Bus 14")
  assignedBusId: string,      // Firestore bus doc ID
  licenseNumber: string,      // Driver's license (driver/conductor only)
  status: 'Active' | 'Inactive',
  tenantId: string,           // 'default' in current build
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

> *Note: `driverEmails[]` field on bus docs is used for permission checks but no corresponding field is stored on the user doc in workforce service.*

---

### 2.2 `/students/{email}`
Used for student bus pass holders.

```js
{
  name: string,
  email: string,              // lowercase, same as doc ID
  role: 'student',
  collegeId: string,          // Enrollment number / college ID
  enrollment: string,         // Alias for collegeId (both may exist)
  phone: string,
  parentPhone: string,        // Emergency contact
  busRoute: string,           // Route name/code (e.g., "Route A")
  routeId: string,            // Firestore route doc ID
  assignedBusId: string,      // Firestore bus doc ID
  assignedBusNumber: string,  // Bus number (display)
  pickupStop: string,         // Morning boarding stop name
  passValidity: string,       // 'YYYY-MM-DD' ISO date string
  qrSecret: string,           // 32-char hex (16 random bytes via Web Crypto)
  qrCodeData: string,         // JSON string (legacy QR payload, pre-TOTP)
  status: 'Active' | 'Inactive' | 'Revoked',
  tenantId: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  importedAt: Timestamp       // Set on CSV bulk import
}
```

**Lookup strategy in `getStudentProfile()`:**
1. Direct doc lookup by `email` (doc ID)
2. Query `where('collegeId', '==', identifier)`
3. Query `where('enrollment', '==', identifier)`
4. Query `where('email', '==', identifier)`

---

### 2.3 `/buses/{busId}`
Fleet vehicle records with embedded live telemetry.

```js
{
  number: string,             // e.g., "Bus 14" — must be unique
  registrationNumber: string, // License plate — must be unique
  route: string,              // Route name (denormalized)
  routeId: string,            // Firestore route doc ID
  capacity: number,           // Default: 45
  headcount: number,          // Live passenger count (bounded 0..capacity)
  driver: string,             // Driver name (legacy single driver)
  phone: string,              // Driver phone
  driverEmails: string[],     // Array of authorized driver emails (new field)
  conductor: string,          // Conductor name
  conductorPhone: string,
  conductorEmails: string[],  // Array of authorized conductor emails
  status: 'On Time' | 'Delayed' | 'Breakdown',
  tracking: {
    sourceType: 'driver_phone' | 'gps_tracker',
    trackerId: string,        // External GPS device ID if applicable
    isOnline: boolean
  },
  location: {
    lat: number,
    lng: number
  } | null,
  speed: number,              // km/h
  eta: string,                // e.g., "15 min"
  lastUpdate: string,         // HH:MM time string
  lastGpsUpdate: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Sub-collection:**
```
/buses/{busId}/boardings/{boardingId}
{
  studentEmail: string,
  studentId: string,
  timestamp: Timestamp
}
```

---

### 2.4 `/routes/{routeId}`
Bus routes with stop waypoints.

```js
{
  code: string,               // e.g., "R1" — must be unique
  name: string,               // e.g., "Route A - City Center" — must be unique
  active: boolean,
  assignedShiftIds: string[], // e.g., ['shift_1', 'shift_2']
  stops: string[],            // Array of stop names in order
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### 2.5 `/trips/{tripId}`
Individual boarding log entries.

```js
{
  studentId: string,          // student email (doc ID)
  studentName: string,
  busId: string,
  busNumber: string,
  routeName: string,
  timestamp: Timestamp
}
```

---

### 2.6 `/daily_boardings/{boardingId}`
Parallel boarding log for daily aggregation.

```js
{
  studentId: string,
  studentEmail: string,
  studentName: string,
  busId: string,
  busNumber: string,
  date: string,               // 'YYYY-MM-DD'
  timestamp: Timestamp
}
```

**Sub-collection:**
```
/daily_boardings/{boardingId}/logs/{studentId}
{
  studentEmail: string
}
```

---

### 2.7 `/submitted-boardings/{boardingId}`
Scan-session committed boarding records.

```js
{
  studentId: string,
  studentEmail: string,
  studentName: string,
  busId: string,
  busNumber: string,
  route: string,
  scanMode: 'checkin' | 'checkout',
  submittedAt: Timestamp
}
```

---

### 2.8 `/driverSessions/{sessionId}`
Driver shift sessions (active and historical).

```js
{
  driverEmail: string,
  driverName: string,
  busId: string,
  busNumber: string,
  route: string,
  status: 'Active' | 'Stopped',
  startTime: Timestamp,
  endTime: Timestamp | null,
  totalBoardings: number,
  createdAt: Timestamp
}
```

---

### 2.9 `/notifications/{notifId}`
Broadcast alert notifications.

```js
{
  title: string,
  message: string,
  type: 'info' | 'alert' | 'delay' | 'crowd',
  targetRouteId: string,      // Route ID or 'all'
  createdAt: Timestamp
}
```

---

### 2.10 `/lost-items/{itemId}`
Lost & found reports.

```js
{
  title: string,
  itemName: string,           // Alias for title
  item: string,               // Legacy alias
  description: string,
  locationType: 'BUS' | 'CAMPUS',
  location: string,           // e.g., "Bus 14" or "Library Block"
  route: string,
  busNumber: string,
  dateLost: string,           // 'YYYY-MM-DD'
  status: 'Lost' | 'Found' | 'Claimed',
  userId: string,             // UID or email
  userEmail: string,
  userName: string,
  reportedBy: string,         // Alias for userName
  contactName: string,
  contactEmail: string,
  contactPhone: string,
  userPhone: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

> ⚠️ **Redundancy alert:** `title`, `itemName`, `item` are all the same value. `userId`, `userEmail`, `userName`, `reportedBy`, `contactName` are all overlapping identity fields. This is a result of evolving field names across iterations. Cleanup is recommended.

---

### 2.11 `/support-queries/{queryId}`
Student helpdesk support tickets.

```js
{
  studentName: string,
  studentEmail: string,
  studentId: string,          // UID or email
  subject: string,
  category: 'Transit' | 'Lost & Found' | 'General Inquiry' | ...,
  message: string,
  status: 'Pending' | 'Open' | 'In Progress' | 'Resolved',
  adminNotes: string,
  source: string,             // e.g., 'student_lost_found' for fallback writes
  resolvedAt: Timestamp | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### 2.12 `/settings/{settingId}`
Application configuration documents.

**`/settings/shiftConfig`**
```js
{
  shifts: [{
    id: 'shift_1' | 'shift_2' | ...,
    name: string,
    enabled: boolean,
    startTime: string,         // '08:30' (24-hour)
    endTime: string,           // '16:30' (24-hour)
    activeDays: string[]       // ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  }],
  // Backward compatibility fields (legacy readers):
  shift1Name: string,
  shift1Timing: string,        // '08:30 AM - 04:30 PM'
  shift2Name: string,
  shift2Timing: string,
  enableShift2: boolean,
  updatedAt: Timestamp
}
```

**`/settings/studentImportSchema`**
```js
{
  fields: [{
    key: string,               // e.g., 'name', 'email', 'phone'
    label: string,
    type: 'string' | 'email' | 'phone' | 'date' | 'route' | 'bus' | 'status',
    required: boolean,
    locked: boolean,           // If true, cannot be removed
    description: string
  }],
  updatedAt: Timestamp
}
```

---

## 3. Composite Indexes (firestore.indexes.json)

| Collection | Fields | Order |
|-----------|--------|-------|
| `users` | `role` ASC, `name` ASC | — |
| `users` | `role` ASC, `createdAt` DESC | — |
| `support-queries` | `status` ASC, `createdAt` DESC | — |
| `support-queries` | `studentEmail` ASC, `createdAt` DESC | — |
| `driverSessions` | `status` ASC, `startTime` DESC | — |
| `lost-items` | `status` ASC, `createdAt` DESC | — |
| `notifications` | `targetRouteId` ASC, `createdAt` DESC | — |
| `submitted-boardings` | `submittedAt` DESC | — |
| `students` | `busRoute` ASC, `createdAt` DESC | — |
| `students` | `busRoute` ASC, `name` ASC | — |
| `students` | `status` ASC, `createdAt` DESC | — |
| `students` | `status` ASC, `name` ASC | — |

---

## 4. Security Rules Summary

| Collection | Read | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| `users/{email}` | Self or Admin/Driver | Admin or Self | Admin or Self (no role change) | Admin only |
| `students/{id}` | Self or Admin | Admin only | Admin only | Admin only |
| `buses/{id}` | Any auth | Admin only | Admin or Assigned Driver | Admin only |
| `buses/{id}/boardings` | Admin, Driver, or self | Admin or Driver | — | — |
| `daily_boardings` | Admin, Driver, or self | Admin, Driver, or self-creating | Admin only | Admin only |
| `submitted-boardings` | Admin, Driver, or self | Admin or Driver | Admin only | Admin only |
| `notifications` | Any auth | Admin or Driver | Admin or Driver | Admin or Driver |
| `lost-items` | Any auth | Any auth (with identity check) | Admin or owner | Admin or owner |
| `support-queries` | Admin or self | Any auth (with identity check) | Admin or self | Admin only |
| `trips` | Any auth | Admin or Driver | Admin or Driver | Admin or Driver |
| `driverSessions` | Admin or own session | Admin or own session | Admin or own session | — |
| `settings` | Any auth | Admin only | Admin only | Admin only |
| `sub-institutes` | Any auth | Admin only | Admin only | Admin only |
| `tenants` | Any auth | Admin only | Admin only | Admin only |

> ⚠️ **Rules risk:** `getUserData()` in rules does a per-request Firestore read (`get()`). This is a billable read per rule evaluation — can become expensive at scale. Custom claims are the recommended alternative.

