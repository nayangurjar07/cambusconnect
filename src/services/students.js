// src/services/students.js
import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  serverTimestamp,
  createSecondaryAuthUser,
  writeBatch,
  onSnapshot
} from '../config/firebase';
import { generateQrSecret } from '../utils/crypto';

// ==========================================
// STUDENT PROFILE MANAGEMENT
// ==========================================

// Simple TTL Caches to reduce database load
const profileCache = new Map();
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let totalCountCache = { key: '', count: 0, timestamp: 0 };
const COUNT_CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function getPaginatedStudents(pageSize = 25, lastVisible = null, routeFilter = 'ALL', statusFilter = 'ALL', searchQuery = '') {
  const studentsCol = collection(db, 'students');
  const conditions = [];

  // Basic filters
  if (routeFilter !== 'ALL') {
    conditions.push(where('busRoute', '==', routeFilter));
  }
  
  if (statusFilter !== 'ALL') {
    if (statusFilter === 'ACTIVE' || statusFilter === 'REVOKED' || statusFilter === 'INACTIVE') {
      conditions.push(where('status', '==', statusFilter === 'ACTIVE' ? 'Active' : (statusFilter === 'REVOKED' ? 'Revoked' : 'Inactive')));
    }
  }

  // Handling search by name prefix
  let orderField = 'createdAt';
  if (searchQuery) {
    const qCap = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);
    conditions.push(where('name', '>=', qCap));
    conditions.push(where('name', '<=', qCap + '\uf8ff'));
    orderField = 'name'; // Firestore requirement
  }

  let q = query(studentsCol, ...conditions, orderBy(orderField, 'desc'), limit(pageSize));

  if (lastVisible) {
    q = query(studentsCol, ...conditions, orderBy(orderField, 'desc'), startAfter(lastVisible), limit(pageSize));
  }

  try {
    const snap = await getDocs(q);
    const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const newLastVisible = snap.docs[snap.docs.length - 1];

    // Get total count for pagination math with 1-minute caching
    const countKey = `${routeFilter}_${statusFilter}_${searchQuery}`;
    let totalCount = 0;
    
    if (totalCountCache.key === countKey && (Date.now() - totalCountCache.timestamp < COUNT_CACHE_TTL_MS)) {
      totalCount = totalCountCache.count;
    } else {
      const countQuery = query(studentsCol, ...conditions);
      const countSnapshot = await getCountFromServer(countQuery);
      totalCount = countSnapshot.data().count;
      totalCountCache = { key: countKey, count: totalCount, timestamp: Date.now() };
    }

    return { students, lastVisible: newLastVisible, totalCount };
  } catch (err) {
    console.error("Error fetching paginated students:", err);
    throw err;
  }
}

export async function getStudentProfile(identifier) {
  if (!identifier) return null;
  const raw = String(identifier).trim();
  const clean = raw.replace(/^PASS_/i, '').trim();
  const cacheKey = clean.toLowerCase();

  // 1. Check In-Memory Cache
  if (profileCache.has(cacheKey)) {
    const { data, timestamp } = profileCache.get(cacheKey);
    if (Date.now() - timestamp < PROFILE_CACHE_TTL_MS) {
      return data;
    } else {
      profileCache.delete(cacheKey);
    }
  }

  let result = null;

  // 2. Direct document lookup by ID / Email
  try {
    const docRef = doc(db, 'students', cacheKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      result = { id: snap.id, ...snap.data() };
    }
  } catch (e) {
    console.warn("Direct doc lookup notice:", e);
  }

  // 3. Query Firestore by collegeId, enrollment, or email
  if (!result) {
    try {
      const studentsCol = collection(db, 'students');

      // Query by collegeId
      const qCollege = query(studentsCol, where('collegeId', '==', clean));
      const snapCollege = await getDocs(qCollege);
      if (!snapCollege.empty) {
        result = { id: snapCollege.docs[0].id, ...snapCollege.docs[0].data() };
      }

      // Query by enrollment
      if (!result) {
        const qEnroll = query(studentsCol, where('enrollment', '==', clean));
        const snapEnroll = await getDocs(qEnroll);
        if (!snapEnroll.empty) {
          result = { id: snapEnroll.docs[0].id, ...snapEnroll.docs[0].data() };
        }
      }

      // Query by email field
      if (!result) {
        const qEmail = query(studentsCol, where('email', '==', cacheKey));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          result = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
        }
      }
    } catch (err) {
      console.error("Error querying student profile:", err);
    }
  }

  // Save to Cache before returning
  if (result) {
    profileCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    // Also cache by email/collegeId to prevent redundant lookups for alternate IDs
    if (result.email) profileCache.set(result.email.toLowerCase(), { data: result, timestamp: Date.now() });
    if (result.collegeId) profileCache.set(result.collegeId.toLowerCase(), { data: result, timestamp: Date.now() });
    if (result.enrollment) profileCache.set(result.enrollment.toLowerCase(), { data: result, timestamp: Date.now() });
  }

  return result;
}

