// src/pages/driver/ScanPass.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, Search, CheckCircle2, XCircle, ArrowLeft, ShieldCheck, 
  Users, Plus, Minus, RotateCcw, Camera, CameraOff, AlertTriangle, 
  Bus, Clock, UserCheck, RefreshCw, Trash2, Lock, ArrowRight, Check, Upload, Download,
  Radio, Sparkles, Filter, ChevronRight, Zap, Shield, User, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { decodeQrFromImageFile } from '../../services/qrDecoder';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToBuses, updateBusHeadcount, incrementBusHeadcount, logBoarding } from '../../services/transit';
import { getStudentProfile } from '../../services/students';
import { db, collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from '../../config/firebase';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/layout/PageHeader';
import { ValidateBusPassScanner } from '../../components/domain/ValidateBusPassScanner';
import { verifyTotp } from '../../utils/crypto';

export function DriverScanPass() {
  const { profile, user } = useAuth();
  const { tenantKey } = useTenant();
  const { showSuccess, showError, showWarning } = useToast();

  // Fleet & Active Bus State
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [activeBusData, setActiveBusData] = useState(null);

  // Fast Headcount State
  const [headcount, setHeadcount] = useState(0);
  const [capacity, setCapacity] = useState(45);

  // Scan Mode: 'checkin' | 'checkout' | 'verify'
  const [scanMode, setScanMode] = useState('checkin');

  // Scanner & Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraFacing, setCameraFacing] = useState('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [studentIdInput, setStudentIdInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [scanLockActive, setScanLockActive] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Results & Boarding Log
  const [lastScanResult, setLastScanResult] = useState(null);
  const [recentBoardings, setRecentBoardings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Anti-passback cooldown cache (studentId -> timestamp)
  const localScanLogs = useRef({});
  const html5QrScannerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Multi-sensory feedback: Audio + Haptic
  const triggerFeedback = (type) => {
    // 1. Haptic Vibration (Supported mobile browsers)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        if (type === 'success') navigator.vibrate([60, 30, 60]);
        else navigator.vibrate([180, 80, 180]);
      } catch (e) {}
    }

    // 2. Web Audio Tone (Zero external audio file latency)
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
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
        osc.start(); osc.stop(ctx.currentTime + 0.28);
      } else {
        osc.frequency.setValueAtTime(220.00, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) { /* audio muted */ }
  };

  // 1. Subscribe to fleet buses & auto-select driver's assigned vehicle
  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      if (list.length > 0 && !selectedBusId) {
        const myEmail = profile?.email?.toLowerCase();
        const myBus = list.find(b =>
          (b.driverEmails && b.driverEmails.includes(myEmail)) ||
          (b.driver && b.driver.toLowerCase() === profile?.name?.toLowerCase()) ||
          (profile?.assignedBus && b.number === profile.assignedBus)
        ) || list[0];
        setSelectedBusId(myBus.id);
      }
    });
    return () => unsub();
  }, [profile]);

  // 2. Real-time active bus listener
  useEffect(() => {
    if (!selectedBusId) return;
    const busRef = doc(db, 'buses', selectedBusId);
    const unsub = onSnapshot(busRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setActiveBusData(data);
        setHeadcount(data.headcount || 0);
        setCapacity(data.capacity || 45);
      }
    }, (err) => {
      console.error("Error listening to bus headcount:", err);
    });

    return () => unsub();
  }, [selectedBusId]);

  // 3. Real-time subscription to today's boardings for selected bus
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
          } catch (e) { /* use now */ }
          list.push({ id: docSnap.id, ...data, time });
        }
      });
      list.sort((a, b) => b.time - a.time);
      setRecentBoardings(list);
    }, (err) => {
      console.warn("Boardings subscription error:", err);
    });

    return () => unsub();
  }, [selectedBusId]);

  // 4. Camera Scanner Lifecycle with Camera Switching & Torch
  const startCamera = async (facing = cameraFacing) => {
    setCameraError('');
    setCameraLoading(true);
    try {
      if (html5QrScannerRef.current) {
        try { await html5QrScannerRef.current.stop(); } catch (e) {}
      }

      const qrScanner = new Html5Qrcode("driver-qr-viewfinder");
      html5QrScannerRef.current = qrScanner;

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 1) {
          setHasMultipleCameras(true);
        }
      } catch (e) {}

      const config = {
        fps: 15,
        qrbox: (w, h) => {
          const edge = Math.min(w, h);
          const size = Math.max(180, Math.floor(edge * 0.75));
          return { width: size, height: size };
        }
      };

      await qrScanner.start(
        { facingMode: facing },
        config,
        (decodedText) => {
          handleScannedData(decodedText);
        },
        () => { /* silent frame loop */ }
      );
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera scanner failed to start:", err);
      setCameraError(err.message || 'Camera access denied or unavailable.');
      setIsCameraActive(false);
      showError("Could not access camera. You can use manual entry below.");
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

  // 5. Headcount Management
  const handleHeadcountChange = async (delta) => {
    if (!selectedBusId) return;
    const current = Number(headcount) || 0;
    const maxCap = Number(capacity) || 45;

    if (delta > 0 && current >= maxCap) {
      showWarning(`Vehicle full: capacity ${maxCap} reached.`);
      return;
    }

    try {
      await incrementBusHeadcount(selectedBusId, delta, maxCap);
    } catch (err) {
      showError("Headcount sync failed: " + err.message);
    }
  };

  const handleHeadcountReset = async () => {
    if (!selectedBusId) return;
    if (!window.confirm("Reset passenger headcount for this bus back to 0?")) return;
    try {
      await updateBusHeadcount(selectedBusId, 0, capacity);
      showSuccess("Headcount reset to 0.");
    } catch (err) {
      showError("Could not reset headcount: " + err.message);
    }
  };

  // 6. QR Code Image File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const decodedText = await decodeQrFromImageFile(file);
      showSuccess('QR Code successfully decoded from image!');
      await handleScannedData(decodedText);
    } catch (err) {
      console.warn("Driver QR file scan error:", err);
      showError(err.message || "Could not read a QR code from this image. Please ensure the QR is clear and visible.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 7. Anti-Flood QR Scan Throttle
  const handleScannedData = async (decodedText) => {
    if (scanLockActive) return;
    setScanLockActive(true);
    setTimeout(() => setScanLockActive(false), 2000);

    await executeVerification(decodedText);
  };

  // 8. Core Verification Engine
  const executeVerification = async (rawQuery) => {
    const query = (rawQuery || studentIdInput).trim();
    if (!query) return;

    // Check-out mode
    if (scanMode === 'checkout') {
      await handleHeadcountChange(-1);
      showSuccess("Passenger Check-Out recorded (-1)");
      triggerFeedback('success');
      setLastScanResult({
        status: 'approved',
        reason: 'Passenger checked out successfully. Headcount reduced by 1.',
        student: { name: 'Passenger Check-Out', collegeId: query },
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      return;
    }

    // Capacity Pre-check
    if (scanMode === 'checkin' && headcount >= capacity) {
      triggerFeedback('error');
      setLastScanResult({
        status: 'rejected',
        reason: `Capacity Reached (${headcount}/${capacity})`,
        recommendation: 'Vehicle full. Passenger cannot board.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      showError("Bus is at maximum capacity!");
      return;
    }

    setVerifying(true);
    setLastScanResult(null);

    try {
      let lookupKey = query;
      let studentPayload = null;

      if (query.startsWith('{') && query.endsWith('}')) {
        try {
          studentPayload = JSON.parse(query);
          lookupKey = studentPayload.email || studentPayload.studentId || studentPayload.collegeId || studentPayload.enrollment || studentPayload.id || query;
        } catch (e) { /* fallback */ }
      }

      let student = await getStudentProfile(lookupKey);
      if (!student && studentPayload) {
        if (studentPayload.studentId && studentPayload.studentId !== lookupKey) {
          student = await getStudentProfile(studentPayload.studentId);
        }
        if (!student && studentPayload.email && studentPayload.email !== lookupKey) {
          student = await getStudentProfile(studentPayload.email);
        }
      }

      if (!student) {
        triggerFeedback('error');
        setLastScanResult({
          status: 'rejected',
          reason: `Student pass not found for: "${lookupKey}".`,
          recommendation: 'Verify enrollment number or institutional email.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        showError("Invalid Pass: Record not found");
        return;
      }

      // Cryptographic TOTP Verification
      if (studentPayload) {
        if (!studentPayload.totp) {
          triggerFeedback('error');
          setLastScanResult({
            status: 'rejected',
            reason: 'Legacy static QR passes are rejected for transit security.',
            recommendation: 'Passenger must present their rotating digital pass from the student portal.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          showError("Legacy pass rejected. Dynamic pass required.");
          return;
        }

        const secret = student.qrSecret;
        if (!secret) {
          triggerFeedback('error');
          setLastScanResult({
            status: 'rejected',
            reason: 'Student profile lacks cryptographic QR secret.',
            recommendation: 'Transport coordinator must regenerate student QR credentials.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          showError("Invalid Pass: Secret not provisioned");
          return;
        }

        const isValidTotp = await verifyTotp(studentPayload.totp, secret);
        if (!isValidTotp) {
          triggerFeedback('error');
          setLastScanResult({
            status: 'rejected',
            reason: 'Cryptographic pass verification failed (Expired or Forged token).',
            recommendation: 'Ask passenger to refresh their digital pass screen.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          showError("Pass Verification Failed: Token Expired or Forged");
          return;
        }
      }

      const sId = student.collegeId || student.enrollment || student.id || student.email;
      const now = Date.now();
      const lastScanned = localScanLogs.current[sId] || 0;
      const lockoutMs = 240 * 60 * 1000;

      if ((now - lastScanned) < lockoutMs) {
        const remainingMinutes = Math.ceil((lockoutMs - (now - lastScanned)) / (60 * 1000));
        triggerFeedback('error');
        setLastScanResult({
          status: 'rejected',
          student,
          reason: `Anti-Loop Scan Lock Active: Pass scanned ${Math.round((now - lastScanned) / 60000)}m ago.`,
          recommendation: `Same pass re-scan blocked for ${remainingMinutes}m on this bus run.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        showError(`Anti-Loop Lock: Already checked in`);
        return;
      }

      // Success!
      triggerFeedback('success');
      localScanLogs.current[sId] = now;

      setLastScanResult({
        status: 'approved',
        student,
        route: student.busRoute || activeBusData?.route || 'Campus Express',
        bus: activeBusData?.number || 'Bus',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      if (scanMode === 'checkin') {
        await handleHeadcountChange(1);

        const dateStr = new Date().toISOString().split('T')[0];
        const boardingRef = doc(db, `buses/${selectedBusId}/boardings`, `${sId}_${dateStr}_${Date.now()}`);
        await setDoc(boardingRef, {
          studentId: sId,
          studentName: student.name,
          studentEmail: student.email || '',
          busId: selectedBusId,
          busNumber: activeBusData?.number || '',
          routeName: activeBusData?.route || student.busRoute || '',
          checkInTime: serverTimestamp(),
          date: dateStr,
          method: studentPayload ? 'QR Camera' : 'Manual Entry'
        }, { merge: true });

        await logBoarding({
          studentEmail: student.email || sId,
          studentName: student.name,
          busId: selectedBusId,
          busNumber: activeBusData?.number || '',
          route: activeBusData?.route || student.busRoute || '',
          timestamp: new Date().toISOString()
        });

        showSuccess(`Verified: ${student.name} (+1)`);
      } else {
        showSuccess(`Verified: ${student.name}`);
      }

      setStudentIdInput('');
    } catch (err) {
      console.error("Verification error:", err);
      triggerFeedback('error');
      setLastScanResult({
        status: 'rejected',
        reason: err.message,
        recommendation: 'Check connection or retry verification.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      showError("Scan error: " + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveBoarding = async (boardingItem) => {
    if (!window.confirm(`Remove ${boardingItem.studentName} from this run?`)) return;
    try {
      const bRef = doc(db, `buses/${selectedBusId}/boardings`, boardingItem.id);
      await deleteDoc(bRef);
      await handleHeadcountChange(-1);
      delete localScanLogs.current[boardingItem.studentId];
      showSuccess("Passenger removed.");
    } catch (err) {
      showError("Could not remove passenger: " + err.message);
    }
  };

  const handleExportCsv = () => {
    if (recentBoardings.length === 0) {
      showError("No recent boarding records available to export.");
      return;
    }

    const busNum = activeBusData?.number || 'Bus';
    const dateStr = new Date().toISOString().split('T')[0];

    const headers = [
      'Student ID',
      'Passenger Name',
      'Bus Number',
      'Route Name',
      'Check-In Date',
      'Check-In Time'
    ];

    const rows = recentBoardings.map((b) => {
      const timeStr = b.time instanceof Date && !isNaN(b.time)
        ? b.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—';
      const dateVal = b.date || (b.time instanceof Date && !isNaN(b.time) ? b.time.toISOString().split('T')[0] : dateStr);

      return [
        `"${String(b.studentId || '').replace(/"/g, '""')}"`,
        `"${String(b.studentName || 'Student').replace(/"/g, '""')}"`,
        `"${String(activeBusData?.number || '').replace(/"/g, '""')}"`,
        `"${String(b.routeName || activeBusData?.route || 'Campus Express').replace(/"/g, '""')}"`,
        `"${dateVal}"`,
        `"${timeStr}"`
      ].join(',');
    });

    const csvContent = `${headers.join(',')}\n${rows.join('\n')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cambus_driver_boardings_bus_${busNum}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess(`Exported ${recentBoardings.length} boarding records to CSV`);
  };

  // Filtered boardings list
  const filteredBoardings = recentBoardings.filter(b => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (b.studentName && b.studentName.toLowerCase().includes(term)) ||
      (b.studentId && b.studentId.toLowerCase().includes(term)) ||
      (b.routeName && b.routeName.toLowerCase().includes(term))
    );
  });

  const occupancyPercent = capacity > 0 ? Math.min(100, Math.round((headcount / capacity) * 100)) : 0;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 font-sans relative">
      {/* Decorative ambient background */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/70 via-slate-50/30 to-transparent pointer-events-none" />

      {/* ─── Breadcrumb & Quick Return ─── */}
      <div className="flex items-center justify-between">
        <Link to="/driver/dashboard" className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Duty Dashboard</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Driver Scanner HUD
        </span>
      </div>

      {/* ─── TOP VEHICLE OCCUPANCY & RUN COMMAND BAR ─── */}
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Vehicle Selector & Run Details */}
          <div className="lg:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bus className="w-3.5 h-3.5 text-blue-600" />
                <span>Active Bus Run</span>
              </label>
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span>Live GPS</span>
              </span>
            </div>
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-2xl text-xs sm:text-sm font-extrabold text-slate-800 outline-none transition-all cursor-pointer"
            >
              {buses.map(b => (
                <option key={b.id} value={b.id}>
                  Bus {b.number} {b.route ? `— ${b.route}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Occupancy Progress Bar */}
          <div className="lg:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Vehicle Occupancy</span>
              </span>
              <span className={`font-mono ${occupancyPercent >= 90 ? 'text-rose-600' : (occupancyPercent >= 75 ? 'text-amber-600' : 'text-slate-900')}`}>
                {headcount} / {capacity} seats ({occupancyPercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  occupancyPercent >= 90 ? 'bg-rose-500' : (occupancyPercent >= 75 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600')
                }`}
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>
          </div>

          {/* Quick Headcount Micro-Steppers */}
          <div className="lg:col-span-3 flex items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <button
              type="button"
              onClick={() => handleHeadcountChange(-1)}
              disabled={headcount <= 0}
              className="h-10 w-10 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-lg font-bold flex items-center justify-center text-slate-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Decrease Headcount (-1)"
            >
              −
            </button>
            <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl text-center min-w-[56px]">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 block tracking-wider">Count</span>
              <span className="font-extrabold text-base text-slate-900 leading-none">{headcount}</span>
            </div>
            <button
              type="button"
              onClick={() => handleHeadcountChange(1)}
              disabled={headcount >= capacity}
              className="h-10 w-10 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-lg font-bold flex items-center justify-center text-slate-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Increase Headcount (+1)"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleHeadcountReset}
              className="h-10 px-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title="Reset Headcount to 0"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN COCKPIT: TOP-FIXED SCANNER (LEFT) & BOARDINGS FEED (RIGHT) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ─── LEFT COLUMN: TOP-FIXED QR SCANNER & INSTANT VERIFICATION ─── */}
        <div className="lg:col-span-5 lg:sticky lg:top-4 z-20 space-y-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/80 space-y-4">
            
            {/* Scanner Header & Upload Trigger */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    QR Camera Scanner
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Top-Fixed Instant HUD</p>
                </div>
              </div>

              {/* Upload QR Image */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Upload QR screenshot from disk"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>{uploadingImage ? 'Decoding...' : 'Upload Image'}</span>
              </button>
            </div>

            {/* Scan Mode Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 text-xs font-bold">
              <button
                type="button"
                onClick={() => setScanMode('checkin')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanMode === 'checkin'
                    ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Check-In (+1)</span>
              </button>

              <button
                type="button"
                onClick={() => setScanMode('checkout')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanMode === 'checkout'
                    ? 'bg-white text-amber-700 shadow-sm border border-amber-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Check-Out (-1)</span>
              </button>

              <button
                type="button"
                onClick={() => setScanMode('verify')}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanMode === 'verify'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Verify Only</span>
              </button>
            </div>

            {/* ─── Compact Top-Fixed Viewfinder Component ─── */}
            <div className="relative">
              <ValidateBusPassScanner
                elementId="driver-qr-viewfinder"
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

            {/* Manual Pass Entry */}
            <form onSubmit={(e) => { e.preventDefault(); executeVerification(); }} className="space-y-2">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter Student ID, email, or token..."
                    value={studentIdInput}
                    onChange={(e) => setStudentIdInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 text-xs font-bold rounded-2xl outline-none transition-all placeholder:text-slate-400"
                  />
                  {studentIdInput && (
                    <button
                      type="button"
                      onClick={() => setStudentIdInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm" 
                  icon={Search} 
                  isLoading={verifying} 
                  className="rounded-2xl px-4 font-bold text-xs shadow-sm shadow-blue-500/20"
                >
                  Verify
                </Button>
              </div>

              {/* Demo Student Test Shortcut */}
              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStudentIdInput('nayan@indoreinstitute.com');
                    executeVerification('nayan@indoreinstitute.com');
                  }}
                  className="text-blue-600 hover:text-blue-700 font-bold hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Run Demo Student Pass (nayan@indoreinstitute.com)</span>
                </button>
                <span className="text-slate-400 font-medium">240m anti-passback active</span>
              </div>
            </form>

            {/* ─── Real-Time Scan Result HUD Banner ─── */}
            {lastScanResult && (
              <div className={`p-4 rounded-2xl border text-xs transition-all animate-fadeIn ${
                lastScanResult.status === 'approved'
                  ? 'bg-gradient-to-br from-emerald-50 to-teal-50/70 border-emerald-300 text-emerald-950 shadow-sm'
                  : 'bg-gradient-to-br from-rose-50 to-red-50/70 border-rose-300 text-rose-950 shadow-sm'
              }`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {lastScanResult.status === 'approved' ? (
                      <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <XCircle className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <span className="font-black tracking-wider uppercase text-xs block">
                        {lastScanResult.status === 'approved' 
                          ? (scanMode === 'checkin' ? 'PASS APPROVED — BOARDING CONFIRMED (+1)' : 'PASS VERIFIED ACTIVE')
                          : 'PASS REJECTED — BOARDING DENIED'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {lastScanResult.time}
                      </span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setLastScanResult(null)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {lastScanResult.reason && (
                  <p className="text-xs font-semibold mb-2 text-slate-700">
                    {lastScanResult.reason}
                  </p>
                )}

                {lastScanResult.student && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">Passenger</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">{lastScanResult.student.name}</span>
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">Student ID</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">{lastScanResult.student.collegeId || lastScanResult.student.enrollment || '—'}</span>
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">Assigned Route</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">{lastScanResult.route || activeBusData?.route || 'Campus Line'}</span>
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">Assigned Bus</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">Bus {activeBusData?.number || '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ─── RIGHT COLUMN: RECENT BOARDINGS FEED & CSV EXPORT ─── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/80 space-y-4">
            
            {/* Header: Title, Count Badge, Export CSV */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Recent Boardings
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Today's Run Ledger</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  {recentBoardings.length} Boarded
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  icon={Download}
                  onClick={handleExportCsv}
                  disabled={recentBoardings.length === 0}
                  className="text-xs font-bold py-1.5 px-3 rounded-xl gap-1.5 border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Live Search Filter for Boarded Students */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search boarded passenger by name, ID, or route..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Passenger Boarding List */}
            <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100/60">
              {filteredBoardings.map((b) => {
                const initials = (b.studentName || 'S')
                  .split(' ')
                  .map(part => part[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const timeFormatted = b.time instanceof Date && !isNaN(b.time)
                  ? b.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '—';

                return (
                  <div
                    key={b.id}
                    className="pt-2.5 first:pt-0 p-3 bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/70 rounded-2xl flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Initials Avatar */}
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900 truncate">
                            {b.studentName || 'Student'}
                          </span>
                          <span className="font-mono text-[11px] text-blue-600 font-extrabold shrink-0">
                            {timeFormatted}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 truncate">
                          <span className="font-semibold text-slate-700">ID: {b.studentId || '—'}</span>
                          <span>•</span>
                          <span className="truncate">{b.routeName || activeBusData?.route || 'Campus Line'}</span>
                          {b.method && (
                            <>
                              <span>•</span>
                              <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                                {b.method}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete / Undo Check-in */}
                    <button
                      type="button"
                      onClick={() => handleRemoveBoarding(b)}
                      className="opacity-40 group-hover:opacity-100 p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0 cursor-pointer"
                      title="Undo check-in for this passenger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {filteredBoardings.length === 0 && recentBoardings.length > 0 && (
                <div className="text-center py-10 text-slate-400 space-y-1 text-xs">
                  <Filter className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                  <p className="font-bold">No passengers match "{searchTerm}"</p>
                  <p className="text-[11px] text-slate-400">Clear filter to see all boarded students</p>
                </div>
              )}

              {recentBoardings.length === 0 && (
                <div className="text-center py-16 text-slate-400 space-y-2 text-xs font-medium">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 border border-slate-200">
                    <UserCheck className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="font-extrabold text-slate-700 text-sm">No Passengers Boarded Yet</div>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Scanned student QR bus passes will appear in this real-time run ledger.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
