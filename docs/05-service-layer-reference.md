# Cambus Connect — Service Layer Reference (`05-service-layer-reference.md`)

## 1. Transit Service (`src/services/transit.js`)

### `updateBusLiveLocation(options)`
- **Purpose:** Pushes live device GPS coordinates from the Driver or Conductor portal to `/api/bus-location` (in-memory cache) and conditionally syncs to Firestore `buses/{busId}` based on watcher demand and displacement (> 120m).
- **Stream Guard:** Enforces priority (`Primary Driver [1] > Secondary Driver [2] > Primary Conductor [3] > Secondary Conductor [4]`). Returns `{ isStandby: true, activeBroadcaster }` if a higher-priority crew member is actively broadcasting.
- **Returns:** `{ success, isStandby, cachedOnly, activeWatchers, mode, recommendedIntervalMs }`.

### `pollCachedBusLocation(busId, watch = true)`
- **Purpose:** Called by Student (`Track.jsx`) and Admin (`Tracking.jsx`) maps every 15 seconds. Registers the viewer as an `activeWatcher` in `/api/bus-location` and returns the latest coordinates from server RAM without triggering Firestore document reads.

### `releaseBusLiveStream(busId, userEmail)`
- **Purpose:** Immediately clears `isTracking` and `activeBroadcaster` in both the backend RAM cache and Firestore when a driver or conductor ends their trip.

### `getBusTrackingHealth(bus, staleThresholdSeconds = 110)`
- **Purpose:** Evaluates whether a bus is `LIVE`, `STALE`, `OFFLINE`, or `NO_LOCATION`. Supports both High-Frequency Mode and Eco Mode heartbeats.

### `getBusesTrackingSummary(buses, staleThresholdSeconds = 110)`
- **Purpose:** Partitions the fleet into `liveBuses`, `unavailableBuses`, and `staleBuses` so the Admin Tracking Console can display real-time alerts whenever any bus's live location is unavailable.

### `subscribeToBuses(onUpdate, onError)`
- **Purpose:** Real-time listener on entire `/buses` collection.

### `createBus(data)` & `updateBus(busId, data)`
- **Purpose:** Creates or updates fleet vehicle records after verifying bus number, registration number, and crew constraints via `validateBusConstraints()`.

### `incrementBusHeadcount(busId, delta, maxCapacity)`
- **Purpose:** Executes an atomic Firestore transaction to safely increment passenger headcount within 0 to `maxCapacity`.

### `logBoarding({ studentId, studentName, busId, busNumber, routeName })`
- **Purpose:** Creates a timestamped passenger boarding document in `/trips` and logs daily boarding aggregation in `/daily_boardings`.

---

## 2. Workforce Service (`src/services/workforce.js`)

### `validateStaffRoleConflict(staffList, busNumber, role, roleTier, currentEmail)`
- **Purpose:** Validates that a bus does not have two `primary` or two `secondary` staff members of the same role (`driver` or `conductor`).

### `syncStaffToBus(busNumber, staffData)`
- **Purpose:** Automatically syncs `primaryDriver`, `secondaryDriver`, `primaryConductor`, and `secondaryConductor` objects onto the matching `buses` document whenever staff assignments are created or updated in Admin.

### `getStaffRoleLabel(role, roleTier)`
- **Purpose:** Formats human-readable operational role titles (e.g., "Primary Driver", "Secondary Driver (Substitute)", "Primary Conductor").

### `subscribeToStaff(onUpdate, onError)`
- **Purpose:** Real-time listener on `/users` collection filtered by operations roles (`driver`, `conductor`, `staff`, `admin`).

### `createStaffMember(data)` & `updateStaffMember(email, data)`
- **Purpose:** Creates Firebase Auth accounts and manages Firestore `/users/{email}` operational records.

---

## 3. Student Service (`src/services/students.js`)
- `getPaginatedStudents(pageSize, lastVisible, routeFilter, statusFilter, searchQuery)`: Cursor-based pagination with composite filters.
- `getStudentProfile(identifier)`: Multi-strategy lookup (`docId`, `collegeId`, `enrollment`, `email`) with in-memory caching.
- `createStudent(data)` & `updateStudent(email, data)`: Full student profile lifecycle and credential synchronization.
- `batchImportStudents(validRows, onProgress)`: Batch import in chunks of 400 records.

---

## 4. Communications Service (`src/services/communications.js`)
- `subscribeToNotifications(onUpdate, onError, maxItems)`: Broadcast transit announcements.
- `createNotification({ title, message, type, targetRouteId })`: Dispatch emergency, delay, or route alerts.
- `subscribeToSupportQueries(onUpdate, onError)`: Helpdesk ticket stream.
- `subscribeToLostItems(onUpdate, onError)`: Real-time lost & found registry.

---

## 5. Authentication Service (`src/services/auth.js`)
- `loginUser(rawEmailOrId, password, expectedRole)`: Authenticates against Firebase Auth, verifies Firestore role match, checks student pass validity, and provisions session state.
- `logoutUser()`: Clears Firebase Auth tokens and localStorage session cache.
- `getCurrentSession()`: Fast synchronous session inspection from cached storage.
