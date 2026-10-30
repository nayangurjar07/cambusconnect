// src/services/auth.js
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  firebaseSignOut, 
  doc, 
  getDoc,
  setDoc,
  serverTimestamp 
} from '../config/firebase';

export async function loginUser(rawEmailOrId, password, expectedRole = null) {
  let email = rawEmailOrId.trim();

  // Smart email detection if only username provided
  if (!email.includes('@')) {
    email = `${email.toLowerCase()}@indoreinstitute.com`;
  } else {
    email = email.toLowerCase();
  }

  // Perform Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Retrieve user document from Firestore
  const userDocRef = doc(db, 'users', email);
  let userDocSnap = await getDoc(userDocRef);

  let userData = null;
  if (userDocSnap.exists()) {
    userData = userDocSnap.data();
  } else {
    // Fallback: check students collection
    const studentDocRef = doc(db, 'students', email);
    const studentDocSnap = await getDoc(studentDocRef);
    
    if (studentDocSnap.exists()) {
      userData = studentDocSnap.data();
      // Self-healing auto-mirror to users collection for cross-system compatibility
      try {
        await setDoc(userDocRef, {
          ...userData,
          email,
          role: 'student',
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (syncErr) {
        console.warn("[Auth] Non-blocking user doc sync notice:", syncErr);
      }
    } else {
      // Security Enforcement: Do NOT fabricate synthetic owner roles.
      // Every user account (including owner/superadmin) must have a verified profile in Firestore.
      throw new Error("Profile record not found in system database. Please contact campus transport coordinator.");
    }
  }

  // Normalize role
  const resolvedRole = (userData.role || expectedRole || 'student').toLowerCase();
  userData.role = resolvedRole;
  userData.email = email;

  // Validate role if expectedRole specified
  if (expectedRole && resolvedRole !== expectedRole.toLowerCase()) {
    throw new Error(`Role mismatch: Account is registered as "${resolvedRole}", but attempting to access ${expectedRole} portal.`);
  }

  // Check pass validity if student
  if (resolvedRole === 'student' && userData.passValidity) {
    const expiry = new Date(userData.passValidity);
    if (!isNaN(expiry.getTime()) && expiry < new Date()) {
      throw new Error(`Your bus pass expired on ${expiry.toLocaleDateString()}. Please contact transport administration to renew.`);
    }
  }

  // Canonical tenantId assignment
  const canonicalTenantId = 'default';
  userData.tenantId = canonicalTenantId;

  // Store active session in localStorage
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('userEmail', email);
  localStorage.setItem('userRole', resolvedRole);
  localStorage.setItem('userTenantId', canonicalTenantId);
  localStorage.setItem('activeTenantKey', canonicalTenantId);
  localStorage.setItem('instituteId', email.split('@')[1] || 'indoreinstitute.com');
  
  if (resolvedRole === 'student') {
    localStorage.setItem('student', JSON.stringify({ id: email, email, ...userData }));
  } else if (resolvedRole === 'admin') {
    localStorage.setItem('adminName', userData.name || 'Campus Administrator');
  } else if (resolvedRole === 'owner') {
    localStorage.setItem('ownerName', userData.name || 'Platform Owner');
  }

  return {
    user,
    profile: userData
  };
}

export async function logoutUser() {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.warn("Sign out error:", err);
  }
  // Clear all persistent session tokens and cached identity metadata
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userTenantId');
  localStorage.removeItem('activeTenantKey');
  localStorage.removeItem('student');
  localStorage.removeItem('adminName');
  localStorage.removeItem('ownerName');
}

export function getCurrentSession() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const email = localStorage.getItem('userEmail');
  const role = localStorage.getItem('userRole');
  const student = localStorage.getItem('student') ? JSON.parse(localStorage.getItem('student')) : null;

  return {
    isLoggedIn,
    email,
    role,
    student,
    tenantKey: localStorage.getItem('activeTenantKey') || 'default'
  };
}
