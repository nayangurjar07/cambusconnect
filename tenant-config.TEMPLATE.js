// tenant-config.TEMPLATE.js
// ============================================================
// Copy this file to tenant-config.js and fill in YOUR values.
// tenant-config.js is git-ignored — never commit real API keys.
// ============================================================

export const tenantConfigs = {

    // -------------------------------------------------------
    // LOCAL DEVELOPMENT  (served at http://localhost:...)
    // -------------------------------------------------------
    "localhost": {
        firebaseConfig: {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_PROJECT.firebaseapp.com",
            projectId: "YOUR_PROJECT",
            storageBucket: "YOUR_PROJECT.firebasestorage.app",
            messagingSenderId: "YOUR_SENDER_ID",
            appId: "YOUR_APP_ID",
            measurementId: "G-XXXXXXXXXX",
            databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com"
        },
        branding: {
            name: "Your Institute Name",
            shortName: "SHORT",
            logoUrl: "https://via.placeholder.com/150",
            colors: {
                primary: "#003366",
                secondary: "#ffffff",
                background: "#f4f6f9",
                text: "#333333"
            }
        }
    },

    // -------------------------------------------------------
    // INSTITUTE 1  (e.g. iist.cambusconnect.in)
    // -------------------------------------------------------
    "iist.cambusconnect.in": {
        firebaseConfig: {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_PROJECT.firebaseapp.com",
            projectId: "YOUR_PROJECT",
            storageBucket: "YOUR_PROJECT.firebasestorage.app",
            messagingSenderId: "YOUR_SENDER_ID",
            appId: "YOUR_APP_ID",
            measurementId: "G-XXXXXXXXXX",
            databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com"
        },
        branding: {
            name: "Your Institute Name",
            shortName: "SHORT",
            logoUrl: "https://via.placeholder.com/150",
            colors: { primary: "#003366", secondary: "#ffffff", background: "#f4f6f9", text: "#333333" }
        }
    },

    // -------------------------------------------------------
    // INSTITUTE 2  (e.g. medicaps.cambusconnect.in)
    // -------------------------------------------------------
    "medicaps.cambusconnect.in": {
        firebaseConfig: {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_PROJECT.firebaseapp.com",
            projectId: "YOUR_PROJECT",
            storageBucket: "YOUR_PROJECT.firebasestorage.app",
            messagingSenderId: "YOUR_SENDER_ID",
            appId: "YOUR_APP_ID",
            measurementId: "G-XXXXXXXXXX",
            databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com"
        },
        branding: {
            name: "Your Institute Name",
            shortName: "SHORT",
            logoUrl: "https://via.placeholder.com/150",
            colors: { primary: "#800000", secondary: "#ffffff", background: "#fafafa", text: "#111111" }
        }
    },

    // -------------------------------------------------------
    // OWNER / SUPER ADMIN PORTAL
    // -------------------------------------------------------
    "owner": {
        firebaseConfig: {
            apiKey: "YOUR_OWNER_API_KEY",
            authDomain: "YOUR_OWNER_PROJECT.firebaseapp.com",
            projectId: "YOUR_OWNER_PROJECT",
            storageBucket: "YOUR_OWNER_PROJECT.firebasestorage.app",
            messagingSenderId: "YOUR_SENDER_ID",
            appId: "YOUR_APP_ID",
            measurementId: "G-XXXXXXXXXX",
            databaseURL: "https://YOUR_OWNER_PROJECT-default-rtdb.firebaseio.com"
        },
        branding: {
            name: "Cambus Connect Owner Portal",
            shortName: "Owner",
            logoUrl: "https://via.placeholder.com/150/4f46e5/ffffff?text=Owner",
            colors: {
                primary: "#4f46e5",
                secondary: "#ffffff",
                background: "#f8f9ff",
                text: "#0b1c30"
            }
        }
    }
};
