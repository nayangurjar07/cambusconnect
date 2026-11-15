// src/services/transit.js
import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query,
  where,
  serverTimestamp,
  runTransaction,
  getCountFromServer
} from '../config/firebase';

// ==========================================
// BUSES
// ==========================================

export function subscribeToBuses(onUpdate, onError) {
  const busesCol = collection(db, 'buses');
  return onSnapshot(busesCol, (snapshot) => {
    const buses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(buses);
  }, (err) => {
    console.error("Error listening to buses collection:", err);
    if (onError) onError(err);
  });
}

export function subscribeToBus(busId, onUpdate, onError) {
  if (!busId) return () => {};
  const busDocRef = doc(db, 'buses', busId);
  return onSnapshot(busDocRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ id: snapshot.id, ...snapshot.data() });
    } else {
      onUpdate(null);
    }
  }, (err) => {
    console.error(`Error listening to bus ${busId}:`, err);
    if (onError) onError(err);
  });
}

const busCache = new Map();
const BUS_CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

export async function getBus(busId) {
  if (!busId) return null;
  
  if (busCache.has(busId)) {
    const { data, timestamp } = busCache.get(busId);
    if (Date.now() - timestamp < BUS_CACHE_TTL_MS) {
      return data;
    } else {
      busCache.delete(busId);
    }
  }

  const busDoc = await getDoc(doc(db, 'buses', busId));
  if (busDoc.exists()) {
    const data = { id: busDoc.id, ...busDoc.data() };
    busCache.set(busId, { data, timestamp: Date.now() });
    return data;
  }
  return null;
}

async function validateBusConstraints(data, currentBusId = null) {
  const snapshot = await getDocs(collection(db, 'buses'));
  const buses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  for (const bus of buses) {
    // Skip checking against the bus we are currently updating
    if (currentBusId && bus.id === currentBusId) continue;

    // 1. Bus Number Uniqueness
    if (data.number && bus.number && data.number.trim().toLowerCase() === bus.number.trim().toLowerCase()) {
      throw new Error(`A bus with the number "${data.number}" already exists.`);
    }

    // 2. Registration Number Uniqueness
    if (data.registrationNumber && bus.registrationNumber && data.registrationNumber.trim().toLowerCase() === bus.registrationNumber.trim().toLowerCase()) {
      throw new Error(`A bus with registration "${data.registrationNumber}" already exists.`);
    }

    // 3. Driver Assignment Uniqueness
    if (data.driver && bus.driver && data.driver.trim().toLowerCase() === bus.driver.trim().toLowerCase()) {
      throw new Error(`Driver "${data.driver}" is already assigned to Bus "${bus.number}". Please re-assign them first.`);
    }

    // 4. Conductor Assignment Uniqueness
    if (data.conductor && bus.conductor && data.conductor.trim().toLowerCase() === bus.conductor.trim().toLowerCase()) {
      throw new Error(`Conductor "${data.conductor}" is already assigned to Bus "${bus.number}". Please re-assign them first.`);
    }
  }
}