export async function createStudent(data) {
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

  const docRef = doc(db, 'students', email);
  await setDoc(docRef, {
    name: data.name,
    email,
    role: 'student',
    qrSecret: generateQrSecret(), // Assign cryptographically secure QR secret
    collegeId: data.collegeId || data.enrollment || '',
    phone: data.phone || '',
    parentPhone: data.parentPhone || '',
    busRoute: data.busRoute || '',
    assignedBusId: data.assignedBusId || '',
    assignedBusNumber: data.assignedBusNumber || '',
    pickupStop: data.pickupStop || '',
    passValidity: data.passValidity || '2026-12-31',
    qrCodeData: JSON.stringify({
      id: email,
      collegeId: data.collegeId || '',
      name: data.name,
      route: data.busRoute || '',
      validity: data.passValidity || '2026-12-31'
    }),
    createdAt: serverTimestamp()
  });
  return email;
}

export async function updateStudent(email, data) {
  const cleanEmail = email.toLowerCase().trim();
  const docRef = doc(db, 'students', cleanEmail);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
  
  // Invalidate cache immediately
  profileCache.delete(cleanEmail);
  if (data.collegeId) profileCache.delete(data.collegeId.toLowerCase());
  if (data.enrollment) profileCache.delete(data.enrollment.toLowerCase());
}

export async function deleteStudent(email) {
  const cleanEmail = email.toLowerCase().trim();
  const docRef = doc(db, 'students', cleanEmail);
  await deleteDoc(docRef);
  
  // Invalidate cache immediately
  profileCache.delete(cleanEmail);
}

export async function regenerateQrSecret(email) {
  const cleanEmail = email.toLowerCase().trim();
  const docRef = doc(db, 'students', cleanEmail);
  await updateDoc(docRef, {
    qrSecret: generateQrSecret(),
    updatedAt: serverTimestamp()
  });
  profileCache.delete(cleanEmail);
}

/**
 * Cryptographically secure password generator
 * Produces high-entropy passwords using Web Crypto API.
 * Meets standard enterprise authentication requirements (mixed case, digits, symbols).
 */
export function generateSecurePassword(length = 12) {
  const charset = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*';
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis.crypto || globalThis.msCrypto) : (typeof window !== 'undefined' ? window.crypto : null);
  
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Secure cryptographic random generator is not available in this environment');
  }

  const values = new Uint8Array(length);
  cryptoObj.getRandomValues(values);
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[values[i] % charset.length];
  }
  
  // Ensure diversity: at least one lowercase, one uppercase, one digit, and one special symbol
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%&*]/.test(password);
  
  if (!hasLower || !hasUpper || !hasDigit || !hasSpecial) {
    return generateSecurePassword(length);
  }
  
  return password;
}

export async function bulkGeneratePasswords(emails) {
  const results = [];
  for (const email of emails) {
    const password = generateSecurePassword(12);
    try {
      await createSecondaryAuthUser(email, password);
      results.push({ email, password, status: 'Created' });
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        results.push({ email, password: 'N/A', status: 'Account already exists' });
      } else {
        results.push({ email, password: 'N/A', status: `Error: ${e.message}` });
      }
    }
  }
  return results;
}

/**
 * Bulk delete student documents using Firestore writeBatch in chunks of 500.
 * Guarantees transactional atomicity per chunk and purges local caches.
 */
