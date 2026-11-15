// api/bus-location.js
import crypto from 'crypto';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120; // Increased to support watcher polls + driver pushes
const rateLimitBuckets = new Map();

// ============================================================================
// IN-MEMORY SERVER CACHE & WATCHER REGISTRY (Saves 85%+ Firebase Reads/Writes)
// ============================================================================
// Keyed by busId -> { locationData, lastFirestoreSyncAt, lastRtdbSyncAt, watchers: Map<watcherKey, expiresAt> }
const busTelemetryMemoryCache = new Map();

const WATCHER_TTL_MS = 45 * 1000;          // A student/admin view counts as "active" for 45s per poll
const ACTIVE_SYNC_INTERVAL_MS = 25 * 1000; // Sync to Firebase every 25s when someone is watching
const IDLE_SYNC_INTERVAL_MS = 120 * 1000;  // Sync to Firebase every 2 mins when NO ONE is watching
const MIN_DISPLACEMENT_METERS = 120;       // Force sync if bus moved > 120m even in idle mode

function haversineMeters(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
    const R = 6371e3;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pruneAndCountWatchers(entry) {
    if (!entry || !entry.watchers) return 0;
    const now = Date.now();
    for (const [viewerId, exp] of entry.watchers.entries()) {
        if (now > exp) entry.watchers.delete(viewerId);
    }
    return entry.watchers.size;
}

function getClientKey(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
            .split(',')[0]
            .trim();
    const busId = req.query?.busId || req.body?.busId || 'unknown';
    return `${ip}:${(req.headers.host || 'unknown').toLowerCase()}:${busId}`;
}

function applyRateLimit(req, res) {
    const key = getClientKey(req);
    const now = Date.now();
    let bucket = rateLimitBuckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
        bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    }

    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);

    res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX_REQUESTS - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        return { allowed: false, retryAfter };
    }

    return { allowed: true };
}

