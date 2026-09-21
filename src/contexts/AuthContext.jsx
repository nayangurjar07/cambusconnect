// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, onAuthStateChanged, db, doc, getDoc } from '../config/firebase';
import { loginUser, logoutUser, getCurrentSession } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(() => localStorage.getItem('userRole') || null);
  const [loading, setLoading] = useState(true);

  // Sync Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const email = user.email ? user.email.toLowerCase() : '';
        const savedRole = localStorage.getItem('userRole');

        try {
          const userDocRef = doc(db, 'users', email);
          let userDocSnap = await getDoc(userDocRef);
          let data = null;
          
          if (userDocSnap.exists()) {
            data = userDocSnap.data();
          } else {
            const studentDocRef = doc(db, 'students', email);
            const studentDocSnap = await getDoc(studentDocRef);
            if (studentDocSnap.exists()) {
              data = studentDocSnap.data();
            }
          }

          if (data) {
            const savedTenantId = localStorage.getItem('userTenantId') || localStorage.getItem('activeTenantKey') || 'iist';
            const canonicalTenantId = data.tenantId || savedTenantId;
            data.tenantId = canonicalTenantId;
            if (data.role === 'owner') {
              data.tenantAccess = data.tenantAccess || ['iist', 'medicaps'];
            }
            setProfile(data);
            const resolvedRole = data.role || savedRole || 'student';
            setRole(resolvedRole);
            localStorage.setItem('userRole', resolvedRole);
            localStorage.setItem('userTenantId', canonicalTenantId);
            if (resolvedRole === 'student') {
              localStorage.setItem('student', JSON.stringify({ id: email, email, ...data }));
            }
          } else {
            // Fallback for owner or special credentials
            if (savedRole === 'owner') {
              setRole('owner');
              setProfile({ 
                role: 'owner', 
                email, 
                name: localStorage.getItem('ownerName') || 'Platform Owner',
                tenantId: 'owner',
                tenantAccess: ['iist', 'medicaps']
              });
              localStorage.setItem('userTenantId', 'owner');
            }
          }
        } catch (e) {
          console.warn("Could not fetch user profile from Firestore:", e);
        }
      } else {
        // Clear state if logged out
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (!isLoggedIn) {
          setCurrentUser(null);
          setProfile(null);
          setRole(null);
        }
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
        if (data.role === 'student') {
          localStorage.setItem('student', JSON.stringify({ id: email, email, ...data }));
        }
      }
    } catch (e) {
      console.warn("Error refreshing profile:", e);
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      profile,
      role,
      tenantId: profile?.tenantId || localStorage.getItem('userTenantId') || null,
      isAuthenticated: Boolean(currentUser || localStorage.getItem('isLoggedIn') === 'true'),
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
