// =============================================================================
// DB-HELPER.JS - CAMBUS CONNECT Multi-Tenant Database Helper
// =============================================================================
// This helper redirects all database collections to the appropriate tenant subcollection
// based on the active instituteId from the session.
// =============================================================================

(function() {
    // Resolve active instituteId from localStorage or subdomain
    function getActiveInstituteId() {
        // 1. Check localStorage first (established login session)
        const savedId = localStorage.getItem('instituteId');
        if (savedId) return savedId;

        // 2. Check subdomain
        if (window.getSubdomain) {
            const sub = window.getSubdomain();
            if (sub && sub !== 'www' && sub !== 'vercel') {
                return sub;
            }
        }

        // Fallback or empty (handled by calling components or auth-guard)
        return null;
    }

    // Get the active root tenant document reference
    function getTenantDoc() {
        const instituteId = getActiveInstituteId();
        if (!instituteId) {
            console.error("❌ Multi-tenant Error: No active instituteId found in session!");
            // Redirect to login if not on public pages
            const path = window.location.pathname.toLowerCase();
            const isPublic = 
                path.includes('/portals/owner/index.html') || 
                path.includes('/owner/index.html') || 
                path.endsWith('/') || 
                path.endsWith('index.html') || 
                path.includes('login.html');
            if (!isPublic) {
                localStorage.clear();
                let prefix = '';
                if (path.includes('/portals/')) {
                    prefix = '../../';
                } else if (path.includes('/owner/') || path.includes('/admin/') || path.includes('/student/') || path.includes('/driver/')) {
                    prefix = '../';
                }
                window.location.href = prefix + 'portals/owner/index.html';
            }
            throw new Error("No active institute session. Please log in again.");
        }
        
        // Ensure firebase db is initialized
        if (typeof window.db === 'undefined') {
            throw new Error("Firebase Firestore is not initialized.");
        }

        return window.db.collection('institutes').doc(instituteId);
    }

    function getFirestoreDb() {
        if (window.db) return window.db;
        if (window.firebase && typeof window.firebase.firestore === 'function') {
            return window.firebase.firestore();
        }
        if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
            return firebase.firestore();
        }
        console.warn('⚠️ dbHelper called before Firestore was initialized. Ensure window.waitForFirebase() is awaited.');
        throw new Error('Firestore is not initialized yet. Please await window.waitForFirebase() before accessing database collections.');
    }

    // Export helper functions globally (Multi-Instance flat collections)
    window.dbHelper = {
        getInstituteId: getActiveInstituteId,

        getUsersCol: function() {
            return getFirestoreDb().collection('users');
        },

        getBusesCol: function() {
            return getFirestoreDb().collection('buses');
        },

        getNotificationsCol: function() {
            return getFirestoreDb().collection('notifications');
        },

        getLostItemsCol: function() {
            return getFirestoreDb().collection('lost-items');
        },

        getSupportQueriesCol: function() {
            return getFirestoreDb().collection('support-queries');
        },

        getTripsCol: function() {
            return getFirestoreDb().collection('trips');
        },

        getDriverSessionsCol: function() {
            return getFirestoreDb().collection('driverSessions');
        },

        getDailyBoardingsCol: function() {
            return getFirestoreDb().collection('daily_boardings');
        }
    };
})();

// =============================================================================
// SAFE FIREBASE & AUTH READINESS GUARD
// =============================================================================
// firebase-init.js is loaded as type="module" (ES module), which is always
// deferred and runs asynchronously. Furthermore, Firebase Auth restores the
// user session asynchronously from IndexedDB, so window.auth.currentUser is
// initially null for 200-500ms even if a user is logged in.
//
// waitForFirebaseAuth() ensures BOTH:
//   1. window.db and window.auth are mounted.
//   2. Firebase Auth has fired onAuthStateChanged at least once (session settled).
//
// The returned promise is cached so repeated calls across the page don't
// create redundant listeners.
// =============================================================================

function getFirebase() {
    return window.firebase || globalThis.firebase;
}
window.getFirebase = getFirebase;
globalThis.getFirebase = getFirebase;

var _authReadyPromise = null;

function waitForFirebaseAuth(timeoutMs) {
    if (timeoutMs === undefined) timeoutMs = 8000;
    if (_authReadyPromise) return _authReadyPromise;

    _authReadyPromise = new Promise(function(resolve, reject) {
        var start = Date.now();

        // 1. Wait until window.db and window.auth exist
        var checkDbInterval = setInterval(function() {
            var authInstance = window.auth || (window.firebase && window.firebase.auth && window.firebase.auth());
            var dbInstance = window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore());

            if (dbInstance && authInstance) {
                clearInterval(checkDbInterval);

                // 2. Attach one-time onAuthStateChanged listener to confirm auth state resolution
                var settled = false;
                var unsubscribe = null;

                var authTimer = setTimeout(function() {
                    if (!settled) {
                        settled = true;
                        if (typeof unsubscribe === 'function') {
                            try { unsubscribe(); } catch(e) {}
                        }
                        resolve(authInstance.currentUser || null);
                    }
                }, Math.max(1000, timeoutMs - (Date.now() - start)));

                try {
                    unsubscribe = authInstance.onAuthStateChanged(function(user) {
                        if (!settled) {
                            settled = true;
                            clearTimeout(authTimer);
                            if (typeof unsubscribe === 'function') {
                                try { unsubscribe(); } catch(e) {}
                            }
                            resolve(user || null);
                        }
                    }, function(authError) {
                        if (!settled) {
                            settled = true;
                            clearTimeout(authTimer);
                            if (typeof unsubscribe === 'function') {
                                try { unsubscribe(); } catch(e) {}
                            }
                            reject(authError);
                        }
                    });
                } catch (e) {
                    if (!settled) {
                        settled = true;
                        clearTimeout(authTimer);
                        resolve(authInstance.currentUser || null);
                    }
                }
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(checkDbInterval);
                reject(new Error(
                    'Firebase (window.db and window.auth) did not initialize within ' + timeoutMs + 'ms. ' +
                    'Check that firebase-init.js is loaded and tenant config is valid.'
                ));
            }
        }, 30);
    });

    return _authReadyPromise;
}

window.resetFirebaseAuthGuard = function() {
    _authReadyPromise = null;
};

window.waitForFirebaseAuth = waitForFirebaseAuth;
window.waitForFirebase = waitForFirebaseAuth; // Backward-compatibility alias


