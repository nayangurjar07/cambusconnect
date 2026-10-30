const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// Environment-sourced HMAC Secret (Sourced via environment variable or GCP Secret Manager)
const SECRET_KEY = process.env.QR_PASS_HMAC_SECRET || process.env.ENCRYPTION_KEY;

exports.generateSecureQrPass = functions.https.onCall(async (data, context) => {
  // 1. Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to generate a pass."
    );
  }

  const uid = context.auth.uid;
  const email = context.auth.token.email;

  if (!email) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User token must contain an email address."
    );
  }

  // 2. Fetch student details from Firestore
  const db = admin.firestore();
  
  // Fetch from users collection first (denormalized)
  const userDoc = await db.collection("users").doc(email).get();
  
  if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Student record not found."
      );
  }
  
  const userData = userDoc.data();
  if (userData.role !== 'student') {
      throw new functions.https.HttpsError(
          "permission-denied",
          "Only students can generate a pass."
      );
  }

  // Also fetch assigned route from students collection if needed
  const studentDoc = await db.collection("students").doc(email).get();
  const studentData = studentDoc.exists ? studentDoc.data() : {};

  const studentName = userData.name || studentData.name || "Unknown";
  const routeName = studentData.assignedRoute || userData.assignedRoute || "Unassigned";
  const studentId = studentData.studentId || userData.studentId || email;

  // 3. Generate Time-Windowed Payload
  const currentWindow = Math.floor(Date.now() / 30000);
  
  const payloadMap = {
    studentId: studentId,
    studentName: studentName,
    routeName: routeName,
    instituteId: "cambus_connect",
    window: currentWindow,
  };

  const payloadJson = JSON.stringify(payloadMap);
  const payloadB64 = Buffer.from(payloadJson, 'utf8').toString('base64');
  
  // 4. Generate HMAC SHA-256 using the scanner secret
  if (!SECRET_KEY) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Server configuration error: QR signing secret not initialized."
    );
  }
  const hmac = crypto.createHmac("sha256", SECRET_KEY);
  hmac.update(payloadB64);
  const digest = hmac.digest("hex");
  
  // 5. Return signed token
  return {
    token: `${payloadB64}.${digest}`
  };
});
