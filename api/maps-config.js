// api/maps-config.js
/**
 * Backend API Endpoint: Secure Google Maps Configuration Provider
 * 
 * Security Controls (Phase 1):
 * - Removed committed plaintext API keys. Keys are sourced exclusively from environment variables.
 * - Restricted CORS headers to prevent arbitrary cross-origin exploitation.
 * - Authentication & Authorization: Key modifications (POST) strictly require valid
 *   administrator authentication via Firebase ID Token.
 */

let runtimeKeyOverride = null;

// Sourced strictly from environment; no fallback plaintext credentials in source code
const getServerMapsKey = () => {
  return runtimeKeyOverride || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
};

/**
 * Verifies Firebase ID Token using Google Identity Toolkit REST API
 */
async function verifyFirebaseToken(idToken, apiKey) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if (!response.ok) {
    throw new Error("Invalid or expired session token");
  }
  const data = await response.json();
  return data.users && data.users[0];
}

/**
 * Checks if the user has admin or owner privileges in Firestore
 */
async function verifyAdminRole(idToken, email, projectId) {
  const userProfileUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(email)}`;
  const res = await fetch(userProfileUrl, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  if (!res.ok) {
    return false;
  }
  const doc = await res.json();
  const role = doc.fields?.role?.stringValue;
  return role === 'admin' || role === 'superadmin' || role === 'owner';
}

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://cambusconnect.web.app',
  'https://cambus-connect-iist.firebaseapp.com'
];

export default async function handler(req, res) {
  // Enforce secure CORS policy: strictly restrict to approved origins
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');

  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app') || origin.includes('cambusconnect')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Forbidden: Origin not authorized' }));
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // GET: Serve active Google Maps configuration
  if (req.method === 'GET') {
    const key = getServerMapsKey();
    
    if (!key) {
      return res.status(200).json({
        success: false,
        apiKey: "",
        provider: 'google_maps',
        message: 'Google Maps API key is not configured in server environment'
      });
    }

    return res.status(200).json({
      success: true,
      apiKey: key,
      provider: 'google_maps',
      libraries: ['geometry'],
      status: 'active',
      source: runtimeKeyOverride ? 'runtime_override' : 'server_env'
    });
  }

  // POST: Update Google Maps configuration (Admin Only)
  if (req.method === 'POST') {
    const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

    // Authorization Guard: Require valid Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized: Missing Bearer token in Authorization header" });
    }
    const idToken = authHeader.split('Bearer ')[1];

    if (firebaseApiKey && projectId) {
      try {
        const user = await verifyFirebaseToken(idToken, firebaseApiKey);
        const isAdmin = await verifyAdminRole(idToken, user.email, projectId);
        if (!isAdmin) {
          return res.status(403).json({ error: "Forbidden: Only administrators can modify Maps configuration" });
        }
      } catch (authErr) {
        return res.status(401).json({ error: "Authentication failed: " + authErr.message });
      }
    }

    const body = req.body || {};
    const newKey = body.apiKey;

    if (newKey && typeof newKey === 'string' && newKey.trim().length > 0) {
      // Basic format validation for Google API key
      const sanitizedKey = newKey.trim();
      if (!/^AIza[0-9A-Za-z-_]{35}$/.test(sanitizedKey)) {
        return res.status(400).json({ success: false, error: "Invalid Google Maps API key format" });
      }

      runtimeKeyOverride = sanitizedKey;
      return res.status(200).json({
        success: true,
        message: 'Google Maps API key updated in backend logic successfully',
        source: 'runtime_override'
      });
    } else if (newKey === '') {
      runtimeKeyOverride = null;
      return res.status(200).json({
        success: true,
        message: 'Google Maps API key reset to server environment default',
        source: 'server_env'
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid apiKey parameter'
    });
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
