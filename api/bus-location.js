// api/bus-location.js
import crypto from 'crypto';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitBuckets = new Map();

function getClientKey(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
            .split(',')[0]
            .trim();
    const busId = req.query?.busId || 'unknown';
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

// Helper to decrypt MapmyIndia credentials
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

// Utility to parse Firestore document fields into simple object
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

// Token verification via Firebase Auth REST API
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
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

    const limitCheck = applyRateLimit(req, res);
    if (!limitCheck.allowed) {
        return res.status(429).json({
            error: 'Too many requests. Please slow down and try again later.',
            retryAfterSeconds: limitCheck.retryAfter
        });
    }

    const { busId } = req.query;
    if (!busId) {
        return res.status(400).json({ error: "Missing parameter: busId" });
    }

    // Rely on process.env now instead of tenant configs
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;
    const databaseURL = process.env.VITE_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;

    if (!projectId || !firebaseApiKey) {
        return res.status(500).json({ error: "Server configuration missing Firebase keys" });
    }

    // Authenticate client
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

    const userEmail = authUser.email || (authUser.providerUserInfo && authUser.providerUserInfo[0] && authUser.providerUserInfo[0].email);
    if (!userEmail) {
        return res.status(403).json({ error: "Missing email in authentication token." });
    }

    // Verify user authorization in Firestore
    const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userEmail}`;
    const userRes = await fetch(userUrl, {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });
    
    if (!userRes.ok) {
        return res.status(403).json({ error: "Unauthorized: User profile not found." });
    }
    
    const userDoc = await userRes.json();
    const userFields = parseFirestoreFields(userDoc.fields);
    
    if (!userFields || !userFields.role) {
        return res.status(403).json({ error: "Unauthorized access: Invalid role or incomplete profile." });
    }

    try {
        // 1. Fetch Bus Tracker Details from Firestore REST API
        const busUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/buses/${busId}`;
        const busRes = await fetch(busUrl, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!busRes.ok) {
            return res.status(404).json({ error: `Bus ${busId} not found in database.` });
        }
        const busDoc = await busRes.json();
        const busFields = parseFirestoreFields(busDoc.fields);
        
        // Resolve trackerId (handles string field or nested tracking object)
        const trackerId = busFields.trackerId || (busFields.tracking && busFields.tracking.trackerId) || "";

        // 2. Fetch Cached Location from Realtime Database REST API
        const rtdbUrl = `${databaseURL}/live_locations/${busId}.json?auth=${idToken}`;
        let cachedLocation = null;
        try {
            const cacheRes = await fetch(rtdbUrl);
            if (cacheRes.ok) {
                cachedLocation = await cacheRes.json();
            }
        } catch (cacheErr) {
            console.error("Cache fetch failed:", cacheErr);
        }

        // Cache-First check (if location is under 10 seconds old)
        if (cachedLocation && cachedLocation.timestamp && (Date.now() - cachedLocation.timestamp < 10000)) {
            console.log(`📡 Cache HIT for ${busId}`);
            return res.status(200).json(cachedLocation);
        }

        console.log(`📡 Cache MISS for ${busId}. Accessing fresh telemetry...`);

        // If no tracker ID, we cannot fetch MapmyIndia data
        if (!trackerId) {
            // Fallback to whatever is cached, or return offline
            if (cachedLocation) {
                return res.status(200).json(cachedLocation);
            }
            return res.status(404).json({ error: "No tracker ID assigned to bus and no cached location available." });
        }

        // 3. Fetch MapmyIndia settings from Firestore
        const settingsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/tracking`;
        const settingsRes = await fetch(settingsUrl, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!settingsRes.ok) {
            throw new Error("MapmyIndia credentials not configured in GPS settings.");
        }
        const settingsDoc = await settingsRes.ok ? await settingsRes.json() : null;
        if (!settingsDoc || !settingsDoc.fields) {
            throw new Error("No settings record found.");
        }
        const settings = parseFirestoreFields(settingsDoc.fields);

        // 4. Decrypt credentials
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error("Server configuration missing ENCRYPTION_KEY environment variable");
        }
        const mmiApiKey = decrypt(settings.apiKeyEncrypted, encryptionKey);
        const mmiClientSecret = decrypt(settings.clientSecretEncrypted, encryptionKey);

        // 5. Query MapmyIndia APIs
        let locationData;
        try {
            if (mmiApiKey === 'demo_key' || mmiClientSecret === 'demo_secret' || !mmiApiKey || !mmiClientSecret) {
                throw new Error("Demo credentials active, running path simulation");
            }
            // Outpost Login Request
            const authRes = await fetch("https://outpost.mapmyindia.com/api/security/oauth/token", {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: mmiApiKey,
                    client_secret: mmiClientSecret
                })
            });
            if (!authRes.ok) {
                throw new Error("MapmyIndia OAuth token generation failed");
            }
            const authData = await authRes.json();
            const token = authData.access_token;

            // Telematics Data Request
            const liveRes = await fetch(`https://apis.mapmyindia.com/intouch/v1/${mmiApiKey}/getLiveData?deviceId=${trackerId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!liveRes.ok) {
                throw new Error("MapmyIndia location fetch failed");
            }
            const liveData = await liveRes.json();
            if (liveData && liveData.data && liveData.data.length > 0) {
                const deviceData = liveData.data[0];
                locationData = {
                    lat: parseFloat(deviceData.latitude),
                    lng: parseFloat(deviceData.longitude),
                    speed: parseFloat(deviceData.speed || 0),
                    heading: parseFloat(deviceData.heading || 0),
                    timestamp: Date.now(),
                    source: "mapmyindia"
                };
            } else {
                throw new Error("Device returned empty telemetry");
            }
        } catch (mapError) {
            console.warn("MapmyIndia telemetry unavailable:", mapError.message);
            if (cachedLocation) {
                return res.status(200).json(cachedLocation);
            }
            return res.status(503).json({
                error: "Live location unavailable",
                details: mapError.message
            });
        }

        // 6. Write latest location to Realtime Database cache
        try {
            await fetch(rtdbUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(locationData)
            });
        } catch (writeError) {
            console.error("RTDB cache write failed:", writeError);
        }

        return res.status(200).json(locationData);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
