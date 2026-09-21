// api/maps-config.js
// Backend API endpoint for securely serving and configuring Google Maps

let runtimeKeyOverride = null;

const DEFAULT_SERVER_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyD3wNXys4eqg27fxQr-BpzOuALppTDbjPs";

export default async function handler(req, res) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === 'GET') {
    const key = runtimeKeyOverride || process.env.GOOGLE_MAPS_API_KEY || DEFAULT_SERVER_MAPS_KEY;
    
    return res.status(200).json({
      success: true,
      apiKey: key,
      provider: 'google_maps',
      libraries: ['geometry'],
      status: 'active',
      source: runtimeKeyOverride ? 'runtime_override' : (process.env.GOOGLE_MAPS_API_KEY ? 'server_env' : 'server_default')
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const newKey = body.apiKey;

    if (newKey && typeof newKey === 'string' && newKey.trim().length > 0) {
      runtimeKeyOverride = newKey.trim();
      return res.status(200).json({
        success: true,
        message: 'Google Maps API key updated in backend logic successfully',
        source: 'runtime_override'
      });
    } else if (newKey === '') {
      runtimeKeyOverride = null;
      return res.status(200).json({
        success: true,
        message: 'Google Maps API key reset to backend default successfully',
        source: 'server_default'
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
