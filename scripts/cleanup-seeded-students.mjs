/**
 * cleanup-seeded-students.mjs
 * Removes all seeded/demo student records from Firestore.
 * 
 * SAFE accounts (DO NOT DELETE):
 *   - nayan@indoreinstitute.com   (E2E test / real account)
 *   - palak@indoreinstitute.com   (real student, active pass)
 *   - admin@indoreinstitute.com   (admin role)
 *   - hariom@gmail.com            (driver role)
 * 
 * Run: node scripts/cleanup-seeded-students.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB2IxQNKHGAZ1blFbA1W_TD7-3nFl_g2w4",
  authDomain: "cambus-connect-iist.firebaseapp.com",
  projectId: "cambus-connect-iist",
  storageBucket: "cambus-connect-iist.firebasestorage.app",
  messagingSenderId: "289800550418",
  appId: "1:289800550418:web:9100cd54ecd14a19d2c0cb",
};

// ── Accounts that must NEVER be deleted ──────────────────────────────────────
const SAFE_EMAILS = new Set([
  'nayan@indoreinstitute.com',
  'palak@indoreinstitute.com',
  'admin@indoreinstitute.com',
  'hariom@gmail.com',
]);

// ── Known seeded demo student emails ─────────────────────────────────────────
// These are the records that were bulk-inserted as demo/seed data.
// The script will ALSO dynamically find @example.edu addresses and iist.ac.in
// test addresses that are NOT in SAFE_EMAILS.
const KNOWN_SEEDED_EMAILS = [
  'aarav.p@student.iist.ac.in',
  'aditi.s@student.iist.ac.in',
  'ananya.r@student.iist.ac.in',
  'arjun.n@student.iist.ac.in',
  'karan.d@student.iist.ac.in',
  'neha.r@student.iist.ac.in',
  'pooja.v@student.iist.ac.in',
  'rohan.k@student.iist.ac.in',
  'sneha.g@student.iist.ac.in',
  'vikram.s@student.iist.ac.in',
  'aarav.sharma@example.edu',
  'amit.p@student.iist.ac.in',
  'divya.s@student.iist.ac.in',
  'kavya.i@student.iist.ac.in',
  'meera.n@student.iist.ac.in',
  'nitin.b@student.iist.ac.in',
  'priya.m@student.iist.ac.in',
  'rahul.j@student.iist.ac.in',
  'sameer.k@student.iist.ac.in',
  'suresh.k@student.iist.ac.in',
  'swati.j@student.iist.ac.in',
];

function isSeededStudent(doc) {
  const data = doc.data();
  const email = (data.email || doc.id || '').toLowerCase();

  // Always safe
  if (SAFE_EMAILS.has(email)) return false;

  // Explicitly known seeds
  if (KNOWN_SEEDED_EMAILS.includes(email)) return true;

  // Catch-all: any @example.edu address
  if (email.endsWith('@example.edu')) return true;

  // student.iist.ac.in addresses NOT in safe list (all seeds used this domain)
  // Real students use @indoreinstitute.com
  if (email.endsWith('@student.iist.ac.in')) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  console.log('🔐 Authenticating as admin...');
  await signInWithEmailAndPassword(auth, 'admin@indoreinstitute.com', 'admin12345');
  console.log('✅ Authenticated\n');

  let totalDeleted = 0;

  // ── 1. Scan `students` collection ────────────────────────────────────────
  console.log('📂 Scanning `students` collection...');
  const studentsSnap = await getDocs(collection(db, 'students'));
  const toDeleteStudents = [];

  for (const d of studentsSnap.docs) {
    if (isSeededStudent(d)) {
      toDeleteStudents.push(d);
    }
  }

  console.log(`   Found ${studentsSnap.size} docs — ${toDeleteStudents.length} seeded to remove`);

  for (const d of toDeleteStudents) {
    const email = d.data().email || d.id;
    await deleteDoc(doc(db, 'students', d.id));
    console.log(`   🗑  Deleted students/${d.id}  (${email})`);
    totalDeleted++;
  }

  // ── 2. Scan `users` collection for role=student seeded accounts ───────────
  console.log('\n📂 Scanning `users` collection (role=student)...');
  const usersSnap = await getDocs(collection(db, 'users'));
  const toDeleteUsers = [];

  for (const d of usersSnap.docs) {
    const data = d.data();
    // Only target student-role docs
    if (data.role !== 'student') continue;
    if (isSeededStudent(d)) {
      toDeleteUsers.push(d);
    }
  }

  console.log(`   Found ${usersSnap.size} docs — ${toDeleteUsers.length} seeded students to remove`);

  for (const d of toDeleteUsers) {
    const email = d.data().email || d.id;
    await deleteDoc(doc(db, 'users', d.id));
    console.log(`   🗑  Deleted users/${d.id}  (${email})`);
    totalDeleted++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n✅ Done. Removed ${totalDeleted} seeded records total.`);
  console.log(`🛡  Protected accounts (untouched):`);
  for (const email of SAFE_EMAILS) {
    console.log(`   • ${email}`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
