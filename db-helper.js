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

        // 2. Check subdomain (e.g., medicaps.cambusconnect.in -> medicaps)
        const host = window.location.hostname;
        const parts = host.split('.');
        // If it's a subdomain (not localhost, and has 3 parts like subdomain.domain.com)
        if (parts.length >= 3 && !host.includes('localhost') && !parts[0].startsWith('127')) {
            const subdomain = parts[0].toLowerCase();
            if (subdomain !== 'www' && subdomain !== 'vercel') {
                return subdomain;
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

    // Export helper functions globally (Multi-Instance flat collections)
    window.dbHelper = {
        getInstituteId: getActiveInstituteId,

        getUsersCol: function() {
            return (window.db || firebase.firestore()).collection('users');
        },

        getBusesCol: function() {
            return (window.db || firebase.firestore()).collection('buses');
        },

        getNotificationsCol: function() {
            return (window.db || firebase.firestore()).collection('notifications');
        },

        getLostItemsCol: function() {
            return (window.db || firebase.firestore()).collection('lost-items');
        },

        getSupportQueriesCol: function() {
            return (window.db || firebase.firestore()).collection('support-queries');
        },

        getTripsCol: function() {
            return (window.db || firebase.firestore()).collection('trips');
        },

        getDriverSessionsCol: function() {
            return (window.db || firebase.firestore()).collection('driverSessions');
        }
    };
})();
