// =============================================================================
// CAMBUS CONNECT — OFFLINE-FIRST SERVICE WORKER (sw.js)
// =============================================================================
// Caches core UI shells, CSS, fonts, and scripts so that student passes
// and essential portal interfaces open in <100ms even with 0 connectivity.
// =============================================================================

const CACHE_NAME = 'cambus-shell-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/portals/student/bus-pass/bus-pass.html',
    '/portals/student/bus-pass/bus-pass.js',
    '/portals/student/home/home.html',
    '/portals/student/home/home.js',
    '/portals/student/track/track.html',
    '/portals/student/track/track.js',
    '/portals/student/notifications/notifications.html',
    '/portals/student/notifications/notifications.js',
    '/portals/student/student-login.html',
    '/portals/student/student-login.js',
    '/style.css',
    '/tailwind.css',
    '/main.js',
    '/cache-manager.js',
    '/favicon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[SW] Cache addAll partial failure:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Bypass caching for Firestore, Google APIs, and auth requests
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('maps.googleapis.com') ||
        url.pathname.startsWith('/api/') ||
        req.method !== 'GET'
    ) {
        return;
    }

    event.respondWith(
        caches.match(req).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cache immediately; fetch in background to revalidate (SWR)
                fetch(req).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(req, networkResponse);
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(req).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && (url.origin === location.origin)) {
                    const cloned = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, cloned);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Offline fallback for HTML navigation
                if (req.mode === 'navigate') {
                    return caches.match('/portals/student/bus-pass/bus-pass.html');
                }
            });
        })
    );
});
