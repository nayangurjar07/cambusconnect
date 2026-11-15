# Cambus Connect — Database Schema (`03-database-schema.md`)

## 1. Cloud Firestore Collections

### `users/{email}`
Stores Students, Drivers, Conductors, Staff, and Admins.
```json
{
  "name": "Rajesh Sharma",
  "email": "driver1@cambus.in",
  "role": "driver",
  "roleTier": "primary",
  "staffRoleLabel": "Primary Driver",
  "assignedBus": "12",
  "assignedBusId": "bus_doc_id",
  "phone": "+91 9876543210",
  "licenseNumber": "MP-09-2026-001",
  "status": "Active",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```
**Role Constraints:** Each `busNumber` supports at most one `primary` and one `secondary` user per role (`driver` or `conductor`), enforced by `validateStaffRoleConflict()` in `src/services/workforce.js`.

---

### `buses/{busId}`
Stores fleet vehicles, crew slots, and throttled live location snapshots.
```json
{
  "number": "12",
  "registrationNumber": "MP-09-FA-1012",
  "route": "Vijay Nagar - Campus",
  "routeId": "route_1",
  "capacity": 45,
  "headcount": 28,
  "status": "On Time",
  "primaryDriver": { "name": "Rajesh Sharma", "email": "driver1@cambus.in", "phone": "+91 9876543210" },
  "secondaryDriver": { "name": "Amit Verma", "email": "subdriver1@cambus.in", "phone": "+91 9876543211" },
  "primaryConductor": { "name": "Suresh Patel", "email": "cond1@cambus.in", "phone": "+91 9876543212" },
  "secondaryConductor": null,
  "isTracking": true,
  "trackingMode": "HIGH_FREQ_WATCHED",
  "activeWatchers": 4,
  "location": { "lat": 22.719568, "lng": 75.857727 },
  "speed": 34,
  "heading": 90,
  "accuracy": 8,
  "lastUpdate": "08:42 AM",
  "lastUpdated": 1763214720000,
  "activeBroadcaster": {
    "email": "driver1@cambus.in",
    "name": "Rajesh Sharma",
    "role": "driver",
    "roleTier": "primary",
    "priority": 1,
    "lastHeartbeat": 1763214720000,
    "streamSource": "gps"
  }
}
```

---

### `students/{email}`
Stores student transit pass credentials and registration metadata.
```json
{
  "name": "Nayan Gurjar",
  "email": "nayan@indoreinstitute.com",
  "collegeId": "0827CS211001",
  "rollNumber": "0827CS211001",
  "phone": "+91 9876543210",
  "branch": "Computer Science",
  "semester": "6",
  "busNumber": "12",
  "assignedBus": "12",
  "assignedRoute": "Route 1 - Super Corridor",
  "passStatus": "Active",
  "status": "Active",
  "validUntil": "2027-06-30T00:00:00.000Z",
  "qrSecret": "sec_b3f9104a...",
  "passId": "PASS-2026-0827"
}
```

---

### `routes/{routeId}`
Stores transit routes, scheduled waypoints, and stop geometries.
```json
{
  "code": "R-01",
  "name": "Route 1 - Super Corridor",
  "stops": [
    { "name": "Bada Ganpati", "lat": 22.7214, "lng": 75.8456, "time": "07:30 AM" },
    { "name": "Airport Circle", "lat": 22.7301, "lng": 75.8123, "time": "07:45 AM" },
    { "name": "Campus Terminal", "lat": 22.7482, "lng": 75.7891, "time": "08:15 AM" }
  ],
  "activeBusesCount": 2,
  "createdAt": "Timestamp"
}
```

---

### `trips/{tripId}` & `daily_boardings/{id}`
Logs atomic passenger boarding events generated from QR pass scans or driver check-ins.
```json
{
  "studentId": "nayan@indoreinstitute.com",
  "studentName": "Nayan Gurjar",
  "busId": "bus_doc_id",
  "busNumber": "12",
  "routeName": "Route 1 - Super Corridor",
  "timestamp": "Timestamp",
  "date": "2026-11-15",
  "type": "checkin",
  "verifiedBy": "driver1@cambus.in"
}
```

---

## 2. Firebase Realtime Database (`live_locations/{busId}`)
Used as the persistent cross-instance fallback cache behind `/api/bus-location.js`'s in-memory store (`busTelemetryMemoryCache`).
```json
{
  "busId": "bus_doc_id",
  "busNumber": "12",
  "lat": 22.719568,
  "lng": 75.857727,
  "speed": 34,
  "heading": 90,
  "accuracy": 8,
  "timestamp": 1763214720000,
  "broadcaster": {
    "email": "driver1@cambus.in",
    "name": "Rajesh Sharma",
    "role": "driver",
    "roleTier": "primary",
    "priority": 1
  }
}
```