function decrypt(text, key) {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const hashedKey = crypto.createHash('sha256').update(key).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', hashedKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

function parseFirestoreFields(fields) {
    if (!fields) return {};
    const obj = {};
    for (const key in fields) {
        const val = fields[key];
        if ('stringValue' in val) obj[key] = val.stringValue;
        else if ('integerValue' in val) obj[key] = parseInt(val.integerValue, 10);
        else if ('doubleValue' in val) obj[key] = parseFloat(val.doubleValue);
        else if ('booleanValue' in val) obj[key] = val.booleanValue;
        else if ('arrayValue' in val) {
            obj[key] = (val.arrayValue.values || []).map(v => v.stringValue || "");
        } else if ('mapValue' in val) {
            obj[key] = parseFirestoreFields(val.mapValue.fields);
        }
    }
    return obj;
}

async function verifyFirebaseToken(idToken, apiKey) {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
    });
    if (!response.ok) {
        throw new Error("Invalid token authentication");
    }
    const data = await response.json();
    return data.users && data.users[0];
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

    const limitCheck = applyRateLimit(req, res);
    if (!limitCheck.allowed) {
        return res.status(429).json({
            error: 'Too many requests. Please slow down and try again later.',
            retryAfterSeconds: limitCheck.retryAfter
        });
    }

    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;
    const databaseURL = process.env.VITE_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;

    if (!projectId || !firebaseApiKey) {
        return res.status(500).json({ error: "Server configuration missing Firebase keys" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing authorization token header" });
    }
    const idToken = authHeader.split('Bearer ')[1];

    let authUser;
    try {
        authUser = await verifyFirebaseToken(idToken, firebaseApiKey);
    } catch (authError) {
        return res.status(401).json({ error: "Authentication failed: " + authError.message });
    }

    const userEmail = (authUser.email || (authUser.providerUserInfo?.[0]?.email) || '').toLowerCase().trim();
    if (!userEmail) {
        return res.status(403).json({ error: "Missing email in authentication token." });
    }

    // ========================================================================
    // POST: DRIVER / CONDUCTOR LIVE GPS BROADCAST (Demand-Throttled Write)
    // ========================================================================
    if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const {
            busId,
            busNumber,
            lat,
            lng,
            speed = 0,
            heading = 0,
            accuracy = 10,
            role = 'driver',
            roleTier = 'primary',
            userName = 'Crew',
            streamSource = 'gps',
            action = 'broadcast' // 'broadcast' | 'stop'
        } = body;

        const targetKey = String(busId || busNumber || '').trim();
        if (!targetKey) {
            return res.status(400).json({ error: "Missing busId or busNumber" });
        }

        const now = Date.now();
        let entry = busTelemetryMemoryCache.get(targetKey) || {
            locationData: null,
            lastFirestoreSyncAt: 0,
            lastRtdbSyncAt: 0,
            watchers: new Map()
        };

        const activeWatchers = pruneAndCountWatchers(entry);

        // Handle explicit Stop Tracking
        if (action === 'stop') {
            entry.locationData = {
                ...(entry.locationData || {}),
                isTracking: false,
                speed: 0,
                timestamp: now,
                activeWatchers
            };
            busTelemetryMemoryCache.set(targetKey, entry);
            return res.status(200).json({
                success: true,
                stopped: true,
                activeWatchers
            });
        }

        if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
            return res.status(400).json({ error: "Invalid GPS coordinates" });
        }

        // Priority Hierarchy: Primary Driver (1) > Secondary Driver (2) > Primary Conductor (3) > Secondary Conductor (4)
        let userPriority = 4;
        if (role === 'driver') userPriority = roleTier === 'primary' ? 1 : 2;
        else if (role === 'conductor') userPriority = roleTier === 'primary' ? 3 : 4;

        const existingBroadcaster = entry.locationData?.activeBroadcaster;
        if (
            existingBroadcaster &&
            existingBroadcaster.email &&
            existingBroadcaster.email !== userEmail &&
            now - (existingBroadcaster.lastHeartbeat || 0) < 25000 &&
            userPriority > existingBroadcaster.priority
        ) {
            return res.status(200).json({
                success: false,
                isStandby: true,
                activeBroadcaster: existingBroadcaster,
                activeWatchers,
                recommendedIntervalMs: 30000,
                reason: `${existingBroadcaster.name || existingBroadcaster.email} has higher stream priority.`
            });
        }

        const prevLoc = entry.locationData;
        const movedMeters = prevLoc ? haversineMeters(prevLoc.lat, prevLoc.lng, Number(lat), Number(lng)) : Infinity;

        const locationPayload = {
            busId: targetKey,
            busNumber: busNumber || targetKey,
            lat: Number(lat),
            lng: Number(lng),
            speed: Math.max(0, Math.round(Number(speed) || 0)),
            heading: Number(heading) || 0,
            accuracy: Math.round(Number(accuracy) || 0),
            isTracking: true,
            timestamp: now,
            source: streamSource === 'simulation' ? 'simulation' : `${role}_phone`,
            activeWatchers,
            mode: activeWatchers > 0 ? 'HIGH_FREQ_WATCHED' : 'ECO_IDLE',
            activeBroadcaster: {
                email: userEmail,
                name: userName,
                role,
                roleTier,
                priority: userPriority,
                lastHeartbeat: now,
                streamSource
            }
        };

        // 1. Always update RAM cache immediately (0 cost)
        entry.locationData = locationPayload;

        // 2. Decide whether we need to persist to Firebase RTDB based on Watchers or Displacement
        const syncThresholdMs = activeWatchers > 0 ? ACTIVE_SYNC_INTERVAL_MS : IDLE_SYNC_INTERVAL_MS;
        const timeSinceLastSync = now - (entry.lastRtdbSyncAt || 0);
        const shouldPersistToFirebase =
            timeSinceLastSync >= syncThresholdMs ||
            movedMeters >= MIN_DISPLACEMENT_METERS ||
            !entry.lastRtdbSyncAt;

        let syncedToFirebase = false;
        if (shouldPersistToFirebase) {
            entry.lastRtdbSyncAt = now;
            const rtdbUrl = `${databaseURL}/live_locations/${encodeURIComponent(targetKey)}.json?auth=${idToken}`;
            try {
                await fetch(rtdbUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(locationPayload)
                });
                syncedToFirebase = true;
            } catch (err) {
                console.warn("RTDB throttled write warning:", err.message);
            }
        }

        busTelemetryMemoryCache.set(targetKey, entry);
        if (busNumber && String(busNumber).trim() !== targetKey) {
            busTelemetryMemoryCache.set(String(busNumber).trim(), entry);
        }

        // Tell the driver client how fast to send the next ping
        const recommendedIntervalMs = activeWatchers > 0 ? 15000 : 60000;

        return res.status(200).json({
            success: true,
            isStandby: false,
            syncedToFirebase,
            activeWatchers,
            mode: locationPayload.mode,
            recommendedIntervalMs,
            location: locationPayload
        });
    }

    // ========================================================================
    // GET: STUDENT / ADMIN READS LOCATION & REGISTERS AS ACTIVE WATCHER
    // ========================================================================
    const { busId, busNumber, watch = 'true' } = req.query;
    const lookupKey = String(busId || busNumber || '').trim();
    if (!lookupKey) {
        return res.status(400).json({ error: "Missing parameter: busId" });
    }

    const now = Date.now();
    let entry = busTelemetryMemoryCache.get(lookupKey);
    if (!entry) {
        entry = {
            locationData: null,
            lastFirestoreSyncAt: 0,
            lastRtdbSyncAt: 0,
            watchers: new Map()
        };
        busTelemetryMemoryCache.set(lookupKey, entry);
    }

    // Register this Student/Admin as an active watcher for 45 seconds
    if (watch !== 'false') {
        entry.watchers.set(userEmail, now + WATCHER_TTL_MS);
    }
    const activeWatchers = pruneAndCountWatchers(entry);

    // 1. Serve directly from Server RAM Cache if fresh (< 35 seconds old) -> 0 Firebase Reads!
    if (entry.locationData && entry.locationData.timestamp && (now - entry.locationData.timestamp < 35000)) {
        return res.status(200).json({
            ...entry.locationData,
            activeWatchers,
            cacheHit: 'MEMORY'
        });
    }

    // 2. Fallback to Firebase Realtime Database cache if Server RAM missed (e.g. cold start)
    try {
        const rtdbUrl = `${databaseURL}/live_locations/${encodeURIComponent(lookupKey)}.json?auth=${idToken}`;
        const cacheRes = await fetch(rtdbUrl);
        if (cacheRes.ok) {
            const rtdbLocation = await cacheRes.json();
            if (rtdbLocation && rtdbLocation.lat != null && rtdbLocation.lng != null) {
                entry.locationData = { ...rtdbLocation, activeWatchers };
                busTelemetryMemoryCache.set(lookupKey, entry);
                return res.status(200).json({
                    ...entry.locationData,
                    activeWatchers,
                    cacheHit: 'RTDB'
                });
            }
        }
    } catch (cacheErr) {
        console.warn("RTDB fallback fetch error:", cacheErr.message);
    }

    // 3. Optional Hardware MapmyIndia Fallback if bus has trackerId configured
    try {
        const busUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/buses/${lookupKey}`;
        const busRes = await fetch(busUrl, { headers: { 'Authorization': `Bearer ${idToken}` } });
        if (!busRes.ok) {
            return res.status(404).json({
                error: "Live location unavailable",
                isTracking: false,
                activeWatchers
            });
        }

        const busDoc = await busRes.json();
        const busFields = parseFirestoreFields(busDoc.fields);
        const trackerId = busFields.trackerId || (busFields.tracking && busFields.tracking.trackerId) || "";

        // If the Firestore bus document itself has recent coordinates, cache and return them
        if (busFields.location && busFields.location.lat != null && busFields.location.lng != null) {
            const docLoc = {
                busId: lookupKey,
                lat: Number(busFields.location.lat),
                lng: Number(busFields.location.lng),
                speed: Number(busFields.speed || 0),
                timestamp: Number(busFields.lastUpdated || now),
                isTracking: Boolean(busFields.isTracking),
                activeBroadcaster: busFields.activeBroadcaster || null,
                activeWatchers,
                source: busFields.locationSource || 'firestore_snapshot'
            };
            entry.locationData = docLoc;
            busTelemetryMemoryCache.set(lookupKey, entry);
            return res.status(200).json(docLoc);
        }

        if (!trackerId) {
            return res.status(404).json({
                error: "Live location for this bus has not started yet.",
                isTracking: false,
                activeWatchers
            });
        }

        const settingsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/tracking`;
        const settingsRes = await fetch(settingsUrl, { headers: { 'Authorization': `Bearer ${idToken}` } });
        if (!settingsRes.ok) throw new Error("MapmyIndia credentials not configured.");
        const settingsDoc = await settingsRes.json();
        const settings = parseFirestoreFields(settingsDoc.fields);

        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) throw new Error("Missing ENCRYPTION_KEY");
        const mmiApiKey = decrypt(settings.apiKeyEncrypted, encryptionKey);
        const mmiClientSecret = decrypt(settings.clientSecretEncrypted, encryptionKey);

        const authRes = await fetch("https://outpost.mapmyindia.com/api/security/oauth/token", {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: mmiApiKey,
                client_secret: mmiClientSecret
            })
        });
        if (!authRes.ok) throw new Error("MapmyIndia OAuth failed");
        const { access_token } = await authRes.json();

        const liveRes = await fetch(`https://apis.mapmyindia.com/intouch/v1/${mmiApiKey}/getLiveData?deviceId=${trackerId}`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        if (!liveRes.ok) throw new Error("MapmyIndia live fetch failed");
        const liveData = await liveRes.json();
        const deviceData = liveData?.data?.[0];
        if (!deviceData) throw new Error("Empty hardware telemetry");

        const hwLocation = {
            busId: lookupKey,
            lat: parseFloat(deviceData.latitude),
            lng: parseFloat(deviceData.longitude),
            speed: parseFloat(deviceData.speed || 0),
            heading: parseFloat(deviceData.heading || 0),
            isTracking: true,
            timestamp: now,
            activeWatchers,
            source: "mapmyindia"
        };

        entry.locationData = hwLocation;
        busTelemetryMemoryCache.set(lookupKey, entry);
        return res.status(200).json(hwLocation);
    } catch (error) {
        return res.status(404).json({
            error: "Live location unavailable",
            details: error.message,
            isTracking: false,
            activeWatchers
        });
    }
}
