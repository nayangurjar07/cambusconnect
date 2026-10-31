// firebase-config.js
// Safe runtime configuration reader with secondary auth instance helper for Admin panel
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (window.__CAMBUS_CONFIG__ || {});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || window.FIREBASE_API_KEY || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "cambus-connect-iist.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "cambus-connect-iist",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "cambus-connect-iist.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "289800550418",
  appId: env.VITE_FIREBASE_APP_ID || "1:289800550418:web:9100cd54ecd14a19d2c0cb",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-XV5LJDB6YH"
};

window.CAMBUS_CONFIG = {
  defaultDomain: env.VITE_DEFAULT_TENANT_DOMAIN || "indoreinstitute.com",
  supportPhone: env.VITE_SUPPORT_PHONE || "+91 731 401 0000",
  supportEmail: env.VITE_SUPPORT_EMAIL || "transport@indoreinstitute.com"
};

window.escapeHtml = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

try {
  if (typeof firebase !== 'undefined') {
    const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
    window.auth = firebase.auth(app);
    window.db = firebase.firestore(app);
    if (typeof firebase.analytics === 'function') {
      window.analytics = firebase.analytics(app);
    }

    // Secondary app instance for Admin user creation without overriding Admin auth state
    window.getSecondaryAuth = function() {
      const existing = firebase.apps.find(a => a.name === 'SecondaryAdminAuth');
      const secApp = existing || firebase.initializeApp(firebaseConfig, 'SecondaryAdminAuth');
      return firebase.auth(secApp);
    };

    window.db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      console.warn("Firestore persistence note:", err.code);
    });
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}
