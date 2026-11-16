// src/pages/student/BusPass.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { PassCard } from '../../components/domain/PassCard';
import { db, doc, onSnapshot, setDoc, serverTimestamp } from '../../config/firebase';
import { Smartphone, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

const DEVICE_ID_KEY = 'cambus_device_session_id';

function getOrCreateDeviceSessionId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      id = window.crypto.randomUUID();
    } else {
      id = 'dev_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    }
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function StudentBusPass() {
  const { profile, currentUser } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();

  const [deviceSessionId] = useState(getOrCreateDeviceSessionId);
  const [activeDeviceSessionId, setActiveDeviceSessionId] = useState(null);
  const [deviceSwitchLockedUntil, setDeviceSwitchLockedUntil] = useState(null);
  const [isDeviceBlocked, setIsDeviceBlocked] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState(null);
  const [claimingDevice, setClaimingDevice] = useState(false);

  const studentEmail = (profile?.email || currentUser?.email || '').toLowerCase().trim();

  // Live Firestore listener for single-device binding (Layer 3)
  useEffect(() => {
    if (!studentEmail) return;

    // Listen to students collection doc or users doc
    const studentRef = doc(db, 'students', studentEmail);
    const unsub = onSnapshot(studentRef, async (snap) => {
      let data = snap.data();
      if (!data) {
        // Check users doc
        const userRef = doc(db, 'users', studentEmail);
        const userSnap = await snap.ref.firestore.doc(`users/${studentEmail}`).get().catch(() => null);
        data = userSnap?.data() || null;
      }

      if (data) {
        const boundDevice = data.activeDeviceSessionId || null;
        const lockedUntil = data.deviceSwitchLockedUntil ? new Date(data.deviceSwitchLockedUntil).getTime() : 0;
        
        setActiveDeviceSessionId(boundDevice);
        setDeviceSwitchLockedUntil(lockedUntil);

        if (!boundDevice) {
          // Auto-bind current device on initial pass access
          try {
            const nextLockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await setDoc(studentRef, {
              activeDeviceSessionId: deviceSessionId,
              deviceSwitchLockedUntil: nextLockedUntil,
              lastDeviceBoundAt: serverTimestamp()
            }, { merge: true });
            setActiveDeviceSessionId(deviceSessionId);
            setIsDeviceBlocked(false);
          } catch (bindErr) {
            console.warn("[BusPass] Non-blocking initial device binding note:", bindErr);
          }
        } else if (boundDevice === deviceSessionId) {
          setIsDeviceBlocked(false);
          setBlockedMessage(null);
        } else {
          // Device mismatch!
          const now = Date.now();
          if (lockedUntil && now < lockedUntil) {
            const remainingHours = Math.ceil((lockedUntil - now) / (60 * 60 * 1000));
            setIsDeviceBlocked(true);
            setBlockedMessage(
              `This digital bus pass is active on another device. Transfers are locked for ${remainingHours} more hours to prevent pass sharing.`
            );
          } else {
            // Lockout period has elapsed: user can claim this device
            setIsDeviceBlocked(true);
            setBlockedMessage(
              "This pass was last active on a different device. The 24-hour transfer cooldown has expired. You may transfer and authorize this device below."
            );
          }
        }
      }
    }, (err) => {
      console.warn("[BusPass] Device binding listener warning:", err);
    });

    return () => unsub();
  }, [studentEmail, deviceSessionId]);

  const handleClaimDevice = async () => {
    if (!studentEmail) return;
    setClaimingDevice(true);
    try {
      const studentRef = doc(db, 'students', studentEmail);
      const nextLockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await setDoc(studentRef, {
        activeDeviceSessionId: deviceSessionId,
        deviceSwitchLockedUntil: nextLockedUntil,
        lastDeviceBoundAt: serverTimestamp()
      }, { merge: true });

      setActiveDeviceSessionId(deviceSessionId);
      setIsDeviceBlocked(false);
      setBlockedMessage(null);
      showSuccess("Device authorized! Your pass is now active on this phone.");
    } catch (err) {
      showError("Could not transfer device: " + (err.message || 'Permission denied'));
    } finally {
      setClaimingDevice(false);
    }
  };

  const isCooldownExpired = deviceSwitchLockedUntil && Date.now() >= deviceSwitchLockedUntil;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <PageHeader
        title="Bus Pass"
        subtitle="Dynamic 15-second rotating pass with single-device authentication"
      />

      <PassCard 
        student={profile} 
        showQR={true} 
        deviceSessionId={deviceSessionId}
        isDeviceBlocked={isDeviceBlocked}
        deviceBlockedMessage={blockedMessage}
      />

      {/* Device Transfer Action if cooldown expired */}
      {isDeviceBlocked && isCooldownExpired && (
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs text-center space-y-3">
          <p className="text-xs text-slate-600 font-medium">
            24-hour transfer cooldown has ended. Register this phone as your primary transit device?
          </p>
          <Button
            variant="primary"
            size="sm"
            className="w-full rounded-xl"
            icon={Smartphone}
            isLoading={claimingDevice}
            onClick={handleClaimDevice}
          >
            Authorize This Device Now
          </Button>
        </div>
      )}
    </div>
  );
}

export default StudentBusPass;
