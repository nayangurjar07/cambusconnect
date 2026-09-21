// src/config/firebase.js
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  startAfter,
  startAt,
  getCountFromServer,
  enableIndexedDbPersistence,
  runTransaction
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

export let app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export let auth = getAuth(app);
export let db = getFirestore(app);

// Enable offline persistence to drastically reduce database reads
// and provide offline capabilities for dashboards and driver apps.
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence');
    }
  });
}

// Dummy shims for tenant methods to prevent UI crashes in components that imported them
export function getActiveTenant() {
  return { id: 'default', firebaseConfig };
}

export async function switchTenant(tenantKey) {
  console.warn("Tenant switching is disabled; using default firebase config.");
}

/**
 * Creates a user in Firebase Auth using a secondary app instance.
 * This prevents the current Admin from being signed out when a new user is created.
 */
export async function createSecondaryAuthUser(email, password) {
  // Initialize a temporary secondary app
  const secondaryAppName = `SecondaryApp_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return userCredential.user;
  } finally {
    // Always clean up the temporary app to avoid memory leaks
    await deleteApp(secondaryApp);
  }
}

// Expose globals for compat
if (typeof window !== 'undefined') {
  window.auth = auth;
  window.db = db;
}

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  startAfter,
  startAt,
  getCountFromServer,
  enableIndexedDbPersistence,
  runTransaction
};