export async function createBus(data) {
  await validateBusConstraints(data);
  const busesCol = collection(db, 'buses');
  const docRef = await addDoc(busesCol, {
    number: data.number,
    registrationNumber: data.registrationNumber || '',
    route: data.route || '',
    routeId: data.routeId || '',
    capacity: Number(data.capacity) || 45,
    driver: data.driver || '',
    phone: data.phone || '',
    conductor: data.conductor || '',
    conductorPhone: data.conductorPhone || '',
    status: data.status || 'On Time',
    headcount: Math.min(Number(data.capacity) || 45, Math.max(0, Number(data.headcount) || 0)),
    tracking: {
      sourceType: data.sourceType || 'driver_phone',
      trackerId: data.trackerId || '',
      isOnline: false
    },
    location: data.location || null, // Never fabricate fake coordinates
    speed: data.speed || 0,
    eta: data.eta || '15 min',
    lastUpdate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateBus(busId, data) {
  await validateBusConstraints(data, busId);
  const busRef = doc(db, 'buses', busId);
  const updatePayload = { ...data, updatedAt: serverTimestamp() };
  if ('capacity' in data) {
    updatePayload.capacity = Number(data.capacity) || 45;
  }
  if ('headcount' in data) {
    updatePayload.headcount = Math.max(0, Number(data.headcount) || 0);
  }
  await updateDoc(busRef, updatePayload);
  busCache.delete(busId); // Invalidate cache
}

export async function updateBusStatus(busId, status) {
  const busRef = doc(db, 'buses', busId);
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  await updateDoc(busRef, {
    status,
    lastUpdate: nowTime,
    updatedAt: serverTimestamp()
  });
  busCache.delete(busId); // Invalidate cache
}

export async function updateBusHeadcount(busId, newHeadcount, maxCapacity = null) {
  // Legacy method for absolute set (used sparingly)
  const busRef = doc(db, 'buses', busId);
  let effectiveCapacity = maxCapacity;

  if (effectiveCapacity === null || effectiveCapacity === undefined) {
    const snap = await getDoc(busRef);
    if (snap.exists()) {
      effectiveCapacity = Number(snap.data().capacity) || 45;
    } else {
      effectiveCapacity = 45;
    }
  }

  const boundedHeadcount = Math.min(effectiveCapacity, Math.max(0, newHeadcount));
  await updateDoc(busRef, {
    headcount: boundedHeadcount,
    updatedAt: serverTimestamp()
  });
  return boundedHeadcount;
}

export async function incrementBusHeadcount(busId, delta, maxCapacity = null) {
  const busRef = doc(db, 'buses', busId);
  
  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(busRef);
    if (!snap.exists()) {
      throw new Error("Bus does not exist.");
    }
    
    const data = snap.data();
    const currentHeadcount = Number(data.headcount) || 0;
    const effectiveCapacity = maxCapacity !== null ? maxCapacity : (Number(data.capacity) || 45);
    
    let newHeadcount = currentHeadcount + delta;
    newHeadcount = Math.min(effectiveCapacity, Math.max(0, newHeadcount));
    
    transaction.update(busRef, {
      headcount: newHeadcount,
      updatedAt: serverTimestamp()
    });
    
    return newHeadcount;
  });
}

export async function updateBusLocation(busId, lat, lng, speed = 25) {
  const busRef = doc(db, 'buses', busId);
  await updateDoc(busRef, {
    'location.lat': lat,
    'location.lng': lng,
    speed,
    lastUpdate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    updatedAt: serverTimestamp()
  });
}

/**
 * updateBusLiveLocation
 * Single Active Stream Guard coordinate broadcaster for Driver & Conductor portals.
 * Enforces stream hierarchy: Primary Driver (1) > Secondary Driver (2) > Primary Conductor (3) > Secondary Conductor (4).
 */
export async function updateBusLiveLocation({
  busId,
  lat,
  lng,
  speed = 25,
  user = null,
  streamSource = 'gps', // 'gps' | 'simulation'
  onStandby = null
}) {
  if (!busId || lat == null || lng == null) return { success: false, reason: 'Invalid parameters' };

  const busRef = doc(db, 'buses', busId);
  const userEmail = user?.email?.toLowerCase().trim() || 'anonymous';
  const role = user?.role || 'driver';
  const roleTier = user?.roleTier || 'primary';

  // Priority ranking: 1 (highest) to 4 (lowest)
  let userPriority = 4;
  if (role === 'driver') {
    userPriority = roleTier === 'primary' ? 1 : 2;
  } else if (role === 'conductor') {
    userPriority = roleTier === 'primary' ? 3 : 4;
  }

  const now = Date.now();
  const busSnap = await getDoc(busRef);
  if (!busSnap.exists()) return { success: false, reason: 'Bus record not found' };

  const busData = busSnap.data();
  const currentBroadcaster = busData.activeBroadcaster;

  // Single Active Stream Guard:
  // If someone else is actively broadcasting and their heartbeat is fresh (< 25s)
  if (currentBroadcaster && currentBroadcaster.email && currentBroadcaster.email !== userEmail) {
    const isFresh = currentBroadcaster.lastHeartbeat && (now - currentBroadcaster.lastHeartbeat) < 25000;
    if (isFresh) {
      // If current user has lower priority, enforce Standby mode
      if (userPriority > currentBroadcaster.priority) {
        if (onStandby) {
          onStandby({
            isStandby: true,
            activeBroadcaster: currentBroadcaster
          });
        }
        return { 
          success: false, 
          isStandby: true, 
          activeBroadcaster: currentBroadcaster,
          reason: `${currentBroadcaster.role === 'driver' ? 'Driver' : 'Conductor'} (${currentBroadcaster.name || currentBroadcaster.email}) has active stream priority.` 
        };
      }
      // If current user has higher or equal priority, they preempt and take over the active stream
    }
  }

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const updatePayload = {
    isTracking: true,
    'location.lat': Number(lat),
    'location.lng': Number(lng),
    speed: Number(speed) || 0,
    locationSource: streamSource === 'simulation' ? 'simulation' : (role === 'conductor' ? 'conductor_phone' : 'driver_phone'),
    lastUpdate: nowTime,
    lastUpdated: now,
    activeBroadcaster: {
      email: userEmail,
      name: user?.name || (role === 'conductor' ? 'Conductor' : 'Driver'),
      role,
      roleTier,
      priority: userPriority,
      lastHeartbeat: now,
      streamSource
    },
    updatedAt: serverTimestamp()
  };

  await updateDoc(busRef, updatePayload);
  return { success: true, isStandby: false };
}

/**
 * releaseBusLiveStream
 * Cleans up activeBroadcaster so standby crew can take over immediately.
 */
export async function releaseBusLiveStream(busId, userEmail) {
  if (!busId) return;
  try {
    const busRef = doc(db, 'buses', busId);
    const busSnap = await getDoc(busRef);
    if (busSnap.exists()) {
      const data = busSnap.data();
      const cleanEmail = userEmail ? String(userEmail).toLowerCase().trim() : '';
      if (!cleanEmail || data.activeBroadcaster?.email === cleanEmail) {
        await updateDoc(busRef, {
          isTracking: false,
          activeBroadcaster: null,
          speed: 0,
          lastUpdate: 'Shift ended',
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (err) {
    console.warn("Failed to release bus live stream:", err);
  }
}

/**
 * getBusTrackingHealth
 * Evaluates live location health with a strict stale heartbeat threshold (default 60 seconds).
 * Returns: { isLive, status: 'LIVE' | 'STALE' | 'OFFLINE' | 'NO_LOCATION', badgeColor, label, detail, lastSeenText, broadcasterLabel, broadcaster }
 */
export function getBusTrackingHealth(bus, staleThresholdSeconds = 60) {
  if (!bus) {
    return {
      isLive: false,
      status: 'OFFLINE',
      badgeColor: 'rose',
      label: 'Unavailable',
      detail: 'No vehicle data',
      lastSeenText: 'Never started',
      broadcasterLabel: 'Unassigned',
      diffSeconds: Infinity
    };
  }

  // 1. Check coordinates existence and validity
  const hasCoords = bus.location && 
    typeof bus.location.lat === 'number' && 
    typeof bus.location.lng === 'number' &&
    !isNaN(bus.location.lat) && 
    !isNaN(bus.location.lng) &&
    bus.location.lat >= -90 && bus.location.lat <= 90 &&
    bus.location.lng >= -180 && bus.location.lng <= 180;

  if (!hasCoords) {
    return {
      isLive: false,
      status: 'NO_LOCATION',
      badgeColor: 'rose',
      label: 'Location Unavailable',
      detail: 'GPS coordinates missing',
      lastSeenText: 'Never started',
      broadcasterLabel: bus.driver ? `Driver: ${bus.driver}` : 'Unassigned Crew',
      diffSeconds: Infinity
    };
  }

  // 2. Extract highest precision last updated timestamp
  let lastTimestampMs = 0;
  if (typeof bus.lastUpdated === 'number' && bus.lastUpdated > 0) {
    lastTimestampMs = bus.lastUpdated;
  } else if (bus.activeBroadcaster?.lastHeartbeat && typeof bus.activeBroadcaster.lastHeartbeat === 'number') {
    lastTimestampMs = bus.activeBroadcaster.lastHeartbeat;
  } else if (bus.updatedAt?.toMillis) {
    lastTimestampMs = bus.updatedAt.toMillis();
  } else if (bus.updatedAt?.toDate) {
    lastTimestampMs = bus.updatedAt.toDate().getTime();
  } else if (bus.updatedAt) {
    lastTimestampMs = new Date(bus.updatedAt).getTime();
  } else if (bus.lastGpsUpdate?.toDate) {
    lastTimestampMs = bus.lastGpsUpdate.toDate().getTime();
  } else if (bus.lastGpsUpdate) {
    lastTimestampMs = new Date(bus.lastGpsUpdate).getTime();
  }

  const now = Date.now();
  const diffSec = lastTimestampMs > 0 ? Math.max(0, Math.floor((now - lastTimestampMs) / 1000)) : Infinity;

  // Format human-friendly relative time text
  let lastSeenText = 'Never started';
  if (lastTimestampMs > 0 && !isNaN(lastTimestampMs)) {
    if (diffSec < 5) lastSeenText = 'Just now';
    else if (diffSec < 60) lastSeenText = `${diffSec}s ago`;
    else if (diffSec < 3600) lastSeenText = `${Math.floor(diffSec / 60)}m ago`;
    else lastSeenText = `${Math.floor(diffSec / 3600)}h ago`;
  } else if (bus.lastUpdate) {
    lastSeenText = String(bus.lastUpdate);
  }

  // Broadcaster designation
  const broadcaster = bus.activeBroadcaster;
  const broadcasterLabel = broadcaster 
    ? `${broadcaster.roleTier === 'secondary' ? 'Secondary' : 'Primary'} ${broadcaster.role === 'conductor' ? 'Conductor' : 'Driver'}${broadcaster.name ? ` (${broadcaster.name})` : ''}`
    : (bus.driver ? `Driver: ${bus.driver}` : 'Unassigned Crew');

  const isExplicitlyTracking = bus.isTracking === true || Boolean(broadcaster);

  // Status Tier 1: LIVE active stream within heartbeat threshold
  if (diffSec <= staleThresholdSeconds && bus.isTracking !== false) {
    return {
      isLive: true,
      status: 'LIVE',
      badgeColor: 'emerald',
      label: 'Live',
      detail: `Broadcasting (${lastSeenText})`,
      diffSeconds: diffSec,
      lastSeenText,
      broadcasterLabel,
      broadcaster
    };
  }

  // Status Tier 2: STALE (missed recent heartbeat but was recently active)
  if (diffSec <= staleThresholdSeconds * 3 && isExplicitlyTracking) {
    return {
      isLive: false,
      status: 'STALE',
      badgeColor: 'amber',
      label: 'Signal Stale',
      detail: `Heartbeat missed (${lastSeenText})`,
      diffSeconds: diffSec,
      lastSeenText,
      broadcasterLabel,
      broadcaster
    };
  }

  // Status Tier 3: OFFLINE / Location Unavailable
  return {
    isLive: false,
    status: 'OFFLINE',
    badgeColor: 'rose',
    label: 'Location Unavailable',
    detail: lastTimestampMs > 0 ? `Offline (Last seen ${lastSeenText})` : 'Never started',
    diffSeconds: diffSec,
    lastSeenText,
    broadcasterLabel,
    broadcaster
  };
}

/**
 * getBusesTrackingSummary
 * Aggregates fleet tracking status across all registered buses.
 */
export function getBusesTrackingSummary(buses = [], staleThresholdSeconds = 60) {
  const liveBuses = [];
  const unavailableBuses = [];
  const staleBuses = [];

  buses.forEach(bus => {
    const health = getBusTrackingHealth(bus, staleThresholdSeconds);
    const enrichedBus = { ...bus, trackingHealth: health };

    if (health.isLive) {
      liveBuses.push(enrichedBus);
    } else {
      unavailableBuses.push(enrichedBus);
      if (health.status === 'STALE') {
        staleBuses.push(enrichedBus);
      }
    }
  });

  return {
    total: buses.length,
    liveCount: liveBuses.length,
    unavailableCount: unavailableBuses.length,
    staleCount: staleBuses.length,
    liveBuses,
    unavailableBuses,
    staleBuses,
    hasUnavailableBuses: unavailableBuses.length > 0,
    hasLiveBuses: liveBuses.length > 0
  };
}

/**
 * getBusByNumber
 * Case-insensitive lookup of a bus by busNumber or string id.
 */
export function getBusByNumber(buses = [], busNumberQuery = '') {
  if (!busNumberQuery) return null;
  const q = String(busNumberQuery).toLowerCase().trim();
  return buses.find(b => 
    String(b.number || '').toLowerCase().trim() === q ||
    String(b.id || '').toLowerCase().trim() === q ||
    String(b.registrationNumber || '').toLowerCase().trim() === q
  ) || null;
}

export async function deleteBus(busId) {
  const busRef = doc(db, 'buses', busId);
  await deleteDoc(busRef);
  busCache.delete(busId); // Invalidate cache
}

// ==========================================
// ROUTES
// ==========================================

export const DEFAULT_ROUTES = [];

export function subscribeToRoutes(onUpdate, onError) {
  const q = query(collection(db, 'routes'));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      onUpdate(DEFAULT_ROUTES);
    } else {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort active first, then code/name
      list.sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
      onUpdate(list);
    }
  }, (err) => {
    console.warn("Routes subscription error, using defaults:", err);
    onUpdate(DEFAULT_ROUTES);
    if (onError) onError(err);
  });
}

async function validateRouteConstraints(routeData, currentRouteId = null) {
  const snapshot = await getDocs(collection(db, 'routes'));
  const routes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  for (const route of routes) {
    if (currentRouteId && route.id === currentRouteId) continue;

    if (routeData.code && route.code && routeData.code.trim().toLowerCase() === route.code.trim().toLowerCase()) {
      throw new Error(`A route with code "${routeData.code}" already exists.`);
    }

    if (routeData.name && route.name && routeData.name.trim().toLowerCase() === route.name.trim().toLowerCase()) {
      throw new Error(`A route with name "${routeData.name}" already exists.`);
    }
  }
}

export async function createRoute(routeData) {
  await validateRouteConstraints(routeData);
  const collectionRef = collection(db, 'routes');
  const payload = {
    code: routeData.code || 'R',
    name: routeData.name || 'New Route',
    active: routeData.active !== false,
    assignedShiftIds: routeData.assignedShiftIds || ['shift_1'],
    stops: Array.isArray(routeData.stops) ? routeData.stops : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const docRef = await addDoc(collectionRef, payload);
  return { id: docRef.id, ...payload };
}

export async function updateRoute(routeId, routeData) {
  await validateRouteConstraints(routeData, routeId);
  const docRef = doc(db, 'routes', routeId);
  const payload = {
    ...routeData,
    updatedAt: serverTimestamp()
  };
  await setDoc(docRef, payload, { merge: true });
}

export async function deleteRoute(routeId) {
  const docRef = doc(db, 'routes', routeId);
  await deleteDoc(docRef);
}

export async function seedDefaultRoutesIfEmpty() {
  const snapshot = await getDocs(collection(db, 'routes'));
  if (snapshot.empty) {
    for (const r of DEFAULT_ROUTES) {
      const docRef = doc(db, 'routes', r.id);
      await setDoc(docRef, {
        ...r,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }
}

// ==========================================
// TRIPS / BOARDINGS
// ==========================================

export async function logBoarding({ studentId, studentName, busId, busNumber, routeName }) {
  const col = collection(db, 'trips');
  const docRef = await addDoc(col, {
    studentId,
    studentName,
    busId,
    busNumber,
    routeName,
    timestamp: serverTimestamp()
  });

  // Also log to daily_boardings for quick aggregation
  try {
    const dailyCol = collection(db, 'daily_boardings');
    await addDoc(dailyCol, {
      studentId,
      studentName,
      busId,
      busNumber,
      date: new Date().toISOString().split('T')[0],
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn("Could not log daily boarding record:", e);
  }

  return docRef.id;
}

export async function getStudentTripsCount(studentId) {
  if (!studentId) return 0;
  const col = collection(db, 'trips');
  // First day of current month at midnight
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  try {
    // High-performance server-side aggregation query (single metadata read)
    const q = query(
      col, 
      where('studentId', '==', studentId),
      where('timestamp', '>=', startOfMonth)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (indexOrNetworkErr) {
    // Graceful fallback if composite index is pending deployment
    try {
      const fallbackQuery = query(col, where('studentId', '==', studentId));
      const snap = await getDocs(fallbackQuery);
      if (snap.empty) return 0;

      let count = 0;
      snap.forEach(doc => {
        const data = doc.data();
        const ts = data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : null);
        if (!ts || ts >= startOfMonth) {
          count++;
        }
      });
      return count;
    } catch (err) {
      console.warn("[TransitService] Error fetching student trips:", err);
      return 0;
    }
  }
}
