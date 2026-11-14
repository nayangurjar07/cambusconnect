// src/services/workforce.js
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  createSecondaryAuthUser
} from '../config/firebase';

// ==========================================
// STAFF & USERS
// ==========================================

export function subscribeToStaff(onUpdate, onError) {
  const usersCol = collection(db, 'users');
  // Firestore allows query where role in ['driver', 'conductor', 'staff']
  const q = query(usersCol, where('role', 'in', ['driver', 'conductor', 'staff', 'admin']));
  
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(list);
  }, (err) => {
    console.error("Error subscribing to staff:", err);
    if (onError) onError(err);
  });
}

export function getStaffRoleLabel(role, roleTier) {
  if (role === 'driver') {
    return roleTier === 'secondary' ? 'Secondary (Sub) Driver' : 'Primary Driver';
  }
  if (role === 'conductor') {
    return roleTier === 'secondary' ? 'Secondary (Sub) Conductor' : 'Primary Conductor';
  }
  if (role === 'staff') return 'Route Coordinator';
  if (role === 'admin') return 'System Admin';
  return role || 'Staff';
}

export function validateStaffRoleConflict(staffList, busNumber, role, roleTier, currentEmail = null) {
  if (!busNumber || !role || (role !== 'driver' && role !== 'conductor')) {
    return { hasConflict: false };
  }

  const cleanBus = String(busNumber).trim().toLowerCase();
  const cleanEmail = currentEmail ? String(currentEmail).trim().toLowerCase() : null;
  const targetTier = roleTier || 'primary';

  const conflictingMember = staffList.find(s => {
    if (cleanEmail && s.email && s.email.toLowerCase() === cleanEmail) return false;
    if (s.status === 'Terminated' || s.role === 'revoked') return false;
    const sBus = String(s.assignedBus || '').trim().toLowerCase();
    if (sBus !== cleanBus) return false;
    if (s.role !== role) return false;
    const sTier = s.roleTier || 'primary';
    return sTier === targetTier;
  });

  if (conflictingMember) {
    const roleTitle = role === 'driver' ? 'Driver' : 'Conductor';
    const tierTitle = targetTier === 'primary' ? 'Primary' : 'Secondary';
    return {
      hasConflict: true,
      conflictingMember,
      message: `Bus ${busNumber} already has an assigned ${tierTitle} ${roleTitle} (${conflictingMember.name || conflictingMember.email}).`
    };
  }

  return { hasConflict: false };
}

