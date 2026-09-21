// src/services/communications.js
import { 
  app,
  auth,
  db, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp 
} from '../config/firebase';

// ==========================================
// NOTIFICATIONS
// ==========================================

export function subscribeToNotifications(onUpdate, onError, maxItems = 20) {
  const notifCol = collection(db, 'notifications');
  const q = query(notifCol, orderBy('createdAt', 'desc'), limit(maxItems));
  
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      dateFormatted: d.data().createdAt?.toDate 
        ? d.data().createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now'
    }));
    onUpdate(list);
  }, (err) => {
    console.error("Error subscribing to notifications:", err);
    if (onError) onError(err);
  });
}

export async function createNotification({ title, message, type = 'info', targetRouteId = 'all' }) {
  const notifCol = collection(db, 'notifications');
  const docRef = await addDoc(notifCol, {
    title: title || 'Transit Announcement',
    message,
    type, // 'alert', 'delay', 'info', 'crowd'
    targetRouteId,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function deleteNotification(id) {
  await deleteDoc(doc(db, 'notifications', id));
}

// ==========================================
// SUPPORT QUERIES
// ==========================================

export function subscribeToSupportQueries(onUpdate, onError) {
  const col = collection(db, 'support-queries');
  const q = query(col, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(list);
  }, (err) => {
    console.error("Error subscribing to support queries:", err);
    if (onError) onError(err);
  });
}

export async function submitSupportQuery(data) {
  const col = collection(db, 'support-queries');
  const docRef = await addDoc(col, {
    studentName: data.name || data.studentName || 'Student',
    studentEmail: data.email || data.studentEmail || '',
    subject: data.subject || 'General Inquiry',
    category: data.category || 'Transit',
    message: data.message,
    status: 'Pending',
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateQueryStatus(queryId, status, adminNotes = '') {
  const docRef = doc(db, 'support-queries', queryId);
  await updateDoc(docRef, {
    status,
    adminNotes,
    resolvedAt: status === 'Resolved' ? serverTimestamp() : null,
    updatedAt: serverTimestamp()
  });
}

// Aliases for compatibility
export const createSupportQuery = submitSupportQuery;

// ==========================================
// LOST & FOUND
// ==========================================

export function subscribeToLostItems(onUpdate, onError) {
  const col = collection(db, 'lost-items');
  const q = query(col, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(list);
  }, (err) => {
    console.error("Error subscribing to lost items:", err);
    if (onError) onError(err);
  });
}

export async function reportLostItem(data) {
  const currentUser = auth.currentUser;
  const userEmail = currentUser?.email || data.userEmail || data.email || '';
  const userId = currentUser?.uid || data.userId || userEmail || '';
  const userName = currentUser?.displayName || data.reportedBy || data.userName || data.contactName || 'Student';
  const itemName = (data.itemName || data.title || 'Lost Item').trim();
  const description = (data.description || '').trim();
  const locationType = data.locationType || (data.campusLocation ? 'CAMPUS' : 'BUS');
  const location = data.location || (locationType === 'CAMPUS' ? (data.campusLocation || 'Campus Area') : (data.busNumber ? `Bus ${data.busNumber}` : (data.route || 'Campus Bus')));

  // Firebase Diagnostic Logging (Non-sensitive) removed

  const payload = {
    title: itemName,
    itemName: itemName,
    item: itemName, // Legacy alias
    description: description,
    locationType: locationType,
    location: location,
    route: data.route || location,
    busNumber: data.busNumber || '',
    dateLost: data.dateLost || new Date().toISOString().split('T')[0],
    status: 'Lost', // Canonical status in legacy
    userId: userId,
    userEmail: userEmail,
    userName: userName,
    reportedBy: userName,
    contactName: userName,
    contactEmail: userEmail,
    contactPhone: data.contactPhone || data.userPhone || '',
    userPhone: data.userPhone || data.contactPhone || '',
    createdAt: serverTimestamp()
  };

  try {
    const col = collection(db, 'lost-items');
    const docRef = await addDoc(col, payload);
    
    return { success: true, id: docRef.id, refNumber: docRef.id.slice(0, 8).toUpperCase() };
  } catch (err) {
    console.warn("⚠️ [Firebase Diagnostic: Lost & Found] Error writing to lost-items collection:", err.code, err.message);

    // Fallback: If permission-denied on lost-items, write to support-queries which is always open to authenticated students
    if (err.code === 'permission-denied' || String(err.message).includes('permission')) {
      try {
        
        const supportCol = collection(db, 'support-queries');
        const fallbackDoc = await addDoc(supportCol, {
          category: 'Lost & Found',
          subject: `[Lost & Found] ${itemName}`,
          message: `Lost Item: ${itemName}\nLocation: ${location} (${locationType})\nDetails: ${description}\nContact: ${userName} (${userEmail})`,
          studentEmail: userEmail,
          studentId: userId,
          studentName: userName,
          status: 'Open',
          source: 'student_lost_found',
          createdAt: serverTimestamp()
        });
        
        return { 
          success: true, 
          id: fallbackDoc.id, 
          refNumber: fallbackDoc.id.slice(0, 8).toUpperCase(),
          note: 'Submitted via Support Coordinator Desk' 
        };
      } catch (fallbackErr) {
        console.error("❌ [Firebase Diagnostic: Lost & Found] Fallback write also failed:", fallbackErr);
      }
    }
    throw err;
  }
}

export async function updateLostItemStatus(itemId, status) {
  const docRef = doc(db, 'lost-items', itemId);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp()
  });
}

export async function deleteLostItem(itemId) {
  await deleteDoc(doc(db, 'lost-items', itemId));
}

// Aliases for compatibility
export const subscribeLostFoundItems = subscribeToLostItems;
export const createLostFoundItem = reportLostItem;
