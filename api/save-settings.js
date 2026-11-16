// api/save-settings.js
import crypto from 'crypto';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitBuckets = new Map();

function getClientKey(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
            .split(',')[0]
            .trim();
    return `${ip}:${(req.headers.host || 'unknown').toLowerCase()}`;
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

    if (rateLimitBuckets.size > 1000) {
        for (const [k, b] of rateLimitBuckets.entries()) {
            if (now >= b.resetAt) rateLimitBuckets.delete(k);
        }
    }

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

// Helper to encrypt MapmyIndia credentials
function encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const hashedKey = crypto.createHash('sha256').update(key).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', hashedKey, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
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
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

    const limitCheck = applyRateLimit(req, res);
    if (!limitCheck.allowed) {
        return res.status(429).json({
            error: 'Too many requests. Please slow down and try again later.',
            retryAfterSeconds: limitCheck.retryAfter
        });
    }

    const { apiKey, clientSecret } = req.body;
    if (!apiKey || !clientSecret) {
        return res.status(400).json({ error: "Missing parameters: apiKey or clientSecret" });
    }

    // Rely on process.env now instead of tenant configs
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;

    if (!projectId || !firebaseApiKey) {
        return res.status(500).json({ error: "Server configuration missing Firebase keys" });
    }

    // Authenticate admin client
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing authorization token header" });
    }
    const idToken = authHeader.split('Bearer ')[1];

    let userEmail;
    try {
        const user = await verifyFirebaseToken(idToken, firebaseApiKey);
        userEmail = user.email;
    } catch (authError) {
        return res.status(401).json({ error: "Authentication failed: " + authError.message });
    }

    try {
        // Fetch User Profile from Firestore to check Role
        const userProfileUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userEmail}`;
        const userProfileRes = await fetch(userProfileUrl, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!userProfileRes.ok) {
            return res.status(403).json({ error: "Access Denied: User profile not found" });
        }
        const userDoc = await userProfileRes.json();
        const userData = parseFirestoreFields(userDoc.fields);

        if (userData.role !== 'admin' && userData.role !== 'superadmin' && userData.role !== 'owner') {
            return res.status(403).json({ error: "Access Denied: Requester must be an administrator or owner" });
        }

        // Encrypt credentials using dedicated environment key
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
            return res.status(500).json({ error: "Server configuration missing ENCRYPTION_KEY environment variable" });
        }
        const apiKeyEncrypted = encrypt(apiKey, encryptionKey);
        const clientSecretEncrypted = encrypt(clientSecret, encryptionKey);

        // Update Firestore document settings/tracking via REST PATCH
        const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/tracking`;
        const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                fields: {
                    provider: { stringValue: "mapmyindia" },
                    apiKeyEncrypted: { stringValue: apiKeyEncrypted },
                    clientSecretEncrypted: { stringValue: clientSecretEncrypted }
                }
            })
        });

        if (!patchRes.ok) {
            const errorData = await patchRes.json();
            throw new Error(errorData.error?.message || "Failed to update Firestore settings document");
        }

        return res.status(200).json({ success: true, message: "GPS credentials saved and encrypted successfully." });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
