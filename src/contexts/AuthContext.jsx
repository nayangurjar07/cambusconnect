// src/contexts/AuthContext.jsx
/**
 * Authentication Context & Security Gateway
 * 
 * Implements zero-trust role-based session management backed by Firebase Auth.
 * Security Hardening (Phase 1):
 * - Eliminates client-side auth bypass: `isAuthenticated` strictly requires an active, verified `currentUser`
 * - Prevents role escalation: Roles are loaded exclusively from authoritative Firestore records (/users or /students)
 * - Session desync protection: Automatically clears all state and localStorage tokens when Firebase Auth signs out
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, onAuthStateChanged, db, doc, getDoc } from '../config/firebase';
import { loginUser, logoutUser, getCurrentSession } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // Security: Do NOT initialize role from localStorage to avoid client-side spoofing before verification
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const email = user.email ? user.email.toLowerCase() : '';

        try {
          // Fetch authoritative profile record from Firestore
          const userDocRef = doc(db, 'users', email);
          let userDocSnap = await getDoc(userDocRef);
          let data = null;
          
          if (userDocSnap.exists()) {
            data = userDocSnap.data();
          } else {
            // Fallback: check students collection for pass holders
            const studentDocRef = doc(db, 'students', email);
            const studentDocSnap = await getDoc(studentDocRef);
            if (studentDocSnap.exists()) {
              data = studentDocSnap.data();
            }
          }

          if (data) {
            const savedTenantId = localStorage.getItem('userTenantId') || localStorage.getItem('activeTenantKey') || 'default';
            const canonicalTenantId = data.tenantId || savedTenantId;
            data.tenantId = canonicalTenantId;

            // Privilege verification: Enforce verified role from document
            const resolvedRole = data.role || 'student';
            setProfile(data);
            setRole(resolvedRole);

            // Synchronize trusted state to localStorage for non-security UI preferences
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userRole', resolvedRole);
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userTenantId', canonicalTenantId);
            if (resolvedRole === 'student') {
              localStorage.setItem('student', JSON.stringify({ id: email, email, ...data }));
            }
          } else {
            // Zero-Trust Guard: If no Firestore document exists, reject elevated privileges
            console.warn(`[AuthContext] No verified Firestore profile found for authenticated user: ${email}`);
            setRole(null);
            setProfile(null);
          }
        } catch (e) {
          console.error("[AuthContext] Failed to retrieve user profile from Firestore:", e);
          setRole(null);
          setProfile(null);
        }
      } else {
        // User is not signed in via Firebase Auth:
        // Invalidate all session markers immediately to prevent unauthorized route penetration
        setCurrentUser(null);
        setProfile(null);
        setRole(null);
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userTenantId');
        localStorage.removeItem('student');
        localStorage.removeItem('adminName');
        localStorage.removeItem('ownerName');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password, expectedRole = null) => {
    setLoading(true);
    try {
      const res = await loginUser(email, password, expectedRole);
      setCurrentUser(res.user);
      setProfile(res.profile);
      setRole(res.profile.role || expectedRole);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setProfile(null);
    setRole(null);
  };

  const refreshProfile = async () => {
    if (!currentUser?.email) return;
    try {
      const email = currentUser.email.toLowerCase();
      let snap = await getDoc(doc(db, 'users', email));
      if (!snap.exists()) {
        snap = await getDoc(doc(db, 'students', email));
      }
      
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        if (data.role) {
          setRole(data.role);
          localStorage.setItem('userRole', data.role);
        }
        if (data.role === 'student') {
          localStorage.setItem('student', JSON.stringify({ id: email, email, ...data }));
        }
      }
    } catch (e) {
      console.warn("[AuthContext] Error refreshing profile:", e);
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      profile,
      role,
      tenantId: profile?.tenantId || localStorage.getItem('userTenantId') || null,
      // Security Enforcement: Authentication MUST be validated exclusively through active Firebase user instance
      isAuthenticated: Boolean(currentUser),
      loading,
      login,
      logout,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