export async function bulkDeleteStudents(emails) {
  if (!Array.isArray(emails) || emails.length === 0) return { deletedCount: 0 };
  
  const BATCH_SIZE = 500;
  let deletedCount = 0;
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    
    for (const email of chunk) {
      const cleanEmail = email.toLowerCase().trim();
      const docRef = doc(db, 'students', cleanEmail);
      batch.delete(docRef);
      profileCache.delete(cleanEmail);
    }
    
    await batch.commit();
    deletedCount += chunk.length;
  }
  
  totalCountCache.timestamp = 0;
  return { deletedCount };
}

/**
 * Bulk update student status using Firestore writeBatch in chunks of 500.
 */
export async function bulkUpdateStudentStatus(emails, status) {
  if (!Array.isArray(emails) || emails.length === 0) return { updatedCount: 0 };
  
  const BATCH_SIZE = 500;
  let updatedCount = 0;
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    
    for (const email of chunk) {
      const cleanEmail = email.toLowerCase().trim();
      const docRef = doc(db, 'students', cleanEmail);
      batch.update(docRef, {
        status,
        updatedAt: serverTimestamp()
      });
      profileCache.delete(cleanEmail);
    }
    
    await batch.commit();
    updatedCount += chunk.length;
  }
  
  return { updatedCount };
}

/**
 * Bulk extend pass validity and activate students using Firestore writeBatch in chunks of 500.
 */
export async function bulkExtendPassValidity(emails, passValidityIsoDate) {
  if (!Array.isArray(emails) || emails.length === 0) return { updatedCount: 0 };
  
  const BATCH_SIZE = 500;
  let updatedCount = 0;
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    
    for (const email of chunk) {
      const cleanEmail = email.toLowerCase().trim();
      const docRef = doc(db, 'students', cleanEmail);
      batch.update(docRef, {
        passValidity: passValidityIsoDate,
        status: 'Active',
        updatedAt: serverTimestamp()
      });
      profileCache.delete(cleanEmail);
    }
    
    await batch.commit();
    updatedCount += chunk.length;
  }
  
  return { updatedCount };
}

// ==========================================
// STUDENT SCHEMA & IMPORT
// ==========================================

export const FORBIDDEN_FIELDS = ['password', 'pass', 'secret', 'token', 'hash', 'credential'];

export const LOCKED_FIELDS = ['name', 'email', 'collegeId'];

export const DEFAULT_STUDENT_SCHEMA = [
  { key: 'name', label: 'Student Name', type: 'string', required: true, locked: true, description: 'Full legal name of the student' },
  { key: 'email', label: 'Email Address', type: 'email', required: true, locked: true, description: 'Institutional or personal email' },
  { key: 'collegeId', label: 'Enrollment / College ID', type: 'string', required: true, locked: true, description: 'Unique university enrollment number' },
  { key: 'phone', label: 'Student Phone', type: 'phone', required: false, locked: false, description: 'Mobile contact number' },
  { key: 'parentPhone', label: 'Emergency Contact', type: 'phone', required: false, locked: false, description: 'Parent or guardian phone' },
  { key: 'busRoute', label: 'Assigned Route', type: 'route', required: false, locked: false, description: 'Route name or code' },
  { key: 'pickupStop', label: 'Boarding Stop', type: 'string', required: false, locked: false, description: 'Designated morning pickup waypoint' },
  { key: 'assignedBusNumber', label: 'Bus Number', type: 'bus', required: false, locked: false, description: 'Specific bus vehicle assigned' },
  { key: 'passValidity', label: 'Pass Expiry (YYYY-MM-DD)', type: 'date', required: false, locked: false, description: 'ISO date until pass remains active' },
  { key: 'status', label: 'Account Status', type: 'status', required: false, locked: false, description: 'Active or Inactive' }
];

export function subscribeToStudentSchema(onUpdate, onError) {
  const docRef = doc(db, 'settings', 'studentImportSchema');
  return onSnapshot(docRef, (snap) => {
    if (snap.exists() && Array.isArray(snap.data().fields)) {
      const loaded = snap.data().fields.filter(f => !FORBIDDEN_FIELDS.includes(f.key.toLowerCase()));
      const normalized = DEFAULT_STUDENT_SCHEMA.map(def => {
        const existing = loaded.find(f => f.key === def.key);
        return existing ? { ...def, ...existing, locked: def.locked } : def;
      });
      loaded.forEach(f => {
        if (!normalized.some(n => n.key === f.key)) {
          normalized.push(f);
        }
      });
      onUpdate(normalized);
    } else {
      onUpdate(DEFAULT_STUDENT_SCHEMA);
    }
  }, (err) => {
    console.warn("Schema subscription error:", err);
    onUpdate(DEFAULT_STUDENT_SCHEMA);
    if (onError) onError(err);
  });
}

