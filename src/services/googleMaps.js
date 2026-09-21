// src/services/googleMaps.js
// Modular client service communicating with backend logic for Google Maps

let cachedKey = null;
let loadPromise = null;

/**
 * Fetches the Google Maps API key directly from backend logic (/api/maps-config)
 */
export async function fetchBackendMapsKey() {
  if (cachedKey) return cachedKey;

  try {
    const res = await fetch('/api/maps-config');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey) {
        cachedKey = data.apiKey;
        return cachedKey;
      }
    }
  } catch (err) {
    console.warn('[GoogleMaps] Backend key fetch failed:', err);
  }

  // Fallback to runtime/storage override if offline
  return localStorage.getItem('custom_maps_key') || null;
}

/**
 * Updates or resets the Google Maps API key on the backend
 */
export async function updateBackendMapsKey(newKey) {
  try {
    const res = await fetch('/api/maps-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: newKey })
    });

    if (res.ok) {
      cachedKey = newKey;
      if (newKey) {
        localStorage.setItem('custom_maps_key', newKey);
      } else {
        localStorage.removeItem('custom_maps_key');
      }
      return true;
    }
  } catch (err) {
    console.error('[GoogleMaps] Failed to save key in backend logic:', err);
  }
  return false;
}

/**
 * Ensures Google Maps JavaScript API is loaded via backend-supplied key.
 * Resolves with `window.google.maps`.
 */
export function loadGoogleMaps() {
  if (typeof window !== 'undefined' && window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise(async (resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window is not available'));
    }

    if (window.google && window.google.maps) {
      return resolve(window.google.maps);
    }

    // Retrieve key strictly from backend API endpoint
    const key = await fetchBackendMapsKey();

    if (!key) {
      return reject(new Error('Google Maps key not available from backend logic'));
    }

    // Setup global callback hook
    const existingCallback = window.initMap;
    window.initMap = function() {
      if (typeof existingCallback === 'function') {
        try { existingCallback(); } catch (e) { console.warn('Previous initMap error:', e); }
      }
      window.__googleMapsReady = true;
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      }
    };

    // Check if script tag is already in DOM
    let script = document.querySelector('script[data-gmaps="true"]');
    if (!script) {
      script = document.createElement('script');
      script.setAttribute('data-gmaps', 'true');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onerror = (err) => {
        console.error('Failed to load Google Maps SDK:', err);
        reject(err);
      };
      document.head.appendChild(script);
    } else {
      // Script already attached, poll or await
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval);
          resolve(window.google.maps);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        } else {
          reject(new Error('Timeout waiting for Google Maps SDK'));
        }
      }, 10000);
    }
  });

  return loadPromise;
}
