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

  const docRef = doc(db, 'users', email);
  await setDoc(docRef, {
    name: data.name,
    email,
    role: data.role || 'driver',
    phone: data.phone || '',
    assignedBus: data.assignedBus || '',
    licenseNumber: data.licenseNumber || '',
    status: data.status || 'Active',
    createdAt: serverTimestamp()
  });
  return email;
}

export async function updateStaffMember(email, data) {
  const docRef = doc(db, 'users', email.toLowerCase().trim());
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteStaffMember(email) {
  const docRef = doc(db, 'users', email.toLowerCase().trim());
  await deleteDoc(docRef);
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
