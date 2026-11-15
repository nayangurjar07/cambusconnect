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
import { decodeQrFromImageFile } from '../../services/qrDecoder';
import { verifyTotp } from '../../utils/crypto';
import { db, collection, doc, onSnapshot, setDoc, serverTimestamp } from '../../config/firebase';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ValidateBusPassScanner } from '../../components/domain/ValidateBusPassScanner';

export function DriverScanPass() {
  const { user } = useAuth();
  const { tenantKey } = useTenant();
  const { showSuccess, showError, showWarning } = useToast();
  const navigate = useNavigate();

  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');

  // Policies & Controls
  const [fastMode, setFastMode] = useState(true);
  const [sameBusScanLock, setSameBusScanLock] = useState(true);
  const [lockoutMinutes, setLockoutMinutes] = useState(240);

  // Manual & Image Upload State
  const [manualInput, setManualInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleHeadcountReset = async () => {
    if (!selectedBus) return;
    if (!window.confirm(`Reset passenger count for Bus #${selectedBus.number} to 0?`)) return;
    try {
      await updateBusHeadcount(selectedBus.id, 0, Number(selectedBus.capacity) || 45);
      showSuccess(`Headcount reset to 0 for Bus #${selectedBus.number}`);
    } catch (err) {
      showError('Failed to reset headcount: ' + err.message);
    }
  };

  // 5. File Upload QR Scanner
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const decodedText = await decodeQrFromImageFile(file);
      showSuccess('QR Code successfully decoded from image!');
      await handleScannedData(decodedText);
    } catch (err) {
      showError(err.message || 'Could not read a QR code from this image.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleScannedData = async (rawInput) => {
    if (scanLockActive) return;
    setScanLockActive(true);
    setTimeout(() => setScanLockActive(false), 2000);

    await executeVerify(rawInput);
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

      // Anti-Passback / Same Bus Lock
      const sId = student.collegeId || student.enrollment || student.id || student.email;
      const now = Date.now();
      const lastScannedTime = localScanLogs.current[sId] || 0;
      const lockoutMs = lockoutMinutes * 60 * 1000;

      if (sameBusScanLock && now - lastScannedTime < lockoutMs) {
        const remainingMinutes = Math.ceil((lockoutMs - (now - lastScannedTime)) / (60 * 1000));
        playTone('error');
        setVerificationResult({
          status: 'rejected',
          student,
          reason: `Anti-Passback: Scanned ${Math.round((now - lastScannedTime) / 60000)}m ago on this vehicle.`,
          recommendation: `Duplicate scan blocked for ${remainingMinutes} more minutes.`
        });
        showError(`Duplicate scan blocked (${remainingMinutes}m remaining)`);
        return;
      }

      // Approved!
      playTone('success');
      localScanLogs.current[sId] = now;

      setVerificationResult({
        status: 'approved',
        student,
        reason: 'Boarding Authorized'
      });

      if (fastMode) {
        await handleHeadcountChange(1);
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const logId = `${sId}_${dateStr}_${Date.now()}`;
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
          method: tokenPayload ? 'QR Scanner' : 'Manual Entry'
        },
        { merge: true }
      );

      await logBoarding({
        studentEmail: student.email,
        studentName: student.name,
        busId: selectedBus?.id || '',
        busNumber: selectedBus?.number || '',
        route: selectedBus?.route || student.busRoute || '',
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

  const handleQuickDemoScan = () => {
    executeVerify('nayan@indoreinstitute.com');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 space-y-5 font-sans text-slate-900">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Page Header */}
      <PageHeader
        title="Boarding Verification Terminal"
        subtitle="Continuous optical QR validation, cryptographic authentication, and live bus occupancy"
        badge={
          <Badge variant="primary" dot>
            Field Ready
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={ArrowLeft}
              onClick={() => navigate('/driver/dashboard')}
            >
              Cockpit
            </Button>
          </div>
        }
      />

      {/* Vehicle Status & Headcount Strip */}
      <Card>
        <CardBody className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Bus #{selectedBus?.number || '—'}
                  </h2>
                  <Badge variant="primary">
                    {selectedBus?.route || 'Campus Route'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Occupancy: <strong className="text-slate-800 tabular-nums">{currentCount}</strong> / {capacity} passengers ({occupancyPercent}%)
                </p>
              </div>
            </div>

            {/* Quick Bus Selector & Passenger +/- Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedBusId}
                onChange={(e) => setSelectedBusId(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
              >
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bus #{b.number} ({b.headcount || 0}/{b.capacity || 45})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <Button
                  variant="ghost"
                  size="xs"
                  icon={Minus}
                  onClick={() => handleHeadcountChange(-1)}
                  disabled={currentCount <= 0}
                  title="Passenger Alighted (-1)"
                />
                <span className="px-2 text-xs font-bold tabular-nums text-slate-800">
                  {currentCount}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  icon={Plus}
                  onClick={() => handleHeadcountChange(1)}
                  disabled={currentCount >= capacity}
                  title="Passenger Boarded (+1)"
                />
                <Button
                  variant="ghost"
                  size="xs"
                  icon={RotateCcw}
                  onClick={handleHeadcountReset}
                  title="Reset count to 0"
                />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main Grid: Scanner Left + Manual / Controls Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Camera Reticle + Result Card */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <CardTitle>Optical Bus Pass Scanner</CardTitle>
              </div>
              <Badge variant={isCameraActive ? 'success' : 'neutral'} dot>
                {isCameraActive ? 'Scanning Live' : 'Camera Standby'}
              </Badge>
            </CardHeader>
            <CardBody className="p-4 sm:p-5 space-y-4">
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

              <div className="text-center pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="text-xs text-slate-500 hover:text-blue-600 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Or <strong className="font-semibold underline">upload QR screenshot / image</strong>
                  </span>
                </button>
              </div>
            </CardBody>

            {/* Verification Result Feedback with Auto-Reset */}
            {verificationResult && (
              <div
                className={`p-4 border-t text-xs transition-colors ${
                  verificationResult.status === 'approved'
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50/90 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {verificationResult.status === 'approved' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-bold text-sm">
                      {verificationResult.status === 'approved'
                        ? 'Pass Approved · Boarding Recorded (+1)'
                        : 'Pass Denied'}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200 shrink-0 tabular-nums">
                    Auto-resetting in 3s
                  </span>
                </div>

                {verificationResult.student && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-2.5">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Student</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">
                        {verificationResult.student.name}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">ID / Roll No</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5 tabular-nums">
                        {verificationResult.student.collegeId || verificationResult.student.enrollment || '—'}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Route</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">
                        {verificationResult.student.busRoute || selectedBus?.route || 'Campus Route'}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Validity</span>
                      <span className="font-bold text-slate-900 truncate block mt-0.5">
                        {verificationResult.student.passValidity || 'Active'}
                      </span>
                    </div>
                  </div>
                )}

                {verificationResult.reason && (
                  <p className="mt-2 text-slate-600">
                    <strong>Detail:</strong> {verificationResult.reason}
                  </p>
                )}
                {verificationResult.recommendation && (
                  <p className="mt-1 text-slate-500 text-[11px]">
                    <strong>Action:</strong> {verificationResult.recommendation}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (5 cols): Manual Fallback & Boarding Log */}
        <div className="lg:col-span-5 space-y-4">
          {/* Manual Entry Fallback */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                <CardTitle>Manual Pass Lookup</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="p-4 sm:p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Student Email, Roll No, or Pass ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. nayan@indoreinstitute.com"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeVerify(manualInput)}
                    className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400"
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

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleQuickDemoScan}
                  className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Simulate Test Student Verification</span>
                </button>
              </div>
            </CardBody>
          </Card>

          {/* Today's Passenger Boarding Log */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <CardTitle>Today's Boardings</CardTitle>
              </div>
              <Badge variant="neutral">
                {boardingLog.length} recorded
              </Badge>
            </CardHeader>
            <CardBody className="p-0">
              {boardingLog.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No boardings recorded yet on Bus #{selectedBus?.number || '—'} today.
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 text-xs">
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
    </div>
  );
}

export default DriverScanPass;