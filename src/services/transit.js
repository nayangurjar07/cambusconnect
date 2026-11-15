// src/services/transit.js
import { 
  auth,
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
// CLIENT-SIDE THROTTLE STATE FOR FIREBASE WRITES
// ==========================================
const driverFirestoreSyncState = new Map(); // busId -> { lastSyncAt, lat, lng, activeWatchers, recommendedIntervalMs }

function calculateDisplacementMeters(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity;
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
const BUS_CACHE_TTL_MS = 60 * 1000;

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
    if (currentBusId && bus.id === currentBusId) continue;

    if (data.number && bus.number && data.number.trim().toLowerCase() === bus.number.trim().toLowerCase()) {
      throw new Error(`A bus with the number "${data.number}" already exists.`);
    }

    if (data.registrationNumber && bus.registrationNumber && data.registrationNumber.trim().toLowerCase() === bus.registrationNumber.trim().toLowerCase()) {
      throw new Error(`A bus with registration "${data.registrationNumber}" already exists.`);
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
    primaryDriver: data.primaryDriver || null,
    secondaryDriver: data.secondaryDriver || null,
    conductor: data.conductor || '',
    conductorPhone: data.conductorPhone || '',
    primaryConductor: data.primaryConductor || null,
    secondaryConductor: data.secondaryConductor || null,
    status: data.status || 'On Time',
    headcount: Math.min(Number(data.capacity) || 45, Math.max(0, Number(data.headcount) || 0)),
    tracking: {
      sourceType: data.sourceType || 'driver_phone',
      trackerId: data.trackerId || '',
      isOnline: false
    },
    isTracking: false,
    location: data.location || null,
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
  busCache.delete(busId);
}

export async function updateBusStatus(busId, status) {
  const busRef = doc(db, 'buses', busId);
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  await updateDoc(busRef, {
    status,
    lastUpdate: nowTime,
    updatedAt: serverTimestamp()
  });
  busCache.delete(busId);
}

export async function updateBusHeadcount(busId, newHeadcount, maxCapacity = null) {
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
 * pollCachedBusLocation
 * Used by Student & Admin portals to fetch live location from the backend RAM cache
 * AND register the viewer as an `activeWatcher` so the driver's phone switches to 15-25s high-frequency mode.
 */
export async function pollCachedBusLocation(busId, watch = true) {
  if (!busId) return null;
  try {
    const currentUser = auth?.currentUser;
    if (!currentUser) return null;
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/bus-location?busId=${encodeURIComponent(busId)}&watch=${watch ? 'true' : 'false'}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/**
 * updateBusLiveLocation
 * Demand-aware GPS broadcaster for Driver & Conductor portals.
 * 1. Pushes live coordinates to `/api/bus-location` (RAM cache) so watching students/admins get <15s updates with 0 Firestore reads.
 * 2. Throttles direct Firestore `buses/{busId}` writes based on whether anyone is watching:
 *    - Active Watchers > 0: Syncs Firestore every 25 seconds.
 *    - Active Watchers == 0 (Eco Mode): Syncs Firestore only every 120 seconds OR if displacement > 120 meters.
 */
export async function updateBusLiveLocation({
  busId,
  busNumber = '',
  lat,
  lng,
  speed = 0,
  heading = 0,
  accuracy = 10,
  user = null,
  streamSource = 'gps', // 'gps' | 'simulation'
  forceFirestoreSync = false,
  onStandby = null
}) {
  if (!busId || lat == null || lng == null) return { success: false, reason: 'Invalid parameters' };

  const busRef = doc(db, 'buses', busId);
  const userEmail = user?.email?.toLowerCase().trim() || 'anonymous';
  const role = user?.role || 'driver';
  const roleTier = user?.roleTier || 'primary';

  let userPriority = 4;
  if (role === 'driver') {
    userPriority = roleTier === 'primary' ? 1 : 2;
  } else if (role === 'conductor') {
    userPriority = roleTier === 'primary' ? 3 : 4;
  }

  const now = Date.now();
  const prevState = driverFirestoreSyncState.get(busId) || {
    lastSyncAt: 0,
    lat: null,
    lng: null,
    activeWatchers: 0,
    recommendedIntervalMs: 25000
  };

  let activeWatchers = prevState.activeWatchers || 0;
  let recommendedIntervalMs = 25000;

  // Step 1: Push to Backend In-Memory Cache API (Zero Firestore Read/Write cost)
  try {
    const currentUser = auth?.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      const apiRes = await fetch('/api/bus-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          busId,
          busNumber: busNumber || busId,
          lat: Number(lat),
          lng: Number(lng),
          speed: Number(speed) || 0,
          heading: Number(heading) || 0,
          accuracy: Number(accuracy) || 10,
          role,
          roleTier,
          userName: user?.name || (role === 'conductor' ? 'Conductor' : 'Driver'),
          streamSource,
          action: 'broadcast'
        })
      });

      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.isStandby) {
          if (onStandby) {
            onStandby({
              isStandby: true,
              activeBroadcaster: apiData.activeBroadcaster
            });
          }
          return {
            success: false,
            isStandby: true,
            activeBroadcaster: apiData.activeBroadcaster,
            reason: apiData.reason
          };
        }
        activeWatchers = Number(apiData.activeWatchers) || 0;
        recommendedIntervalMs = Number(apiData.recommendedIntervalMs) || (activeWatchers > 0 ? 15000 : 60000);
      }
    }
  } catch (apiErr) {
    // Graceful fallback if local dev server doesn't mount /api routes
  }

  // Step 2: Decide if we need to write to Firestore `buses/{busId}`
  const movedMeters = calculateDisplacementMeters(prevState.lat, prevState.lng, Number(lat), Number(lng));
  const timeSinceLastFirestoreWrite = now - (prevState.lastSyncAt || 0);

  // If students/admin are watching -> write every 25s.
  // If nobody is watching -> write only every 90s (to keep Admin online status green) OR if bus moved > 120m.
  const firestoreIntervalMs = activeWatchers > 0 ? 25000 : 90000;
  const shouldWriteFirestore =
    forceFirestoreSync ||
    !prevState.lastSyncAt ||
    timeSinceLastFirestoreWrite >= firestoreIntervalMs ||
    movedMeters >= 120;

  if (!shouldWriteFirestore) {
    driverFirestoreSyncState.set(busId, {
      ...prevState,
      activeWatchers,
      recommendedIntervalMs
    });
    return {
      success: true,
      isStandby: false,
      cachedOnly: true,
      activeWatchers,
      mode: activeWatchers > 0 ? 'HIGH_FREQ_WATCHED' : 'ECO_IDLE',
      recommendedIntervalMs
    };
  }

  // Step 3: Verify Single Active Stream Guard on Firestore only when syncing
  const busSnap = await getDoc(busRef);
  if (!busSnap.exists()) return { success: false, reason: 'Bus record not found' };

  const busData = busSnap.data();
  const currentBroadcaster = busData.activeBroadcaster;

  if (currentBroadcaster && currentBroadcaster.email && currentBroadcaster.email !== userEmail) {
    const isFresh = currentBroadcaster.lastHeartbeat && (now - currentBroadcaster.lastHeartbeat) < 35000;
    if (isFresh && userPriority > currentBroadcaster.priority) {
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
  }

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const updatePayload = {
    isTracking: true,
    'location.lat': Number(lat),
    'location.lng': Number(lng),
    speed: Math.max(0, Math.round(Number(speed) || 0)),
    heading: Number(heading) || 0,
    accuracy: Math.round(Number(accuracy) || 10),
    locationSource: streamSource === 'simulation' ? 'simulation' : (role === 'conductor' ? 'conductor_phone' : 'driver_phone'),
    lastUpdate: nowTime,
    lastUpdated: now,
    activeWatchers,
    trackingMode: activeWatchers > 0 ? 'HIGH_FREQ_WATCHED' : 'ECO_IDLE',
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

  driverFirestoreSyncState.set(busId, {
    lastSyncAt: now,
    lat: Number(lat),
    lng: Number(lng),
    activeWatchers,
    recommendedIntervalMs
  });

  return {
    success: true,
    isStandby: false,
    cachedOnly: false,
    activeWatchers,
    mode: activeWatchers > 0 ? 'HIGH_FREQ_WATCHED' : 'ECO_IDLE',
    recommendedIntervalMs
  };
}

/**
 * releaseBusLiveStream
 * Cleans up activeBroadcaster in both Backend Cache and Firestore.
 */
export async function releaseBusLiveStream(busId, userEmail) {
  if (!busId) return;
  driverFirestoreSyncState.delete(busId);
  try {
    const currentUser = auth?.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      fetch('/api/bus-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ busId, action: 'stop' })
      }).catch(() => {});
    }

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
          trackingMode: 'OFFLINE',
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
 * Evaluates live location health. Supports Eco Mode (120s heartbeat) without falsely marking active buses offline.
 */
export function getBusTrackingHealth(bus, staleThresholdSeconds = 110) {
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
  }

  const now = Date.now();
  const diffSec = lastTimestampMs > 0 ? Math.max(0, Math.floor((now - lastTimestampMs) / 1000)) : Infinity;

  let lastSeenText = 'Never started';
  if (lastTimestampMs > 0 && !isNaN(lastTimestampMs)) {
    if (diffSec < 5) lastSeenText = 'Just now';
    else if (diffSec < 60) lastSeenText = `${diffSec}s ago`;
    else if (diffSec < 3600) lastSeenText = `${Math.floor(diffSec / 60)}m ago`;
    else lastSeenText = `${Math.floor(diffSec / 3600)}h ago`;
  } else if (bus.lastUpdate) {
    lastSeenText = String(bus.lastUpdate);
  }

  const broadcaster = bus.activeBroadcaster;
  const broadcasterLabel = broadcaster 
    ? `${broadcaster.roleTier === 'secondary' ? 'Secondary' : 'Primary'} ${broadcaster.role === 'conductor' ? 'Conductor' : 'Driver'}${broadcaster.name ? ` (${broadcaster.name})` : ''}`
    : (bus.driver ? `Driver: ${bus.driver}` : 'Unassigned Crew');

  const isExplicitlyTracking = bus.isTracking === true || Boolean(broadcaster);

  if (diffSec <= staleThresholdSeconds && bus.isTracking !== false) {
    const isEco = bus.trackingMode === 'ECO_IDLE' && (bus.activeWatchers || 0) === 0;
    return {
      isLive: true,
      status: 'LIVE',
      badgeColor: 'emerald',
      label: isEco ? 'Live · Eco' : 'Live',
      detail: `Broadcasting (${lastSeenText})`,
      diffSeconds: diffSec,
      lastSeenText,
      broadcasterLabel,
      broadcaster
    };
  }

  if (diffSec <= staleThresholdSeconds * 2.5 && isExplicitlyTracking) {
    return {
      isLive: false,
      status: 'STALE',
      badgeColor: 'amber',
      label: 'Signal Stale',
      detail: `Heartbeat delayed (${lastSeenText})`,
      diffSeconds: diffSec,
      lastSeenText,
      broadcasterLabel,
      broadcaster
    };
  }

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

export function getBusesTrackingSummary(buses = [], staleThresholdSeconds = 110) {
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
  busCache.delete(busId);
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
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  try {
    const q = query(
      col, 
      where('studentId', '==', studentId),
      where('timestamp', '>=', startOfMonth)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (indexOrNetworkErr) {
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
