// src/pages/driver/ScanPass.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, Search, CheckCircle2, XCircle, ArrowLeft, ShieldCheck, 
  Users, Plus, Minus, RotateCcw, Camera, CameraOff, AlertTriangle, 
  Bus, Clock, UserCheck, RefreshCw, Trash2, Lock, ArrowRight, Check, Upload
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { decodeQrFromImageFile } from '../../services/qrDecoder';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeToBuses, updateBusHeadcount, incrementBusHeadcount } from '../../services/transit';
import { getStudentProfile } from '../../services/students';
import { logBoarding } from '../../services/transit';
import { db, collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, increment } from '../../config/firebase';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
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
  const [cameraError, setCameraError] = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [scanLockActive, setScanLockActive] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Results & Boarding Log
  const [lastScanResult, setLastScanResult] = useState(null);
  const [recentBoardings, setRecentBoardings] = useState([]);

  // Anti-passback cooldown cache (studentId -> timestamp)
  const localScanLogs = useRef({});
  const html5QrScannerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Audio Feedback
  const playAudioTone = (type) => {
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

  // 1. Subscribe to buses list & auto-select driver's assigned bus
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

  // 4. Camera Scanner Lifecycle
  const startCamera = async () => {
    setCameraError('');
    try {
      if (html5QrScannerRef.current) {
        try { await html5QrScannerRef.current.stop(); } catch (e) { /* ignore */ }
      }

      const qrScanner = new Html5Qrcode("driver-qr-viewfinder");
      html5QrScannerRef.current = qrScanner;

      const config = {
        fps: 15,
        qrbox: (w, h) => {
          const edge = Math.min(w, h);
          const size = Math.max(180, Math.floor(edge * 0.75));
          return { width: size, height: size };
        }
      };

      await qrScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleScannedData(decodedText);
        },
        () => { /* silent frame errors */ }
      );
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera scanner failed to start:", err);
      setCameraError(err.message || 'Camera access denied or unavailable.');
      setIsCameraActive(false);
      showError("Could not access camera. You can use manual entry below.");
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
  };

  useEffect(() => {
    return () => {
      if (html5QrScannerRef.current) {
        html5QrScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // 5. Fast Headcount Real-Time Controls
  const handleHeadcountChange = async (delta) => {
    if (!selectedBusId) return;
    const current = Number(headcount) || 0;
    const maxCap = Number(capacity) || 45;
    const next = Math.min(maxCap, Math.max(0, current + delta));

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
    if (!window.confirm("Reset headcount for this bus back to 0?")) return;
    try {
      await updateBusHeadcount(selectedBusId, 0, capacity);
      showSuccess("Headcount reset to 0.");
    } catch (err) {
      showError("Could not reset headcount: " + err.message);
    }
  };

  // 6. QR Code Image File Upload with Multi-Engine Fallback
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

  // 7. Core Verification
  const executeVerification = async (rawQuery) => {
    const query = (rawQuery || studentIdInput).trim();
    if (!query) return;

    // Check-out mode
    if (scanMode === 'checkout') {
      await handleHeadcountChange(-1);
      showSuccess("Passenger Check-Out recorded (-1)");
      playAudioTone('success');
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
      playAudioTone('error');
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
        playAudioTone('error');
        setLastScanResult({
          status: 'rejected',
          reason: `Student pass not found for: "${lookupKey}".`,
          recommendation: 'Check enrollment number or student app.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        showError("Invalid Pass: Record not found");
        return;
      }

      // Cryptographic TOTP Verification
      if (studentPayload) {
        if (!studentPayload.totp) {
          playAudioTone('error');
          setLastScanResult({
            status: 'rejected',
            reason: 'Legacy static QR passes are rejected for security.',
            recommendation: 'Passenger must present the dynamic rotating pass from their portal.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          showError("Legacy pass rejected. Dynamic pass required.");
          return;
        }

        const secret = student.qrSecret;
        if (!secret) {
          playAudioTone('error');
          setLastScanResult({
            status: 'rejected',
            reason: 'Student profile lacks cryptographic QR secret.',
            recommendation: 'Transport coordinator must regenerate student QR secret.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          showError("Invalid Pass: Secret not provisioned");
          return;
        }

        const isValidTotp = await verifyTotp(studentPayload.totp, secret);
        if (!isValidTotp) {
          playAudioTone('error');
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
        playAudioTone('error');
        setLastScanResult({
          status: 'rejected',
          student,
          reason: `Anti-Loop Scan Lock Active: Pass scanned ${Math.round((now - lastScanned) / 60000)}m ago.`,
          recommendation: `Same pass re-scan blocked for ${remainingMinutes}m.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        showError(`Anti-Loop Lock: Already checked in`);
        return;
      }

      // Success!
      playAudioTone('success');
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
      playAudioTone('error');
      setLastScanResult({
        status: 'rejected',
        reason: err.message,
        recommendation: 'Check connection.',
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
      {/* Return to Dashboard */}
      <div className="flex items-center justify-between">
        <Link to="/driver/dashboard" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Duty Dashboard</span>
        </Link>
      </div>

      <PageHeader
        title="Driver Pass Scanner & Passenger Management"
        subtitle={`Active Run: Bus ${activeBusData?.number || '—'} (${activeBusData?.route || 'Campus Express'})`}
      />

      {/* ─── PASSENGER MANAGEMENT CARD (Matching Screenshot) ─── */}
      <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Bus className="w-5 h-5 text-blue-600" />
            <span>Passenger Management</span>
          </h3>
          <span className="bg-blue-50 border border-blue-200/70 text-blue-700 px-3.5 py-1 rounded-full text-xs font-bold shadow-2xs">
            Capacity: {capacity}
          </span>
        </div>

        {/* Bus Selector */}
        <div>
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
            Select Fleet Bus Run *
          </label>
          <select
            value={selectedBusId}
            onChange={(e) => setSelectedBusId(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 focus:border-blue-600 bg-white text-sm font-bold text-slate-800 rounded-2xl outline-none transition-all shadow-2xs focus:ring-2 focus:ring-blue-500/20"
          >
            {buses.map(b => (
              <option key={b.id} value={b.id}>
                Bus {b.number} {b.route ? `— ${b.route}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Telemetry Strip */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100/80 rounded-2xl text-center">
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Bus Driver</p>
            <p className="text-xs font-bold text-slate-800 truncate">{activeBusData?.driver || profile?.name || 'Driver'}</p>
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Conductor</p>
            <p className="text-xs font-bold text-slate-800 truncate">{activeBusData?.conductor || 'Staff'}</p>
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider mb-0.5">Sync Status</p>
            <p className="text-xs font-extrabold text-emerald-600 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              <span>LIVE</span>
            </p>
          </div>
        </div>

        {/* Anti-Loop Scan Lock Alert Banner */}
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold uppercase tracking-wider text-indigo-700 text-[10px]">Anti-Loop Scan Lock</p>
              <p className="font-bold text-slate-700 mt-0.5">Enabled for same bus pass scans</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-extrabold text-indigo-800 text-sm">240 min</p>
            <p className="text-[10px] text-slate-400 font-medium">Timer</p>
          </div>
        </div>

        {/* Current Headcount Controls */}
        <div className="text-center py-5 bg-slate-50 border border-slate-150/70 rounded-2xl">
          <div className="text-[10px] tracking-wider uppercase text-slate-400 font-extrabold mb-3">
            Current Headcount
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleHeadcountChange(-1)}
              disabled={headcount <= 0}
              className="w-12 h-12 rounded-full border border-slate-200 bg-white text-2xl font-bold flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:border-blue-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
            >
              −
            </button>
            <input
              type="number"
              readOnly
              value={headcount}
              className="w-24 text-center border border-slate-200 rounded-2xl font-extrabold text-3xl py-2 bg-white text-slate-900 shadow-inner"
            />
            <button
              type="button"
              onClick={() => handleHeadcountChange(1)}
              disabled={headcount >= capacity}
              className="w-12 h-12 rounded-full border border-slate-200 bg-white text-2xl font-bold flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:border-blue-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleHeadcountReset}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-5 rounded-2xl h-12 flex items-center justify-center active:scale-95 transition-colors shadow-sm cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ─── LIVE SCANNER & RECENT BOARDINGS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Scanner & Mode Switcher */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <span>Live QR Camera Scanner</span>
              </h3>
              <div className="flex items-center gap-2">
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
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Upload a QR pass image from disk"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>{uploadingImage ? 'Scanning Image...' : 'Upload QR Image'}</span>
                </button>
                <span className="flex items-center gap-1.5 text-xs font-bold pl-1">
                  <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  <span className={isCameraActive ? 'text-emerald-600' : 'text-slate-400'}>
                    {isCameraActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </span>
              </div>
            </div>

            {/* Scan Mode Switcher */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60 text-xs font-bold">
              <button
                type="button"
                onClick={() => setScanMode('checkin')}
                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanMode === 'checkin'
                    ? 'bg-white text-emerald-600 shadow-sm border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Check-In</span>
              </button>

              <button
                type="button"
                onClick={() => setScanMode('checkout')}
                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanMode === 'checkout'
                    ? 'bg-white text-amber-600 shadow-sm border border-amber-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Check-Out</span>
              </button>

              <button
                type="button"
                onClick={() => setScanMode('verify')}
                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanMode === 'verify'
                    ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Verify Only</span>
              </button>
            </div>

            {/* Viewfinder */}
            <ValidateBusPassScanner
              elementId="driver-qr-viewfinder"
              isCameraActive={isCameraActive}
              onStartCamera={startCamera}
              onStopCamera={stopCamera}
              cameraError={cameraError}
              title="Validate Student Bus Pass"
            />

            {/* Manual Fallback */}
            <form onSubmit={(e) => { e.preventDefault(); executeVerification(); }} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter enrollment, ID, or student email..."
                value={studentIdInput}
                onChange={(e) => setStudentIdInput(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-xs font-bold rounded-2xl outline-none focus:border-blue-600 transition-all bg-white"
              />
              <Button type="submit" variant="secondary" size="md" icon={Search} isLoading={verifying} className="rounded-2xl px-5">
                Verify
              </Button>
            </form>

            {/* Scan Result Banner */}
            {lastScanResult && (
              <div className={`p-4 rounded-2xl border text-xs transition-all ${
                lastScanResult.status === 'approved'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {lastScanResult.status === 'approved' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <span className="font-extrabold tracking-wider uppercase">
                    {lastScanResult.status === 'approved' 
                      ? (scanMode === 'checkin' ? 'PASS APPROVED — BOARDING CONFIRMED (+1)' : 'PASS VERIFIED ACTIVE')
                      : 'PASS REJECTED — BOARDING DENIED'}
                  </span>
                </div>

                {lastScanResult.student && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Student</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">{lastScanResult.student.name}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">ID / Enroll</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">{lastScanResult.student.collegeId || lastScanResult.student.enrollment}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Route</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">{lastScanResult.route}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Bus Assigned</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">{lastScanResult.bus}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 cols: Live Boarding List */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-teal-600" />
                <span>Recent Boardings</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                {recentBoardings.length} Riders
              </span>
            </div>

            <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1">
              {recentBoardings.map((b) => (
                <div
                  key={b.id}
                  className="p-3 bg-slate-50/70 hover:bg-slate-100 border border-slate-200/70 rounded-2xl flex items-center justify-between gap-2 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate">{b.studentName}</span>
                      <span className="font-mono text-[10px] text-blue-600 font-bold">{b.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 truncate">
                      <span>ID: {b.studentId}</span>
                      <span>•</span>
                      <span>{b.routeName || 'Campus Express'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveBoarding(b)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
                    title="Remove from boarding list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {recentBoardings.length === 0 && (
                <div className="text-center py-16 text-slate-400 space-y-2 text-xs font-medium">
                  <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div>No passengers boarded yet</div>
                  <p className="text-[11px] text-slate-400">
                    Scanned passes will appear here in real time.
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