export async function saveStudentSchema(fields) {
  const hasForbidden = fields.some(f => FORBIDDEN_FIELDS.includes(f.key.toLowerCase()));
  if (hasForbidden) {
    throw new Error("Security Violation: Passwords or credential fields cannot be part of the student schema.");
  }
  const ensured = fields.map(f => {
    if (LOCKED_FIELDS.includes(f.key)) {
      return { ...f, required: true, locked: true };
    }
    return f;
  });
  const docRef = doc(db, 'settings', 'studentImportSchema');
  await setDoc(docRef, {
    fields: ensured,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export function generateCsvTemplate(schema = DEFAULT_STUDENT_SCHEMA) {
  const headers = schema.map(f => f.key);
  const sampleRow = schema.map(() => '');
  return `${headers.join(',')}\n${sampleRow.join(',')}\n`;
}

export function parseCsv(text) {
  const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push({ __rowNum: i + 1, __raw: lines[i], ...row });
  }

  return { headers, rows };
}

export function validateStudentRow(row, schema = DEFAULT_STUDENT_SCHEMA, routesList = [], busesList = []) {
  const errors = [];
  for (const k of Object.keys(row)) {
    if (FORBIDDEN_FIELDS.includes(k.toLowerCase()) && row[k]) {
      errors.push(`Field '${k}' contains passwords or security credentials, which is forbidden.`);
    }
  }

  schema.forEach(field => {
    const valKey = Object.keys(row).find(k => 
      k === field.key.toLowerCase() || 
      k === field.key.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    const value = valKey ? String(row[valKey]).trim() : '';

    if (field.required && !value) {
      errors.push(`Missing required field: ${field.label || field.key}`);
      return;
    }

    if (value) {
      if (field.type === 'email' || field.key === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`Invalid email address format: "${value}"`);
        }
      }

      if (field.type === 'date' || field.key === 'passvalidity' || field.key === 'passValidity') {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value) || isNaN(Date.parse(value))) {
          errors.push(`Invalid date format for ${field.label}. Expected YYYY-MM-DD.`);
        }
      }

      if (field.type === 'phone' && value.replace(/[^0-9]/g, '').length < 7) {
        errors.push(`Phone number appears too short: "${value}"`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function batchImportStudents(validRows, onProgress) {
  const CHUNK_SIZE = 400;
  let importedCount = 0;

  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(student => {
      const email = (student.email || '').toLowerCase().trim();
      if (!email) return;

      const docRef = doc(db, 'students', email);
      
      const payload = {
        name: student.name || '',
        email: email,
        collegeId: student.collegeId || student.collegeid || student.enrollment || '',
        phone: student.phone || '',
        parentPhone: student.parentPhone || student.parentphone || '',
        busRoute: student.busRoute || student.busroute || '',
        pickupStop: student.pickupStop || student.pickupstop || '',
        assignedBusNumber: student.assignedBusNumber || student.assignedbusnumber || '',
        passValidity: student.passValidity || student.passvalidity || '2026-12-31',
        status: student.status || 'Active',
        role: 'student',
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.set(docRef, payload, { merge: true });
    });

    await batch.commit();
    importedCount += chunk.length;
    if (onProgress) onProgress(importedCount, validRows.length);
  }

  return importedCount;
}

export function generateErrorCsv(failedRecords) {
  if (!failedRecords || failedRecords.length === 0) return '';
  const header = 'Row Number,Errors,Raw Data\n';
  const rows = failedRecords.map(item => {
    const errText = (item.errors || []).join('; ').replace(/"/g, '""');
    const rawData = (item.raw || '').replace(/"/g, '""');
    return `${item.rowNum},"${errText}","${rawData}"`;
  });
  return header + rows.join('\n');
}
