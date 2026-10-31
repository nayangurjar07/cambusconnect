// tenant-config.js
// Centralized multi-tenant configuration for Cambus Connect

export function getSubdomain() {
    const host = window.location.hostname.toLowerCase();
    const parts = host.split('.');
    
    if (host.includes('.cambusconnect.in')) {
        return parts[0];
    }
    if (host.includes('.localhost')) {
        return parts[0];
    }
    return 'default';
}

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof window !== 'undefined' && window.__CAMBUS_CONFIG__ ? window.__CAMBUS_CONFIG__ : {});

const defaultFirebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || (typeof window !== 'undefined' && window.FIREBASE_API_KEY) || "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "cambus-connect-iist.firebaseapp.com",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "cambus-connect-iist",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "cambus-connect-iist.firebasestorage.app",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "289800550418",
    appId: env.VITE_FIREBASE_APP_ID || "1:289800550418:web:9100cd54ecd14a19d2c0cb",
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-XV5LJDB6YH",
    databaseURL: env.VITE_FIREBASE_DATABASE_URL || "https://cambus-connect-iist-default-rtdb.asia-southeast1.firebasedatabase.app"
};

export const tenantConfigs = {
    "default": {
        firebaseConfig: defaultFirebaseConfig,
        emailDomains: ["indoreinstitute.com", "iist.in", "cambusconnect.in", "medicaps.com", "medicaps.ac.in"],
        branding: {
            name: "Indore Institute of Science and Technology",
            shortName: "IIST",
            logoUrl: "/favicon.svg",
            colors: {
                primary: "#2563eb",
                secondary: "#ffffff",
                background: "#f8fafc",
                text: "#0f172a"
            }
        }
    },
    "iist": {
        firebaseConfig: defaultFirebaseConfig,
        emailDomains: ["indoreinstitute.com", "iist.in", "iist.cambusconnect.in"],
        branding: {
            name: "Indore Institute of Science and Technology",
            shortName: "IIST",
            logoUrl: "/favicon.svg",
            colors: {
                primary: "#2563eb",
                secondary: "#ffffff",
                background: "#f8fafc",
                text: "#0f172a"
            }
        }
    },
    "medicaps": {
        firebaseConfig: defaultFirebaseConfig,
        emailDomains: ["medicaps.com", "medicaps.ac.in"],
        branding: {
            name: "Medi-Caps University",
            shortName: "Medi-Caps",
            logoUrl: "/favicon.svg",
            colors: {
                primary: "#800000",
                secondary: "#ffffff",
                background: "#f8fafc",
                text: "#0f172a"
            }
        }
    },
    "owner": {
        firebaseConfig: defaultFirebaseConfig,
        emailDomains: ["cambusconnect.in", "owner.cambusconnect.in"],
        branding: {
            name: "Cambus Connect Platform",
            shortName: "Cambus Connect",
            logoUrl: "/favicon.svg",
            colors: {
                primary: "#4f46e5",
                secondary: "#ffffff",
                background: "#f8f9ff",
                text: "#0b1c30"
            }
        }
    }
};

