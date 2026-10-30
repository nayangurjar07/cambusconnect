// Automated E2E verification script
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  serverTimestamp,
  increment 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB2IxQNKHGAZ1blFbA1W_TD7-3nFl_g2w4",
  authDomain: "cambus-connect-iist.firebaseapp.com",
  projectId: "cambus-connect-iist",
  storageBucket: "cambus-connect-iist.firebasestorage.app",
  messagingSenderId: "289800550418",
  appId: "1:289800550418:web:9100cd54ecd14a19d2c0cb",
  measurementId: "G-XV5LJDB6YH",
  databaseURL: "https://cambus-connect-iist-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function runVerification() {
  console.log("=== STARTING CAMBUS E2E VERIFICATION ===");
  const results = {};

  // Test 1: Student Login
  try {
    const cred = await signInWithEmailAndPassword(auth, 'nayan@indoreinstitute.com', 'nayan12345');
    console.log("✅ 1. Student Auth Successful! UID:", cred.user.uid, "Email:", cred.user.email);
    results.studentAuth = true;
  } catch (err) {
    console.error("❌ 1. Student Auth Failed:", err.message);
    results.studentAuth = false;
  }

  // Test 2: Student Profile Read
  try {
    const userDoc = await getDoc(doc(db, 'users', 'nayan@indoreinstitute.com'));
    if (userDoc.exists()) {
      console.log("✅ 2. Student Profile Found:", userDoc.data().name, "Bus Route:", userDoc.data().busRoute);
      results.studentProfile = true;
    } else {
      console.error("❌ 2. Student Profile not found in users collection.");
      results.studentProfile = false;
    }
  } catch (err) {
    console.error("❌ 2. Student Profile Read Error:", err.message);
    results.studentProfile = false;
  }

  // Test 3: Trips Query (Testing fix for Composite Index Error)
  try {
    const tripsCol = collection(db, 'trips');
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    // Fixed query: filter by studentId, then check date in-memory
    const q = query(tripsCol, where('studentId', '==', 'nayan@indoreinstitute.com'));
    const snap = await getDocs(q);
    let count = 0;
    snap.forEach(d => {
      const data = d.data();
      const ts = data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : null);
      if (!ts || ts >= startOfMonth) count++;
    });
    console.log("✅ 3. Student Trips Query Executed Cleanly (No Composite Index Error)! Count:", count);
    results.tripsQuery = true;
  } catch (err) {
    console.error("❌ 3. Trips Query Failed:", err.message);
    results.tripsQuery = false;
  }

  // Test 4: Student Lost & Found Submission (The Top Bug)
  let createdLostDocId = null;
  try {
    const lostCol = collection(db, 'lost-items');
    const testPayload = {
      title: "Automated Test Lost Item",
      itemName: "Automated Test Lost Item",
      item: "Automated Test Lost Item",
      description: "E2E verification test item",
      locationType: "BUS",
      location: "Bus 22 (Vijay Nagar Route)",
      route: "Vijay Nagar Route",
      busNumber: "22",
      dateLost: new Date().toISOString().split('T')[0],
      status: "Lost",
      userId: auth.currentUser?.uid || 'erfGMXhsGGb0pD791Pxd4GmbySB3',
      userEmail: auth.currentUser?.email || 'nayan@indoreinstitute.com',
      userName: "Nayan Gurjar",
      reportedBy: "Nayan Gurjar",
      contactName: "Nayan Gurjar",
      contactEmail: "nayan@indoreinstitute.com",
      contactPhone: "9876543210",
      createdAt: serverTimestamp()
    };
    const lostDoc = await addDoc(lostCol, testPayload);
    createdLostDocId = lostDoc.id;
    console.log("✅ 4. Lost & Found Document Created in Firestore! Doc ID:", createdLostDocId);
    results.lostAndFound = true;
  } catch (err) {
    console.error("❌ 4. Lost & Found Submission Failed:", err.message);
    results.lostAndFound = false;
  }

  // Test 5: Clean up Test Lost & Found Document
  if (createdLostDocId) {
    try {
      await deleteDoc(doc(db, 'lost-items', createdLostDocId));
      console.log("✅ 5. Cleaned up temporary test Lost & Found record.");
    } catch (e) {
      console.warn("Notice: Test doc cleanup skipped:", e.message);
    }
  }

  // Test 6: Headcount Atomic Increment & Decrement on Bus
  const testBusId = 'nnJH0RcZ6NXZH6dwnQKo'; // Bus 22
  try {
    const busDocRef = doc(db, 'buses', testBusId);
    const busSnap = await getDoc(busDocRef);
    if (busSnap.exists()) {
      const initialCount = busSnap.data().headcount || 0;
      console.log("Initial Bus 22 Headcount:", initialCount);

      // Increment by 1
      await setDoc(busDocRef, { headcount: increment(1) }, { merge: true });
      const snapAfterInc = await getDoc(busDocRef);
      const incCount = snapAfterInc.data().headcount;
      console.log("✅ 6a. Bus Headcount Incremented successfully to:", incCount);

      // Decrement back by 1
      await setDoc(busDocRef, { headcount: increment(-1) }, { merge: true });
      const snapAfterDec = await getDoc(busDocRef);
      console.log("✅ 6b. Bus Headcount Decremented successfully back to:", snapAfterDec.data().headcount);
      results.headcountSync = true;
    } else {
      console.error("Bus 22 document not found in buses collection.");
      results.headcountSync = false;
    }
  } catch (err) {
    console.error("❌ 6. Headcount update failed:", err.message);
    results.headcountSync = false;
  }

  // Test 7: Boarding Log Write & Read
  try {
    const dateStr = new Date().toISOString().split('T')[0];
    const boardingRef = doc(db, `buses/${testBusId}/boardings`, `TEST_E2E_${dateStr}`);
    await setDoc(boardingRef, {
      studentId: '0818CS231120',
      studentName: 'Nayan Gurjar',
      studentEmail: 'nayan@indoreinstitute.com',
      busId: testBusId,
      busNumber: '22',
      routeName: 'Vijay Nagar',
      checkInTime: serverTimestamp(),
      date: dateStr,
      method: 'E2E Verification'
    });
    console.log("✅ 7a. Boarding Record Written to buses/nnJH0RcZ6NXZH6dwnQKo/boardings!");

    // Verify Read
    const checkSnap = await getDoc(boardingRef);
    if (checkSnap.exists()) {
      console.log("✅ 7b. Boarding Record Read Confirmed! Passenger:", checkSnap.data().studentName);
      results.boardingLog = true;
    }

    // Clean up
    await deleteDoc(boardingRef);
    console.log("✅ 7c. Cleaned up temporary test boarding record.");
  } catch (err) {
    console.error("❌ 7. Boarding log test failed:", err.message);
    results.boardingLog = false;
  }

  console.log("\n=== FINAL VERIFICATION SUMMARY ===");
  console.table(results);
  const allPassed = Object.values(results).every(v => v === true);
  console.log("OVERALL STATUS:", allPassed ? "ALL TESTS PASSED ✨" : "SOME TESTS FAILED ⚠️");
}

runVerification();