export async function syncStaffToBus(busNumber, staffData) {
  if (!busNumber) return;
  try {
    const busesCol = collection(db, 'buses');
    const q = query(busesCol, where('number', '==', String(busNumber).trim()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const busDoc = snap.docs[0];
      const busRef = doc(db, 'buses', busDoc.id);
      const busData = busDoc.data();
      const role = staffData.role;
      const tier = staffData.roleTier || 'primary';
      const staffObj = {
        name: staffData.name || '',
        email: staffData.email?.toLowerCase().trim() || '',
        phone: staffData.phone || ''
      };

      const busUpdate = {};
      if (role === 'driver') {
        if (tier === 'primary') {
          busUpdate.primaryDriver = staffObj;
          busUpdate.driver = staffObj.name;
          busUpdate.phone = staffObj.phone;
        } else {
          busUpdate.secondaryDriver = staffObj;
        }
        const existingEmails = Array.isArray(busData.driverEmails) ? [...busData.driverEmails] : [];
        if (staffObj.email && !existingEmails.includes(staffObj.email)) {
          existingEmails.push(staffObj.email);
        }
        busUpdate.driverEmails = existingEmails;
      } else if (role === 'conductor') {
        if (tier === 'primary') {
          busUpdate.primaryConductor = staffObj;
          busUpdate.conductor = staffObj.name;
          busUpdate.conductorPhone = staffObj.phone;
        } else {
          busUpdate.secondaryConductor = staffObj;
        }
        const existingEmails = Array.isArray(busData.conductorEmails) ? [...busData.conductorEmails] : [];
        if (staffObj.email && !existingEmails.includes(staffObj.email)) {
          existingEmails.push(staffObj.email);
        }
        busUpdate.conductorEmails = existingEmails;
      }

      if (Object.keys(busUpdate).length > 0) {
        await updateDoc(busRef, { ...busUpdate, updatedAt: serverTimestamp() });
      }
    }
  } catch (err) {
    console.warn("Could not sync staff to bus document:", err);
  }
}

export async function createStaffMember(data) {
  const email = data.email.toLowerCase().trim();

  if (data.password) {
    try {
      await createSecondaryAuthUser(email, data.password);
    } catch (e) {
      if (e.code !== 'auth/email-already-in-use') {
        throw new Error(`Failed to create login account: ${e.message}`);
      }
    }
  }

  const role = data.role || 'driver';
  const roleTier = (role === 'driver' || role === 'conductor') ? (data.roleTier || 'primary') : null;
  const staffRoleLabel = getStaffRoleLabel(role, roleTier);

  const docRef = doc(db, 'users', email);
  await setDoc(docRef, {
    name: data.name,
    email,
    role,
    roleTier,
    staffRoleLabel,
    phone: data.phone || '',
    assignedBus: data.assignedBus || '',
    assignedBusId: data.assignedBusId || '',
    licenseNumber: data.licenseNumber || '',
    status: data.status || 'Active',
    createdAt: serverTimestamp()
  });

  if (data.assignedBus) {
    await syncStaffToBus(data.assignedBus, {
      name: data.name,
      email,
      role,
      roleTier,
      phone: data.phone
    });
  }

  return email;
}

export async function updateStaffMember(email, data) {
  const cleanEmail = email.toLowerCase().trim();
  const docRef = doc(db, 'users', cleanEmail);

  const role = data.role || 'driver';
  const roleTier = (role === 'driver' || role === 'conductor') ? (data.roleTier || 'primary') : null;
  const staffRoleLabel = getStaffRoleLabel(role, roleTier);

  await updateDoc(docRef, {
    ...data,
    role,
    roleTier,
    staffRoleLabel,
    updatedAt: serverTimestamp()
  });

  if (data.assignedBus) {
    await syncStaffToBus(data.assignedBus, {
      name: data.name,
      email: cleanEmail,
      role,
      roleTier,
      phone: data.phone
    });
  }
}

export async function deleteStaffMember(email) {
  const cleanEmail = email.toLowerCase().trim();
  const docRef = doc(db, 'users', cleanEmail);
  // Soft-delete: Revoke all administrative and operational privileges
  // Prevents the account from accessing fleet data while preserving audit trails
  await updateDoc(docRef, {
    status: 'Terminated',
    role: 'revoked',
    terminatedAt: serverTimestamp()
  });
}

// ==========================================
// SHIFTS
// ==========================================

export function format24to12(time24) {
  if (!time24 || !time24.includes(':')) return time24 || '—';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr.slice(0, 2);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
}

export function format12to24(time12) {
  if (!time12) return '08:30';
  if (/^\d{2}:\d{2}$/.test(time12.trim())) return time12.trim();
  const match = time12.trim().match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return '08:30';
  let h = parseInt(match[1], 10);
  const m = match[2].padStart(2, '0');
  const ampm = (match[3] || 'AM').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m}`;
}

export const DEFAULT_SHIFTS = [];

export function subscribeToShiftConfig(onUpdate, onError) {
  const docRef = doc(db, 'settings', 'shiftConfig');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      let shifts = [];
      if (Array.isArray(data.shifts) && data.shifts.length > 0) {
        shifts = data.shifts;
      } else {
        // Fallback & Migrate legacy shift1Timing/shift2Timing
        const s1 = {
          id: 'shift_1',
          name: data.shift1Name || 'Shift 1',
          enabled: true,
          startTime: data.shift1Timing ? format12to24(data.shift1Timing.split('-')[0]) : '08:30',
          endTime: data.shift1Timing ? format12to24(data.shift1Timing.split('-')[1]) : '16:30',
          activeDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
        };
        const s2 = {
          id: 'shift_2',
          name: data.shift2Name || 'Shift 2',
          enabled: Boolean(data.enableShift2),
          startTime: data.shift2Timing ? format12to24(data.shift2Timing.split('-')[0]) : '12:00',
          endTime: data.shift2Timing ? format12to24(data.shift2Timing.split('-')[1]) : '17:30',
          activeDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
        };
        shifts = [s1, s2];
      }
      onUpdate(shifts, data);
    } else {
      onUpdate(DEFAULT_SHIFTS, {});
    }
  }, (err) => {
    console.warn("Shift configuration subscription error:", err);
    if (onError) onError(err);
  });
}

export async function saveShiftConfig(shifts) {
  const docRef = doc(db, 'settings', 'shiftConfig');
  
  // Also preserve backward compatibility fields for legacy readers
  const s1 = shifts[0] || DEFAULT_SHIFTS[0];
  const s2 = shifts[1] || DEFAULT_SHIFTS[1];

  const payload = {
    shifts,
    // Backward compatibility layer
    shift1Name: s1.name,
    shift1Timing: `${format24to12(s1.startTime)} - ${format24to12(s1.endTime)}`,
    shift2Name: s2.name,
    shift2Timing: `${format24to12(s2.startTime)} - ${format24to12(s2.endTime)}`,
    enableShift2: Boolean(s2.enabled),
    updatedAt: serverTimestamp()
  };

  await setDoc(docRef, payload, { merge: true });
}

export function subscribeToActiveRuns(onUpdate, onError) {
  const q = query(collection(db, 'driverSessions'), where('status', '==', 'Active'));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    onUpdate(list);
  }, (err) => {
    console.warn("Active runs subscription error:", err);
    if (onError) onError(err);
  });
}

export function subscribeToShiftHistory(onUpdate, onError, maxItems = 50) {
  const q = query(
    collection(db, 'driverSessions'), 
    where('status', '==', 'Stopped'), 
    orderBy('startTime', 'desc'), 
    limit(maxItems)
  );
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    onUpdate(list);
  }, (err) => {
    console.warn("Shift history subscription error:", err);
    if (onError) onError(err);
  });
}
