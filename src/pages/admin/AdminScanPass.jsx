// src/pages/admin/AdminScanPass.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, Search, CheckCircle2, XCircle, Plus, Minus, RotateCcw, 
  ShieldCheck, Clock, Trash2, Lock, Download 
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { subscribeToBuses, updateBusHeadcount, incrementBusHeadcount } from '../../services/transit';
import { getStudentProfile } from '../../services/students';
import { logBoarding } from '../../services/transit';
import { verifyTotp } from '../../utils/crypto';
import { db, collection, doc, getDoc, getDocs, onSnapshot, setDoc, deleteDoc, writeBatch, serverTimestamp } from '../../config/firebase';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ValidateBusPassScanner } from '../../components/domain/ValidateBusPassScanner';
import { useToast } from '../../contexts/ToastContext';
import { useTenant } from '../../contexts/TenantContext';

export function AdminScanPass() {
  const { tenantKey } = useTenant();
  const { showSuccess, showError, showWarning } = useToast();
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  
  // Policies & Controls
  const [fastMode, setFastMode] = useState(true);
  const [lateOverride, setLateOverride] = useState(false);
  const [sameBusScanLock, setSameBusScanLock] = useState(true);
  const [lockoutMinutes, setLockoutMinutes] = useState(240);
  const [tempLockout, setTempLockout] = useState(240);

  // Scanner Mode: 'checkin' | 'checkout' | 'verify'
  const [scanMode, setScanMode] = useState('checkin');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [logToRemove, setLogToRemove] = useState(null);
  const [isRemovingLog, setIsRemovingLog] = useState(false);

  // Manual Input State
  const [manualInput, setManualInput] = useState('');

  // Camera & Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraFacing, setCameraFacing] = useState('environment');
  const [torchActive, setTorchActive] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [scanLockActive, setScanLockActive] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [boardingLog, setBoardingLog] = useState([]);

  const html5QrScannerRef = useRef(null);
  const localScanLogs = useRef({});
  const autoResetTimerRef = useRef(null);
  const scanLockRef = useRef(false);
  const lastScannedPayloadRef = useRef({ text: '', time: 0 });
  const lastWarningTimeRef = useRef(0);

  // Auto-refresh: Automatically reset verification result after 2.8s for rapid continuous scanning
  useEffect(() => {
    if (verificationResult) {
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = setTimeout(() => {
        setVerificationResult(null);
      }, 2800);
    }
    return () => {
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    };
  }, [verificationResult]);

  // Clean, subtle audio feedback
  const playTone = (type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.start(); osc.stop(ctx.currentTime + 0.22);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) { /* muted */ }
  };

  // 1. Subscribe to fleet buses
  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      if (list.length > 0 && !selectedBusId) {
        setSelectedBusId(list[0].id);
      }
    });
    return () => unsub();
  }, []);

  const selectedBus = buses.find(b => b.id === selectedBusId) || buses[0];
  const capacity = Number(selectedBus?.capacity) || 45;
  const currentCount = Number(selectedBus?.headcount) || 0;
  const occupancyPercent = Math.min(100, Math.round((currentCount / capacity) * 100));

  // 2. Real-time subscription to selected bus's boardings
  useEffect(() => {
    if (!selectedBusId) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const boardingsCol = collection(db, `buses/${selectedBusId}/boardings`);

    const unsub = onSnapshot(boardingsCol, (snap) => {
      const list = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.date === dateStr || docSnap.id.endsWith(`_${dateStr}`)) {
          let time = new Date();
          try {
            if (data.checkInTime?.toDate) time = data.checkInTime.toDate();
            else if (data.checkInTime) time = new Date(data.checkInTime);
          } catch (e) { /* fallback */ }
          list.push({ id: docSnap.id, ...data, time });
        }
      });
      list.sort((a, b) => b.time - a.time);
      setBoardingLog(list);
    }, (err) => {
      console.warn("Boardings subscription warning:", err);
    });

    return () => unsub();
  }, [selectedBusId]);

  // 3. Camera Scanner Controls with Multi-Camera & Flashlight Support
  const startCamera = async (facing = cameraFacing) => {
    setCameraError('');
    setCameraLoading(true);
    try {
      if (html5QrScannerRef.current) {
        try { await html5QrScannerRef.current.stop(); } catch (e) { /* ignore */ }
      }

      const qrScanner = new Html5Qrcode("admin-qr-viewfinder");
      html5QrScannerRef.current = qrScanner;

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 1) {
          setHasMultipleCameras(true);
        }
      } catch (e) { /* camera enum fallback */ }

      const config = {
        fps: 15,
        qrbox: (w, h) => {
          const edge = Math.min(w, h);
          const size = Math.max(160, Math.floor(edge * 0.72));
          return { width: size, height: size };
        }
      };

      await qrScanner.start(
        { facingMode: facing },
        config,
        (decodedText) => {
          handleScannedData(decodedText);
        },
        () => { /* frame noise */ }
      );
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera scanner start error:", err);
      setCameraError(err.message || 'Camera access denied or unavailable.');
      setIsCameraActive(false);
      showError("Could not access camera. Please enter pass ID manually.");
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrScannerRef.current) {
      try {
        await html5QrScannerRef.current.stop();
        html5QrScannerRef.current = null;
      } catch (e) {
        html5QrScannerRef.current = null;
      }
    }
    setIsCameraActive(false);
    setTorchActive(false);
  };

  const handleFlipCamera = async () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    if (isCameraActive) {
      await stopCamera();
      setTimeout(() => startCamera(nextFacing), 150);
    }
  };

  const handleToggleTorch = async () => {
    if (!html5QrScannerRef.current) return;
    try {
      const nextTorch = !torchActive;
      await html5QrScannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchActive(nextTorch);
    } catch (e) {
      showWarning("Flashlight not supported on this device/camera.");
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrScannerRef.current) {
        html5QrScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleHeadcountChange = async (delta) => {
    if (!selectedBus) return;
    const current = Number(selectedBus.headcount) || 0;
    const cap = Number(selectedBus.capacity) || 45;
    const next = Math.min(cap, Math.max(0, current + delta));
    
    if (delta > 0 && current >= cap) {
      showWarning(`Bus ${selectedBus.number} is full (${current}/${cap}).`);
      return;
    }

    try {
      await incrementBusHeadcount(selectedBus.id, delta, cap);
    } catch (err) {
      showError("Failed to update headcount: " + err.message);
    }
  };

  const handleHeadcountReset = () => {
    if (!selectedBus) return;
    setIsResetConfirmOpen(true);
  };

  const confirmHeadcountReset = async () => {
    if (!selectedBus) return;
    setIsResetting(true);
    try {
      await updateBusHeadcount(selectedBus.id, 0, Number(selectedBus.capacity) || 45);

      // ── Clear all scan-state so previously scanned passes become scannable again ──
      // 1. Wipe in-memory scan cache
      localScanLogs.current = {};
      // 2. Clear the last-scanned payload cooldown
      lastScannedPayloadRef.current = { text: '', time: 0 };
      lastWarningTimeRef.current = 0;

      // 3. Batch-delete ALL boarding sub-documents for this bus (today's run)
      try {
        const boardingsColRef = collection(db, `buses/${selectedBus.id}/boardings`);
        const snap = await getDocs(boardingsColRef);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (cleanupErr) {
        console.warn('[AdminScanPass] Boarding cleanup notice:', cleanupErr);
      }

      showSuccess(`Headcount reset to 0 for Bus ${selectedBus.number} — scan list cleared`);
      setIsResetConfirmOpen(false);
    } catch (err) {
      showError("Failed to reset headcount: " + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // 4. File Upload QR Scanner with Multi-Engine Fallback


  const handleScannedData = async (rawInput) => {
    const text = String(rawInput || '').trim();
    if (!text) return;

    const now = Date.now();
    // 1. If scan is currently locked or in progress, ignore incoming camera frames
    if (scanLockRef.current) return;

    // 2. Cooldown for duplicate frames: if same code seen within 3.5s, drop it completely
    if (lastScannedPayloadRef.current.text === text && (now - lastScannedPayloadRef.current.time < 3500)) {
      return;
    }

    scanLockRef.current = true;
    lastScannedPayloadRef.current = { text, time: now };
    setScanLockActive(true);

    try {
      await executeVerify(text);
    } finally {
      // Keep lock for 2.5s cooldown so continuous camera scanning does not spam frames
      setTimeout(() => {
        scanLockRef.current = false;
        setScanLockActive(false);
      }, 2500);
    }
  };

  const executeVerify = async (rawQuery) => {
    const query = (rawQuery || '').trim();
    if (!query) return;

    // Check-out mode
    if (scanMode === 'checkout') {
      await handleHeadcountChange(-1);
      showSuccess("Passenger checked out (-1)");
      playTone('success');
      setVerificationResult({
        status: 'approved',
        reason: 'Passenger checked out successfully. Headcount reduced by 1.',
        student: { name: 'Passenger Check-Out', collegeId: query }
      });
      return;
    }

    // Capacity Pre-Check
    if (scanMode === 'checkin') {
      const busCapacity = Number(selectedBus?.capacity) || 45;
      const currentHeadcount = Number(selectedBus?.headcount) || 0;
      if (currentHeadcount >= busCapacity) {
        playTone('error');
        setVerificationResult({ 
          status: 'rejected', 
          reason: `Bus is at maximum capacity (${currentHeadcount} / ${busCapacity} passengers).`,
          recommendation: 'Passenger must board the next available vehicle.'
        });
        showError(`Bus ${selectedBus.number} is at full capacity`);
        return;
      }
    }

    setVerifying(true);
    setVerificationResult(null);

    try {
      let lookup = query;
      let tokenPayload = null;

      // JSON Token Check
      if (query.startsWith('{') && query.endsWith('}')) {
        try {
          tokenPayload = JSON.parse(query);
          lookup = tokenPayload.email || tokenPayload.studentId || tokenPayload.collegeId || tokenPayload.enrollment || tokenPayload.id || query;
        } catch (e) { /* not valid JSON */ }
      }

      // Campus validation (case-insensitive & alias-aware)
      const activeTenant = (tenantKey || 'iist').toLowerCase();
      const tokenTenant = (tokenPayload?.tenantId || '').toLowerCase();
      const isCrossCampus = tokenTenant && 
        tokenTenant !== activeTenant && 
        tokenTenant !== 'default' &&
        !(activeTenant === 'iist' && (tokenTenant === 'indoreinstitute' || tokenTenant.includes('indore')));

      if (isCrossCampus) {
        playTone('error');
        setVerificationResult({ 
          status: 'rejected', 
          reason: `Designated campus is "${tokenPayload.tenantId.toUpperCase()}". This console operates on "${(tenantKey || 'iist').toUpperCase()}".`,
          recommendation: 'Passenger pass is not valid for this campus.'
        });
        showError(`Cross-campus pass rejected (${tokenPayload.tenantId})`);
        return;
      }

      let student = await getStudentProfile(lookup);

      // Fallback lookups if primary lookup didn't match directly
      if (!student && tokenPayload) {
        if (tokenPayload.studentId && tokenPayload.studentId !== lookup) {
          student = await getStudentProfile(tokenPayload.studentId);
        }
        if (!student && tokenPayload.email && tokenPayload.email !== lookup) {
          student = await getStudentProfile(tokenPayload.email);
        }
        if (!student && tokenPayload.collegeId && tokenPayload.collegeId !== lookup) {
          student = await getStudentProfile(tokenPayload.collegeId);
        }
      }

      if (!student) {
        playTone('error');
        setVerificationResult({ 
          status: 'rejected', 
          reason: `No matching student record found in institutional directory for: "${lookup}".`,
          recommendation: 'Verify enrollment ID, college ID, or register pass in administration portal.'
        });
        showError('Invalid pass: record not found');
        return;
      }

      // Cryptographic TOTP Verification
      if (tokenPayload) {
        if (!tokenPayload.totp) {
          // Reject old static QR codes immediately
          playTone('error');
          setVerificationResult({ 
            status: 'rejected', 
            reason: `Legacy static QR codes are no longer supported for security reasons.`,
            recommendation: 'Ask student to show their new dynamic pass from the dashboard.'
          });
          showError('Legacy pass rejected. Update required.');
          return;
        }
        
        const secret = student.qrSecret;
        if (!secret) {
          playTone('error');
          setVerificationResult({ 
            status: 'rejected', 
            reason: `Student profile does not have a cryptographic QR secret provisioned.`,
            recommendation: 'Regenerate student QR secret in the administrative directory.'
          });
          showError('Invalid pass: No cryptographic secret provisioned');
          return;
        }

        const isValidTotp = await verifyTotp(tokenPayload.totp, secret);
        
        if (!isValidTotp) {
          playTone('error');
          setVerificationResult({ 
            status: 'rejected', 
            reason: `Cryptographic pass verification failed. The QR code has expired or is forged.`,
            recommendation: 'Ask student to wait for their pass to auto-refresh and try again.'
          });
          showError('Invalid pass: Expired or Forged');
          return;
        }
      }

      // Layer 4: Multi-Layer Anti-Passback & Duplicate Guard (Locks same pass re-scans & halts headcount)
      const sId = student.collegeId || student.enrollment || student.id || student.email;
      const cleanStudentKey = String(sId).replace(/[/.]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const shiftId = 'shift_1';
      const antiPassbackDocId = `${dateStr}_${shiftId}_${cleanStudentKey}`;
      const antiPassbackRef = doc(db, 'boarding_logs', antiPassbackDocId);

      if (sameBusScanLock && !lateOverride) {
        const lockoutMs = (Number(lockoutMinutes) || 240) * 60 * 1000;
        const now = Date.now();

        // 1. Instant In-Memory Cache Check (catches rapid repeat frames and fast double-scans immediately)
        const studentAliases = [
          sId,
          cleanStudentKey,
          student.email ? student.email.toLowerCase() : null,
          student.collegeId,
          student.enrollment,
          student.id
        ].filter(Boolean);

        let isAlreadyScanned = false;
        for (const alias of studentAliases) {
          const prevTime = localScanLogs.current[alias];
          if (prevTime && (now - prevTime < lockoutMs)) {
            isAlreadyScanned = true;
            break;
          }
        }

        // 2. Active Bus Boardings Array Check (checks already-loaded boardings for this bus session)
        if (!isAlreadyScanned && Array.isArray(boardingLog)) {
          const matchLog = boardingLog.find((b) => {
            const bEmail = (b.studentEmail || '').toLowerCase();
            const bId = String(b.studentId || '');
            return (
              (student.email && bEmail === student.email.toLowerCase()) ||
              (sId && bId === String(sId)) ||
              (student.collegeId && bId === String(student.collegeId))
            );
          });
          if (matchLog) {
            isAlreadyScanned = true;
          }
        }

        // 3. Firestore Shift Lockout Check (cross-device persistent check)
        if (!isAlreadyScanned) {
          try {
            const passbackSnap = await getDoc(antiPassbackRef);
            if (passbackSnap.exists()) {
              const pbData = passbackSnap.data();
              const loggedTime = pbData.timestamp?.toDate ? pbData.timestamp.toDate().getTime() : (pbData.createdAt || 0);
              const diffMs = now - loggedTime;
              if (diffMs < lockoutMs) {
                isAlreadyScanned = true;
              }
            }
          } catch (pbErr) {
            console.warn("[AdminScanPass] Firestore check notice:", pbErr);
          }
        }

        if (isAlreadyScanned) {
          lastScannedPayloadRef.current = { text: query, time: Date.now() };
          const warnNow = Date.now();
          if (warnNow - lastWarningTimeRef.current > 2000) {
            playTone('error');
            showWarning('Bus pass is already scanned');
            lastWarningTimeRef.current = warnNow;
          }
          setVerificationResult({
            status: 'rejected',
            student,
            reason: 'Bus pass is already scanned',
            recommendation: 'Passenger has already boarded this bus run.'
          });
          return; // STOP! Headcount will NOT be incremented, no duplicate boarding logged!
        }
      }

      // Approved!
      playTone('success');
      const scanNow = Date.now();
      localScanLogs.current[sId] = scanNow;
      if (student.email) localScanLogs.current[student.email.toLowerCase()] = scanNow;
      if (cleanStudentKey) localScanLogs.current[cleanStudentKey] = scanNow;
      if (student.collegeId) localScanLogs.current[student.collegeId] = scanNow;

      setVerificationResult({
        status: 'approved',
        student,
        reason: scanMode === 'verify' ? 'Pass Active & Verified (No headcount change)' : 'Boarding Authorized'
      });

      if (scanMode === 'checkin') {
        // 1. Atomic shift anti-passback write (persists lock first)
        try {
          await setDoc(antiPassbackRef, {
            studentId: sId,
            studentName: student.name || 'Student',
            studentEmail: student.email || '',
            busId: selectedBus.id,
            busNumber: selectedBus.number || '',
            driverEmail: user?.email || profile?.email || '',
            driverName: profile?.name || user?.displayName || 'Admin Staff',
            shiftId: shiftId,
            stopName: student.pickupStop || student.stop || '',
            timestamp: serverTimestamp(),
            createdAt: scanNow
          }, { merge: true });
        } catch (apErr) {
          console.warn("[AdminScanPass] Firestore write warning:", apErr);
        }

        // 2. Increment headcount ONLY if Fast Mode enabled!
        if (fastMode) {
          await handleHeadcountChange(1);
        }

        // 3. Bus specific boarding entry
        const logId = `${cleanStudentKey}_${dateStr}_${Date.now()}`;
        const logRef = doc(db, `buses/${selectedBus.id}/boardings`, logId);

        await setDoc(logRef, {
          studentId: sId,
          studentName: student.name,
          studentEmail: student.email || '',
          busId: selectedBus.id,
          busNumber: selectedBus.number || '',
          routeName: selectedBus.route || student.busRoute || '',
          checkInTime: serverTimestamp(),
          date: dateStr,
          method: tokenPayload ? 'Dynamic QR Scanner' : 'Manual Entry'
        }, { merge: true });

        await logBoarding({
          studentId: student.studentId || student.enrollmentId || student.enrollment || student.collegeId || student.id || student.email || sId || String(manualInput || ''),
          studentEmail: student.email || '',
          studentName: student.name || 'Student',
          busId: selectedBus?.id || '',
          busNumber: selectedBus?.number || '',
          routeName: selectedBus?.route || student.busRoute || '',
          timestamp: new Date().toISOString()
        });

        showSuccess(`Verified: ${student.name} (+1)`);
      } else {
        showSuccess(`Verified: ${student.name}`);
      }

      setManualInput('');
    } catch (err) {
      console.error("Verification exception:", err);
      showError('Verification failed: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };



  const handleSaveLockTimer = () => {
    setLockoutMinutes(Number(tempLockout));
    showSuccess(`Anti-loop timer set to ${tempLockout} minutes.`);
  };

  const handleRemoveLog = (logItem) => {
    setLogToRemove(logItem);
  };

  const confirmRemoveLog = async () => {
    if (!logToRemove) return;
    setIsRemovingLog(true);
    try {
      const bRef = doc(db, `buses/${selectedBusId}/boardings`, logToRemove.id);
      await deleteDoc(bRef);
      if (fastMode) await handleHeadcountChange(-1);
      delete localScanLogs.current[logToRemove.studentId];
      showSuccess("Boarding removed and headcount updated.");
      setLogToRemove(null);
    } catch (err) {
      showError("Could not remove boarding: " + err.message);
    } finally {
      setIsRemovingLog(false);
    }
  };

  const handleExportCsv = () => {
    if (boardingLog.length === 0) {
      showError("No recent boarding records available to export.");
      return;
    }

    const busNum = selectedBus?.number || 'Bus';
    const dateStr = new Date().toISOString().split('T')[0];

    const headers = [
      'Student ID',
      'Passenger Name',
      'Email',
      'Bus Number',
      'Route Name',
      'Check-In Date',
      'Check-In Time',
      'Verification Method'
    ];

    const rows = boardingLog.map((log) => {
      const timeStr = log.time instanceof Date && !isNaN(log.time)
        ? log.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—';
      const dateVal = log.date || (log.time instanceof Date && !isNaN(log.time) ? log.time.toISOString().split('T')[0] : dateStr);

      return [
        `"${String(log.studentId || '').replace(/"/g, '""')}"`,
        `"${String(log.studentName || 'Student').replace(/"/g, '""')}"`,
        `"${String(log.studentEmail || '').replace(/"/g, '""')}"`,
        `"${String(log.busNumber || selectedBus?.number || '').replace(/"/g, '""')}"`,
        `"${String(log.routeName || selectedBus?.route || 'Campus Route').replace(/"/g, '""')}"`,
        `"${dateVal}"`,
        `"${timeStr}"`,
        `"${String(log.method || 'Scanner').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = `${headers.join(',')}\n${rows.join('\n')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cambus_recent_boardings_bus_${busNum}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess(`Exported ${boardingLog.length} boarding records to CSV`);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-sans relative">
      {/* Decorative ambient background for premium spatial feel */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50/20 to-transparent pointer-events-none" />
      
      {/* ─── Standard Clean PageHeader ─── */}
      <PageHeader
        title="Pass Scanner & Boarding"
        subtitle="Validate student passes, monitor live bus occupancy, and manage boarding verification"
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Console Active
            </span>
          </div>
        }
      />

      {/* ─── Top Card: Active Vehicle Run & Occupancy Monitor ─── */}
      <Card className="p-5 backdrop-blur-xl bg-white/80 border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-gray-900/5 transition-all">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Vehicle Selector & Run Metadata */}
          <div className="lg:col-span-6 space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Assigned Fleet Vehicle Run
            </label>
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            >
              {buses.map(b => (
                <option key={b.id} value={b.id}>
                  Bus {b.number} {b.route ? `— ${b.route}` : ''}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 pt-1">
              <span>Driver: <strong className="font-medium text-gray-800">{selectedBus?.driver || selectedBus?.driverName || 'Unassigned'}</strong></span>
              <span>•</span>
              <span>Conductor: <strong className="font-medium text-gray-800">{selectedBus?.conductor || selectedBus?.conductorName || 'Unassigned'}</strong></span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live GPS Sync
              </span>
            </div>
          </div>

          {/* Occupancy Progress & Micro-Steppers */}
          <div className="lg:col-span-6 lg:border-l lg:border-gray-100 lg:pl-6 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700">Vehicle Occupancy</span>
              <span className="font-semibold text-gray-900">
                {currentCount} / {capacity} seats ({occupancyPercent}%)
              </span>
            </div>

            {/* Clean Progress Bar */}
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  occupancyPercent >= 90 ? 'bg-rose-500' : (occupancyPercent >= 70 ? 'bg-amber-500' : 'bg-blue-600')
                }`}
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>

            {/* Stepper Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleHeadcountChange(-1)}
                  disabled={currentCount <= 0}
                  className="h-8 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Remove 1 passenger"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>1</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleHeadcountChange(1)}
                  disabled={currentCount >= capacity}
                  className="h-8 px-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Add 1 passenger"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>1</span>
                </button>
                <button
                  type="button"
                  onClick={handleHeadcountReset}
                  className="h-8 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Reset count to 0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              {sameBusScanLock && (
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 font-medium bg-gray-50 border border-gray-200/60 px-2.5 py-1 rounded-md">
                  <Lock className="w-3 h-3 text-gray-400" />
                  Anti-Loop Lock: {lockoutMinutes}m
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Main Working Section: Scanner & Policies ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols): Optical QR Scanner */}
        <div className="lg:col-span-8 space-y-5">
          <Card className="overflow-hidden backdrop-blur-xl bg-white/80 border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-gray-900/5 transition-all">
            {/* Card Header with Mode Switcher */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">QR Code Scanner</h3>
              </div>

              {/* Mode Selector Tabs */}
              <div className="w-full sm:w-auto">
                <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-gray-100 p-1 rounded-xl sm:rounded-lg">
                  <button
                    type="button"
                    onClick={() => setScanMode('checkin')}
                    className={`px-2.5 sm:px-3 py-1.5 sm:py-1 text-center text-xs font-medium rounded-lg sm:rounded-md transition-all cursor-pointer ${
                      scanMode === 'checkin'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Check-In (+1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMode('checkout')}
                    className={`px-2.5 sm:px-3 py-1.5 sm:py-1 text-center text-xs font-medium rounded-lg sm:rounded-md transition-all cursor-pointer ${
                      scanMode === 'checkout'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Check-Out (-1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMode('verify')}
                    className={`px-2.5 sm:px-3 py-1.5 sm:py-1 text-center text-xs font-medium rounded-lg sm:rounded-md transition-all cursor-pointer ${
                      scanMode === 'verify'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Verify Only
                  </button>
                </div>
              </div>
            </div>

            {/* Viewfinder Area - Minimalist, Compact & Light Surface (No harsh black or green) */}
            <div 
              className="p-3 sm:p-5 bg-gradient-to-b from-slate-50/60 via-white to-slate-50/30 flex flex-col items-center justify-center border-b border-slate-100"
            >
              <ValidateBusPassScanner
                elementId="admin-qr-viewfinder"
                isCameraActive={isCameraActive}
                cameraLoading={cameraLoading}
                onStartCamera={() => startCamera(cameraFacing)}
                onStopCamera={stopCamera}
                cameraError={cameraError}
                embedded={true}
                showTorch={true}
                torchActive={torchActive}
                onToggleTorch={handleToggleTorch}
                showFlip={hasMultipleCameras}
                onFlipCamera={handleFlipCamera}
                compact={true}
              />
            </div>

            {/* Verification Result Feedback */}
            {verificationResult && (
              <div className={`p-4 border-t text-xs transition-colors ${
                verificationResult.status === 'approved'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {verificationResult.status === 'approved' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-semibold text-sm">
                      {verificationResult.status === 'approved'
                        ? (scanMode === 'checkin' ? 'Pass Approved — Boarding Recorded (+1)' : 'Pass Verified Active')
                        : 'Pass Denied'}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                    Auto-reset in 3s
                  </span>
                </div>

                {verificationResult.student && (
                  <div className="space-y-2.5 mt-2.5">
                    <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-200 shadow-2xs">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                        {verificationResult.student.photoURL ? (
                          <img 
                            src={verificationResult.student.photoURL} 
                            alt={verificationResult.student.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          verificationResult.student.name?.charAt(0).toUpperCase() || 'S'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Verified Student</span>
                        <h4 className="font-bold text-gray-900 truncate leading-tight">
                          {verificationResult.student.name}
                        </h4>
                        <p className="text-[11px] font-medium text-gray-500 tabular-nums truncate">
                          ID: {verificationResult.student.collegeId || verificationResult.student.enrollment || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                        <span className="text-gray-400 block text-[11px]">Assigned Stop</span>
                        <span className="font-semibold text-gray-900 truncate block mt-0.5">
                          {verificationResult.student.pickupStop || verificationResult.student.stop || 'Campus Stop'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                        <span className="text-gray-400 block text-[11px]">Assigned Route</span>
                        <span className="font-semibold text-gray-900 truncate block mt-0.5">
                          {verificationResult.student.busRoute || 'Campus Route'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs col-span-2 sm:col-span-1">
                        <span className="text-gray-400 block text-[11px]">Validity</span>
                        <span className="font-semibold text-gray-900 truncate block mt-0.5">
                          {verificationResult.student.passValidity || 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {verificationResult.reason && (
                  <p className="mt-2 text-gray-600">
                    <strong>Detail:</strong> {verificationResult.reason}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (4 cols): Manual Verification & Policies */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card 1: Manual Pass Entry & Simulator */}
          <Card className="backdrop-blur-xl bg-white/80 border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-gray-900/5 transition-all">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-500" />
                <CardTitle>Manual Pass Entry</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Student ID, Email or QR Token
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 0827CS211001 or student@institution.edu"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeVerify(manualInput)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm sm:text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors bg-white"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => executeVerify(manualInput)}
                    isLoading={verifying}
                  >
                    Verify
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Card 2: Security & Transit Policies */}
          <Card className="backdrop-blur-xl bg-white/80 border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-gray-900/5 transition-all">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-500" />
                <CardTitle>Boarding Policies</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Fast Headcount Mode Toggle */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-900">Fast Headcount Mode</p>
                  <p className="text-[11px] text-gray-500">Auto-increment count on approved scan</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFastMode(!fastMode)}
                  className={`w-10 h-5.5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${fastMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-xs transform transition-transform ${fastMode ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Anti-Passback Same Bus Lock */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-900">Same-Bus Anti-Loop Lock</p>
                  <p className="text-[11px] text-gray-500">Prevent identical pass re-scan on run</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSameBusScanLock(!sameBusScanLock)}
                  className={`w-10 h-5.5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${sameBusScanLock ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-xs transform transition-transform ${sameBusScanLock ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Lockout Duration Input */}
              <div className="pt-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Pass Re-scan Lock Duration
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={tempLockout}
                    onChange={(e) => setTempLockout(e.target.value)}
                    min="1"
                    max="1440"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveLockTimer}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Default: 240 min (4 hours)</p>
              </div>

              {/* Late Boarding Override Toggle */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs font-medium text-gray-900">Late Boarding Override</p>
                  <p className="text-[11px] text-gray-500">Permit check-in after route cutoff</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLateOverride(!lateOverride)}
                  className={`w-10 h-5.5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${lateOverride ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-xs transform transition-transform ${lateOverride ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ─── Bottom Section: Recent Boardings Audit Trail ─── */}
      <Card className="backdrop-blur-xl bg-white/80 border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-gray-900/5 transition-all">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <CardTitle>Recent Boardings</CardTitle>
            <span className="text-xs text-gray-400 font-normal ml-1">Today's Run</span>
            <span className="ml-2 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              {boardingLog.length} Recorded Check-Ins
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleExportCsv}
              disabled={boardingLog.length === 0}
              className="text-xs font-semibold gap-1.5"
            >
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {boardingLog.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 font-medium">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Passenger Name</th>
                    <th className="px-4 py-3">Enrollment / ID</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {boardingLog.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {log.time ? log.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {log.studentName || 'Student'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums text-[11px]">
                        {log.studentId}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {log.routeName || selectedBus?.route || 'Campus Route'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                          {log.method || 'Scanner'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveLog(log)}
                          className="text-gray-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          title="Remove entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-gray-400 space-y-1">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2 stroke-[1.5]" />
              <p className="font-medium text-gray-600">No boardings recorded yet</p>
              <p className="text-gray-400">Validated student passes will appear here in real-time.</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Headcount Reset Confirmation */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={confirmHeadcountReset}
        isLoading={isResetting}
        title="Reset Passenger Count"
        message={`Are you sure you want to reset the onboard passenger count for Bus ${selectedBus?.number} to 0? This will also clear today's boarding list so all passes can be scanned fresh.`}
        confirmText="Reset to 0"
        variant="danger"
      />

      {/* Remove Boarding Log Confirmation */}
      <ConfirmModal
        isOpen={Boolean(logToRemove)}
        onClose={() => setLogToRemove(null)}
        onConfirm={confirmRemoveLog}
        isLoading={isRemovingLog}
        title="Remove Boarding Log"
        message={`Are you sure you want to remove the check-in log for ${logToRemove?.studentName || 'this student'}? Headcount will be decremented if fast-mode is enabled.`}
        confirmText="Remove Entry"
        variant="danger"
      />
    </div>
  );
}
