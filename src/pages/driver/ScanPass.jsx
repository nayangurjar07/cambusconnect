// src/pages/driver/ScanPass.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  RotateCcw,
  ShieldCheck,
  Clock,
  Sparkles,
  Upload,
  ArrowLeft,
  Users
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeToBuses,
  updateBusHeadcount,
  incrementBusHeadcount,
  logBoarding
} from '../../services/transit';
import { getStudentProfile } from '../../services/students';
import { verifyTotp } from '../../utils/crypto';
import { db, collection, doc, getDoc, getDocs, onSnapshot, setDoc, writeBatch, serverTimestamp } from '../../config/firebase';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ValidateBusPassScanner } from '../../components/domain/ValidateBusPassScanner';

export function DriverScanPass() {
  const { user, profile } = useAuth();
  const { tenantKey } = useTenant();
  const { showSuccess, showError, showWarning } = useToast();
  const navigate = useNavigate();

  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');

  // Policies & Controls
  const [fastMode, setFastMode] = useState(() => {
    const saved = localStorage.getItem('driver_fast_mode');
    return saved !== null ? saved === 'true' : true;
  });
  const [sameBusScanLock, setSameBusScanLock] = useState(true);
  const [lockoutMinutes, setLockoutMinutes] = useState(180);

  const handleToggleFastMode = () => {
    const nextVal = !fastMode;
    setFastMode(nextVal);
    localStorage.setItem('driver_fast_mode', String(nextVal));
    if (nextVal) {
      showSuccess('Fast headcount enabled (Auto +1 on scan)');
    } else {
      showWarning('Fast headcount disabled (Manual counting mode)');
    }
  };

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
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const html5QrScannerRef = useRef(null);
  const localScanLogs = useRef({});
  const autoResetTimerRef = useRef(null);
  const scanLockRef = useRef(false);
  const lastScannedPayloadRef = useRef({ text: '', time: 0 });
  const lastWarningTimeRef = useRef(0);

  // Subtle clean audio feedback
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
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (_) {}
  };

  // 1. Subscribe to fleet buses & auto-select assigned bus
  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      if (!selectedBusId && list.length > 0) {
        const userEmail = user?.email?.toLowerCase().trim();
        const assigned = list.find(
          (b) =>
            String(b.number) === String(user?.assignedBus) ||
            b.id === user?.assignedBusId ||
            b.primaryDriver?.email === userEmail ||
            b.secondaryDriver?.email === userEmail ||
            b.primaryConductor?.email === userEmail ||
            b.secondaryConductor?.email === userEmail
        );
        setSelectedBusId(assigned ? assigned.id : list[0].id);
      }
    });
    return () => unsub();
  }, [user, selectedBusId]);

  const selectedBus = buses.find((b) => b.id === selectedBusId) || buses[0];
  const capacity = Number(selectedBus?.capacity) || 45;
  const currentCount = Number(selectedBus?.headcount) || 0;
  const occupancyPercent = Math.min(100, Math.round((currentCount / capacity) * 100));

  // 2. Real-time subscription to selected bus's boardings
  useEffect(() => {
    if (!selectedBusId) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const boardingsCol = collection(db, `buses/${selectedBusId}/boardings`);

    const unsub = onSnapshot(
      boardingsCol,
      (snap) => {
        const list = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.date === dateStr || docSnap.id.endsWith(`_${dateStr}`)) {
            let time = new Date();
            try {
              if (data.checkInTime?.toDate) time = data.checkInTime.toDate();
              else if (data.checkInTime) time = new Date(data.checkInTime);
            } catch (_) {}
            list.push({ id: docSnap.id, ...data, time });
          }
        });
        list.sort((a, b) => b.time - a.time);
        setBoardingLog(list);
      },
      (err) => {
        console.warn('Boardings subscription warning:', err);
      }
    );

    return () => unsub();
  }, [selectedBusId]);

  // 3. Auto-refresh & continuous scanning: automatically reset verification result after 2.8s
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

  // 4. Camera Scanner Controls with Multi-Camera & Flashlight Support
  const startCamera = async (facing = cameraFacing) => {
    setCameraError('');
    setCameraLoading(true);
    try {
      if (html5QrScannerRef.current) {
        try {
          await html5QrScannerRef.current.stop();
        } catch (_) {}
      }

      const qrScanner = new Html5Qrcode('driver-qr-viewfinder');
      html5QrScannerRef.current = qrScanner;

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 1) {
          setHasMultipleCameras(true);
        }
      } catch (_) {}

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
        () => {}
      );
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera scanner start error:', err);
      setCameraError(err.message || 'Camera access denied or unavailable.');
      setIsCameraActive(false);
      showError('Could not access camera. Please enter pass ID manually.');
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrScannerRef.current) {
      try {
        await html5QrScannerRef.current.stop();
        html5QrScannerRef.current = null;
      } catch (_) {
        html5QrScannerRef.current = null;
      }
    }
    setIsCameraActive(false);
    setTorchActive(false);
  };

  const handleFlipCamera = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
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
    } catch (_) {
      showWarning('Flashlight not supported on this device/camera.');
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrScannerRef.current) {
        html5QrScannerRef.current.stop().catch(() => {});
      }
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    };
  }, []);

  const handleHeadcountChange = async (delta) => {
    if (!selectedBus) return;
    const current = Number(selectedBus.headcount) || 0;
    const cap = Number(selectedBus.capacity) || 45;

    if (delta > 0 && current >= cap) {
      showWarning(`Bus #${selectedBus.number} is full (${current}/${cap}).`);
      return;
    }

    try {
      await incrementBusHeadcount(selectedBus.id, delta, cap);
    } catch (err) {
      showError('Failed to update headcount: ' + err.message);
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
      // 2. Clear the last-scanned payload cooldown so camera accepts fresh scans
      lastScannedPayloadRef.current = { text: '', time: 0 };
      lastWarningTimeRef.current = 0;

      // 3. Batch-delete ALL boarding sub-documents for this bus
      try {
        const boardingsColRef = collection(db, `buses/${selectedBus.id}/boardings`);
        const snap = await getDocs(boardingsColRef);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (cleanupErr) {
        console.warn('[DriverScanPass] Boarding cleanup notice:', cleanupErr);
      }

      showSuccess(`Headcount reset to 0 for Bus #${selectedBus.number} — scan list cleared`);
      setIsResetConfirmOpen(false);
    } catch (err) {
      showError('Failed to reset headcount: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };



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

  // 6. Comprehensive Verification Core (Identical to AdminScanPass)
  const executeVerify = async (rawQuery) => {
    const query = (rawQuery || '').trim();
    if (!query) return;

    const busCapacity = Number(selectedBus?.capacity) || 45;
    const currentHeadcount = Number(selectedBus?.headcount) || 0;

    if (currentHeadcount >= busCapacity) {
      playTone('error');
      setVerificationResult({
        status: 'rejected',
        reason: `Bus #${selectedBus?.number} is at maximum capacity (${currentHeadcount}/${busCapacity}).`,
        recommendation: 'Passenger must board the next available vehicle.'
      });
      showError(`Bus #${selectedBus?.number} is at full capacity`);
      return;
    }

    setVerifying(true);
    setVerificationResult(null);

    try {
      let lookup = query;
      let tokenPayload = null;

      if (query.startsWith('{') && query.endsWith('}')) {
        try {
          tokenPayload = JSON.parse(query);
          lookup =
            tokenPayload.email ||
            tokenPayload.studentId ||
            tokenPayload.collegeId ||
            tokenPayload.enrollment ||
            tokenPayload.id ||
            query;
        } catch (_) {}
      }

      // Campus / Tenant Check
      const activeTenant = (tenantKey || 'iist').toLowerCase();
      const tokenTenant = (tokenPayload?.tenantId || '').toLowerCase();
      const isCrossCampus =
        tokenTenant &&
        tokenTenant !== activeTenant &&
        tokenTenant !== 'default' &&
        !(activeTenant === 'iist' && (tokenTenant === 'indoreinstitute' || tokenTenant.includes('indore')));

      if (isCrossCampus) {
        playTone('error');
        setVerificationResult({
          status: 'rejected',
          reason: `Pass issued for "${tokenPayload.tenantId.toUpperCase()}". Vehicle operates on "${activeTenant.toUpperCase()}".`,
          recommendation: 'Passenger pass is not valid for this campus.'
        });
        showError(`Cross-campus pass rejected (${tokenPayload.tenantId})`);
        return;
      }

      let student = await getStudentProfile(lookup);

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
          reason: `No matching student record found for "${lookup}".`,
          recommendation: 'Verify enrollment ID or register pass in administration portal.'
        });
        showError('Invalid pass: student not found');
        return;
      }

      // Cryptographic TOTP Verification
      if (tokenPayload) {
        if (!tokenPayload.totp) {
          playTone('error');
          setVerificationResult({
            status: 'rejected',
            reason: 'Legacy static QR codes are no longer supported for security.',
            recommendation: 'Ask student to open dynamic pass on their student portal.'
          });
          showError('Legacy pass rejected');
          return;
        }

        const secret = student.qrSecret;
        if (!secret) {
          playTone('error');
          setVerificationResult({
            status: 'rejected',
            reason: 'No cryptographic QR secret provisioned for this student.',
            recommendation: 'Contact administrator to provision pass secret.'
          });
          showError('No cryptographic secret provisioned');
          return;
        }

        const isValidTotp = await verifyTotp(tokenPayload.totp, secret);
        if (!isValidTotp) {
          playTone('error');
          setVerificationResult({
            status: 'rejected',
            reason: 'Cryptographic pass verification failed. The QR code has expired or is invalid.',
            recommendation: 'Ask student to refresh their dynamic QR pass and try again.'
          });
          showError('Pass Expired or Invalid');
          return;
        }
      }

      // Check Assigned Bus
      const studentBus = String(student.busNumber || student.assignedBus || '').trim();
      const currentBusNum = String(selectedBus?.number || '').trim();
      if (studentBus && currentBusNum && studentBus.toLowerCase() !== currentBusNum.toLowerCase()) {
        playTone('error');
        setVerificationResult({
          status: 'rejected',
          student,
          reason: `Assigned to Bus #${studentBus}, but boarding Bus #${currentBusNum}.`,
          recommendation: `Student should board their assigned Bus #${studentBus}.`
        });
        showWarning(`Wrong Bus: Assigned to #${studentBus}`);
        return;
      }

      // Layer 4: Multi-Layer Anti-Passback & Duplicate Guard (Locks same pass re-scans & halts headcount)
      const sId = student.collegeId || student.enrollment || student.id || student.email;
      const cleanStudentKey = String(sId).replace(/[/.]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const shiftId = 'shift_1';
      const antiPassbackDocId = `${dateStr}_${shiftId}_${cleanStudentKey}`;
      const antiPassbackRef = doc(db, 'boarding_logs', antiPassbackDocId);

      if (sameBusScanLock) {
        const lockoutMs = (Number(lockoutMinutes) || 180) * 60 * 1000;
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
            console.warn("[AntiPassback] Firestore check notice:", pbErr);
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
        reason: fastMode ? 'Boarding Authorized (+1 Count)' : 'Boarding Authorized (Manual Count Mode)'
      });

      // 1. Atomic shift anti-passback write (persists lock first)
      try {
        await setDoc(antiPassbackRef, {
          studentId: sId,
          studentName: student.name || 'Student',
          studentEmail: student.email || '',
          busId: selectedBus.id,
          busNumber: selectedBus.number || '',
          driverEmail: user?.email || profile?.email || '',
          driverName: profile?.name || user?.displayName || 'Driver Staff',
          shiftId: shiftId,
          stopName: student.pickupStop || student.stop || '',
          timestamp: serverTimestamp(),
          createdAt: scanNow
        }, { merge: true });
      } catch (apErr) {
        console.warn("[AntiPassback] Firestore write warning:", apErr);
      }

      // 2. Increment headcount ONLY if driver has Fast Headcount enabled!
      if (fastMode) {
        await handleHeadcountChange(1);
      }

      // 3. Bus specific boarding entry
      const logId = `${cleanStudentKey}_${dateStr}_${Date.now()}`;
      const logRef = doc(db, `buses/${selectedBus.id}/boardings`, logId);

      await setDoc(
        logRef,
        {
          studentId: sId,
          studentName: student.name,
          studentEmail: student.email || '',
          busId: selectedBus.id,
          busNumber: selectedBus.number || '',
          routeName: selectedBus.route || student.busRoute || '',
          checkInTime: serverTimestamp(),
          date: dateStr,
          method: tokenPayload ? 'Dynamic QR Scanner' : 'Manual Entry'
        },
        { merge: true }
      );

      await logBoarding({
        studentId: student.studentId || student.enrollmentId || student.enrollment || student.collegeId || student.id || student.email || sId || String(manualInput || ''),
        studentEmail: student.email || '',
        studentName: student.name || 'Student',
        busId: selectedBus?.id || '',
        busNumber: selectedBus?.number || '',
        routeName: selectedBus?.route || student.busRoute || '',
        timestamp: new Date().toISOString()
      });

      showSuccess(`Verified: ${student.name} (+1 Boarded)`);
      setManualInput('');
    } catch (err) {
      console.error('Verification exception:', err);
      showError('Verification failed: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };


  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4 font-sans text-slate-900">

      {/* Page Header — compact on mobile */}
      <PageHeader
        title="Boarding Terminal"
        subtitle={<span className="hidden sm:inline">Optical QR validation, cryptographic auth &amp; live occupancy</span>}
        badge={<Badge variant="primary" dot>Field Ready</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={ArrowLeft} onClick={() => navigate('/driver/dashboard')}>
              <span className="hidden sm:inline">Cockpit</span>
            </Button>
          </div>
        }
      />

      {/* ── Compact Headcount Strip ── */}
      <Card>
        <CardBody className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">Bus #{selectedBus?.number || '—'}</span>
                  <Badge variant="primary" className="text-[10px]">{selectedBus?.route || 'Route'}</Badge>
                </div>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  <strong className="text-slate-800">{currentCount}</strong> / {capacity} seats
                </p>
              </div>
            </div>
            <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border-2 shrink-0 ${
              occupancyPercent >= 90 ? 'bg-rose-50 border-rose-300 text-rose-700' :
              occupancyPercent >= 70 ? 'bg-amber-50 border-amber-300 text-amber-700' :
              'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <span className="text-xl font-black tabular-nums leading-none">{currentCount}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">aboard</span>
            </div>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                occupancyPercent >= 90 ? 'bg-rose-500' : occupancyPercent >= 70 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${occupancyPercent}%` }}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>Bus #{b.number} ({b.headcount || 0}/{b.capacity || 45})</option>
              ))}
            </select>

            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button type="button" onClick={() => handleHeadcountChange(-1)} disabled={currentCount <= 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white active:scale-90 transition-all disabled:opacity-30 cursor-pointer touch-manipulation">
                <Minus className="w-4 h-4 text-slate-700" />
              </button>
              <span className="px-1 text-xs font-black tabular-nums text-slate-800 min-w-[22px] text-center">{currentCount}</span>
              <button type="button" onClick={() => handleHeadcountChange(1)} disabled={currentCount >= capacity}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white active:scale-90 transition-all disabled:opacity-30 cursor-pointer touch-manipulation">
                <Plus className="w-4 h-4 text-blue-600" />
              </button>
              <button type="button" onClick={handleHeadcountReset}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 active:scale-90 transition-all cursor-pointer touch-manipulation">
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            <button type="button" onClick={handleToggleFastMode}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all shrink-0 cursor-pointer touch-manipulation ${
                fastMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-200'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${fastMode ? 'bg-emerald-300 animate-pulse' : 'bg-slate-400'}`} />
              {fastMode ? 'Auto +1' : 'Manual'}
            </button>
          </div>
        </CardBody>
      </Card>

      {/* ── Scanner + Controls Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Scanner Column (full-width on mobile) */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <CardTitle>Optical Pass Scanner</CardTitle>
              </div>
              <Badge variant={isCameraActive ? 'success' : 'neutral'} dot>
                {isCameraActive ? 'Live' : 'Standby'}
              </Badge>
            </CardHeader>
            <CardBody className="p-3 sm:p-5 space-y-3">
              <ValidateBusPassScanner
                elementId="driver-qr-viewfinder"
                isCameraActive={isCameraActive}
                onStartCamera={() => startCamera()}
                onStopCamera={stopCamera}
                cameraLoading={cameraLoading}
                cameraError={cameraError}
                torchActive={torchActive}
                onToggleTorch={handleToggleTorch}
                showTorch={true}
                showFlip={hasMultipleCameras}
                onFlipCamera={handleFlipCamera}
                compact={false}
              />

              {/* Manual entry inline under camera for fast mobile access */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Manual Lookup (Email / Roll No / Pass ID)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 0827CS211001 or student@edu"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeVerify(manualInput)}
                    className="flex-1 px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400 font-medium"
                  />
                  <Button variant="primary" size="sm" onClick={() => executeVerify(manualInput)} isLoading={verifying}>
                    Verify
                  </Button>
                </div>
              </div>
            </CardBody>

            {/* Verification Result */}
            {verificationResult && (
              <div className={`p-4 border-t text-xs transition-colors ${
                verificationResult.status === 'approved'
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/90 border-rose-200 text-rose-950'
              }`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {verificationResult.status === 'approved'
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    }
                    <span className="font-bold text-sm">
                      {verificationResult.status === 'approved' ? 'Pass Approved · Boarding Recorded (+1)' : 'Pass Denied'}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">Auto-reset 3s</span>
                </div>

                {verificationResult.student && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-700 shrink-0">
                        {verificationResult.student.photoURL
                          ? <img src={verificationResult.student.photoURL} alt="" className="w-full h-full object-cover" />
                          : verificationResult.student.name?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Verified Student</span>
                        <h4 className="font-bold text-slate-900 truncate">{verificationResult.student.name}</h4>
                        <p className="text-[11px] text-slate-500 tabular-nums truncate">
                          ID: {verificationResult.student.collegeId || verificationResult.student.enrollment || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'Stop', val: verificationResult.student.pickupStop || verificationResult.student.stop || 'Campus' },
                        { label: 'Route', val: verificationResult.student.busRoute || selectedBus?.route || 'Campus' },
                        { label: 'Valid', val: verificationResult.student.passValidity || 'Active' },
                      ].map(({ label, val }) => (
                        <div key={label} className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-slate-400 block text-[9px] uppercase font-semibold">{label}</span>
                          <span className="font-bold text-slate-900 truncate block mt-0.5 text-[11px]">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {verificationResult.reason && (
                  <p className="mt-2 font-medium text-slate-600"><strong>Detail:</strong> {verificationResult.reason}</p>
                )}
                {verificationResult.recommendation && (
                  <p className="mt-1 text-[11px] text-slate-500"><strong>Action:</strong> {verificationResult.recommendation}</p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Boarding Policy + Log */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <CardTitle>Boarding Policy</CardTitle>
              </div>
              <Badge variant={fastMode ? 'primary' : 'neutral'}>{fastMode ? 'Auto Count' : 'Manual'}</Badge>
            </CardHeader>
            <CardBody className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-900">Fast Headcount Mode</p>
                  <p className="text-[11px] text-slate-500">{fastMode ? 'Auto +1 on valid scan' : 'Manual count mode'}</p>
                </div>
                <button type="button" onClick={handleToggleFastMode}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${fastMode ? 'bg-blue-600' : 'bg-slate-200'}`}
                  aria-label="Toggle Fast Headcount">
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${fastMode ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-900">Anti-Duplicate Lock</p>
                  <p className="text-[11px] text-slate-500">{sameBusScanLock ? 'Rejects repeat same-pass scans' : 'Warning: repeats allowed'}</p>
                </div>
                <button type="button" onClick={() => setSameBusScanLock(!sameBusScanLock)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${sameBusScanLock ? 'bg-blue-600' : 'bg-slate-200'}`}
                  aria-label="Toggle Anti-Duplicate Lock">
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${sameBusScanLock ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <CardTitle>Today's Boardings</CardTitle>
              </div>
              <Badge variant="neutral">{boardingLog.length} recorded</Badge>
            </CardHeader>
            <CardBody className="p-0">
              {boardingLog.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No boardings on Bus #{selectedBus?.number || '—'} today.
                </div>
              ) : (
                <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 text-xs">
                  {boardingLog.slice(0, 15).map((log) => (
                    <div key={log.id} className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                      <div>
                        <p className="font-bold text-slate-900">{log.studentName || 'Student'}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">{log.studentId}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-slate-600 block tabular-nums">
                          {log.time ? log.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-medium">Boarded</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Headcount Reset Confirmation */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={confirmHeadcountReset}
        isLoading={isResetting}
        title="Reset Passenger Count"
        message={`Reset the passenger count for Bus #${selectedBus?.number} to 0? This will also clear today's boarding list so all passes can be scanned fresh.`}
        confirmText="Reset to 0"
        variant="danger"
      />
    </div>
  );
}

export default DriverScanPass;
