// api/save-settings.js
import crypto from 'crypto';
import { tenantConfigs } from "../tenant-config.js";

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

// Helper to resolve active tenant configs based on host header
function resolveTenant(req) {
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || "";
    const host = hostHeader.toLowerCase().split(':')[0];
    if (tenantConfigs[host]) {
        return { tenantKey: host, ...tenantConfigs[host] };
    }
    if (host.includes('127.0.0.1')) {
        return { tenantKey: '127.0.0.1', ...tenantConfigs['127.0.0.1'] };
    }
    return { tenantKey: 'localhost', ...tenantConfigs['localhost'] };
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
        return res.status(455).json({ error: `Method ${req.method} not allowed` });
    }

    const { apiKey, clientSecret } = req.body;
    if (!apiKey || !clientSecret) {
        return res.status(400).json({ error: "Missing parameters: apiKey or clientSecret" });
    }

    // Resolve tenant config
    let tenant;
    try {
        tenant = resolveTenant(req);
    } catch (err) {
        return res.status(500).json({ error: "Tenant resolution failed: " + err.message });
    }

    const { projectId, apiKey: firebaseApiKey } = tenant.firebaseConfig;

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

        if (userData.role !== 'admin') {
            return res.status(403).json({ error: "Access Denied: Requester must be an administrator" });
        }

        // Encrypt credentials
        const encryptionKey = process.env.ENCRYPTION_KEY || "cambusconnectsecretkey123456789012";
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
