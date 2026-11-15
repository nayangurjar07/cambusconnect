// src/components/domain/ValidateBusPassScanner.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Loader2, AlertCircle, Zap, ZapOff, SwitchCamera } from 'lucide-react';
import jsQR from 'jsqr';
import { db, collection, query, where, getDocs, doc, getDoc } from '../../config/firebase';
import { incrementBusHeadcount, logBoarding } from '../../services/transit';

/**
 * ValidateBusPassScanner
 * Field-ready pass verification terminal supporting both standalone mode
 * (used by Driver/Conductor portal with hardware-style reticle, flash card & manual fallback)
 * and controlled mode (used by AdminScanPass).
 */
export function ValidateBusPassScanner({
  assignedBus = null,
  verifierRole = 'driver',
  verifierEmail = '',
  // Admin controlled props
  elementId,
  isCameraActive: propIsActive,
  onStartCamera: propStartCamera,
  onStopCamera: propStopCamera,
  cameraLoading = false,
  cameraError: propCameraError = '',
  title = "Validate Student Bus Pass",
  embedded = false,
  className = "",
  onToggleTorch,
  torchActive = false,
  showTorch = false,
  onFlipCamera,
  showFlip = false,
  compact = false
}) {
  const isControlled = typeof propStartCamera === 'function';
  const effectiveElementId = elementId || 'admin-qr-viewfinder';

  // Standalone state
  const [cameraActive, setCameraActive] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { valid: boolean, status: string, student: object, message: string }
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanLoopRef = useRef(null);

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startCamera = async () => {
    setCameraError('');
    setScanResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // Fast QR Detection: native BarcodeDetector if available, jsQR canvas fallback otherwise
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const detectTick = async () => {
          if (!videoRef.current || !streamRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              stopCamera();
              await verifyPassPayload(barcodes[0].rawValue);
              return;
            }
          } catch (_) {}
          scanLoopRef.current = requestAnimationFrame(detectTick);
        };
        scanLoopRef.current = requestAnimationFrame(detectTick);
      } else {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const detectTick = async () => {
          if (!videoRef.current || !streamRef.current) return;
          const video = videoRef.current;
          if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });
            if (code && code.data) {
              stopCamera();
              await verifyPassPayload(code.data);
              return;
            }
          }
          scanLoopRef.current = requestAnimationFrame(detectTick);
        };
        scanLoopRef.current = requestAnimationFrame(detectTick);
      }
    } catch (err) {
      setCameraError('Camera access denied or unavailable. Use manual Pass ID / Email verification below.');
      setCameraActive(false);
    }
  };

  const verifyPassPayload = async (rawInput) => {
    const clean = String(rawInput || '').trim();
    if (!clean) return;

    setVerifying(true);
    setScanResult(null);

    try {
      let lookupKey = clean;
      try {
        const parsed = JSON.parse(clean);
        lookupKey = parsed.email || parsed.studentId || parsed.id || parsed.rollNumber || clean;
      } catch (_) {}

      let studentData = null;
      const usersCol = collection(db, 'users');

      // 1. Direct lookup by email/doc ID in users or students
      const directDoc = await getDoc(doc(db, 'users', lookupKey.toLowerCase()));
      if (directDoc.exists()) {
        studentData = { id: directDoc.id, ...directDoc.data() };
      } else {
        const studentDoc = await getDoc(doc(db, 'students', lookupKey.toLowerCase()));
        if (studentDoc.exists()) {
          studentData = { id: studentDoc.id, ...studentDoc.data() };
        } else {
          // 2. Fallback query by rollNumber or passId
          const qRoll = query(usersCol, where('rollNumber', '==', lookupKey));
          const rollSnap = await getDocs(qRoll);
          if (!rollSnap.empty) {
            studentData = { id: rollSnap.docs[0].id, ...rollSnap.docs[0].data() };
          } else {
            const qPass = query(usersCol, where('passId', '==', lookupKey));
            const passSnap = await getDocs(qPass);
            if (!passSnap.empty) {
              studentData = { id: passSnap.docs[0].id, ...passSnap.docs[0].data() };
            }
          }
        }
      }

      if (!studentData) {
        setScanResult({
          valid: false,
          status: 'NOT FOUND',
          student: null,
          message: `No registered student pass matches "${lookupKey}".`
        });
        return;
      }

      // Check pass status / expiry
      const isExpired =
        studentData.passStatus === 'Expired' ||
        studentData.status === 'Suspended' ||
        (studentData.validUntil && new Date(studentData.validUntil) < new Date());

      if (isExpired) {
        setScanResult({
          valid: false,
          status: 'EXPIRED PASS',
          student: studentData,
          message: `Pass expired or suspended for ${studentData.name || studentData.email}.`
        });
        return;
      }

      // Check bus assignment match if driver has an assigned bus
      const studentBusNum = String(studentData.busNumber || studentData.assignedBus || '').trim();
      const currentBusNum = String(assignedBus?.number || '').trim();
      const wrongBus =
        studentBusNum &&
        currentBusNum &&
        studentBusNum.toLowerCase() !== currentBusNum.toLowerCase();

      if (wrongBus) {
        setScanResult({
          valid: false,
          status: 'WRONG BUS',
          student: studentData,
          message: `Assigned to Bus #${studentBusNum}, but scanning on Bus #${currentBusNum}.`
        });
        return;
      }

      // Valid Pass -> Increment headcount & log boarding
      if (assignedBus?.id) {
        await incrementBusHeadcount(assignedBus.id, 1, assignedBus.capacity || 45);
        await logBoarding({
          studentId: studentData.id || studentData.email,
          studentName: studentData.name || studentData.email,
          busId: assignedBus.id,
          busNumber: assignedBus.number,
          routeName: assignedBus.route || ''
        });
      }

      setScanResult({
        valid: true,
        status: 'VALID PASS · BOARDED',
        student: studentData,
        message: `Verified for Bus #${currentBusNum || studentBusNum || 'Campus'} (+1 Headcount logged).`
      });
      setManualInput('');
    } catch (err) {
      setScanResult({
        valid: false,
        status: 'VERIFICATION ERROR',
        student: null,
        message: err.message || 'Could not verify pass.'
      });
    } finally {
      setVerifying(false);
    }
  };

  // ── Controlled Mode (for AdminScanPass) ──
  if (isControlled) {
    return (
      <div className={`w-full ${compact ? 'max-w-[240px]' : 'max-w-[280px]'} mx-auto ${className}`}>
        {!embedded && title && (
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider text-center mb-2.5">
            {title}
          </h2>
        )}

        <div className={`relative rounded-2xl overflow-hidden aspect-square w-full shadow-xs flex items-center justify-center group transition-colors ${
          propIsActive 
            ? 'bg-slate-900 border border-slate-700/80 shadow-md' 
            : 'bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100/70 border border-slate-200/90'
        }`}>
          {/* Mount element for Html5Qrcode video stream */}
          <div
            id={effectiveElementId}
            className="w-full h-full absolute inset-0 overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          />

          {/* Minimalist Corner Brackets Reticle */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 p-4">
            <div className="relative w-full h-full max-w-[150px] max-h-[150px] flex items-center justify-center">
              <div className={`absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 rounded-tl-md transition-colors ${
                propIsActive ? 'border-amber-400' : 'border-slate-300'
              }`} />
              <div className={`absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 rounded-tr-md transition-colors ${
                propIsActive ? 'border-amber-400' : 'border-slate-300'
              }`} />
              <div className={`absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 rounded-bl-md transition-colors ${
                propIsActive ? 'border-amber-400' : 'border-slate-300'
              }`} />
              <div className={`absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 rounded-br-md transition-colors ${
                propIsActive ? 'border-amber-400' : 'border-slate-300'
              }`} />
            </div>
          </div>

          {/* Controls: Torch & Camera Flip */}
          {propIsActive && (showTorch || showFlip) && (
            <div className="absolute top-2 right-2 z-25 flex items-center gap-1.5 pointer-events-auto">
              {showTorch && onToggleTorch && (
                <button
                  type="button"
                  onClick={onToggleTorch}
                  className={`p-1.5 rounded-lg backdrop-blur-md border transition-all cursor-pointer shadow-xs ${
                    torchActive
                      ? 'bg-amber-500 text-white border-amber-400'
                      : 'bg-slate-900/75 hover:bg-slate-900 text-slate-200 border-white/20'
                  }`}
                  title={torchActive ? "Turn Off Torch" : "Turn On Torch"}
                >
                  {torchActive ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
                </button>
              )}

              {showFlip && onFlipCamera && (
                <button
                  type="button"
                  onClick={onFlipCamera}
                  className="p-1.5 rounded-lg backdrop-blur-md bg-slate-900/75 hover:bg-slate-900 text-slate-200 border border-white/20 transition-all cursor-pointer shadow-xs"
                  title="Switch Camera (Front / Rear)"
                >
                  <SwitchCamera className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {!propIsActive && !cameraLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-3.5 bg-gradient-to-b from-slate-50/95 via-slate-50/90 to-slate-100/90 text-center space-y-1.5 backdrop-blur-xs">
              <div className="w-10 h-10 rounded-2xl bg-white text-slate-700 flex items-center justify-center border border-slate-200/90 shadow-2xs">
                <Camera className="w-5 h-5 text-slate-700" />
              </div>
              <p className="text-xs font-bold text-slate-800 tracking-tight">Scanner Standby</p>
              <p className="text-[11px] text-slate-500 max-w-[160px] leading-snug">
                Position student QR bus pass within framing reticle
              </p>
            </div>
          )}

          {cameraLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-3.5 bg-slate-900/95 text-center space-y-2">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              <p className="text-[11px] text-slate-200 font-medium">Initializing camera sensor...</p>
            </div>
          )}

          {propCameraError && (
            <div className="absolute bottom-2 inset-x-2 z-30 p-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] rounded-lg text-center font-semibold flex items-center justify-center gap-1 shadow-xs">
              <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
              <span className="truncate">{propCameraError}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={propIsActive ? propStopCamera : propStartCamera}
          disabled={cameraLoading}
          className={`mt-2.5 w-full py-2.5 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98] ${
            propIsActive
              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/90'
              : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {cameraLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : propIsActive ? (
            <>
              <Camera className="w-4 h-4 text-rose-600" />
              <span>Stop Scanner</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 text-white" />
              <span>Start Camera Scanner</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Standalone Mode (Field-Ready Pass Verification Terminal) ──
  return (
    <div className="space-y-4 font-sans">
      {/* Camera Viewfinder */}
      <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-slate-800">
        {cameraActive ? (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Corner Bracket Reticle */}
            <div className="absolute inset-8 pointer-events-none">
              <div className="scanner-frame-corner top-0 left-0 border-t-2 border-l-2" />
              <div className="scanner-frame-corner top-0 right-0 border-t-2 border-r-2" />
              <div className="scanner-frame-corner bottom-0 left-0 border-b-2 border-l-2" />
              <div className="scanner-frame-corner bottom-0 right-0 border-b-2 border-r-2" />
            </div>
            <button
              type="button"
              onClick={stopCamera}
              className="absolute bottom-3 right-3 px-3 py-1.5 bg-slate-900/90 text-white font-mono text-xs rounded-lg border border-slate-700 cursor-pointer"
            >
              Stop Camera
            </button>
          </>
        ) : (
          <div className="text-center p-6 space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Optical QR Pass Reader
            </p>
            <button
              type="button"
              onClick={startCamera}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm rounded-lg transition cursor-pointer"
            >
              Activate Camera Scanner
            </button>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          {cameraError}
        </div>
      )}

      {/* Instant Full-Contrast Verification Result Flash Card */}
      {scanResult && (
        <div
          className={`p-4 rounded-xl border-2 ${
            scanResult.valid
              ? 'bg-emerald-950 text-white border-emerald-500'
              : 'bg-rose-950 text-white border-rose-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`px-2.5 py-0.5 text-xs font-mono font-bold uppercase rounded ${
                scanResult.valid ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
              }`}
            >
              {scanResult.status}
            </span>
            <span className="text-xs font-mono opacity-75">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {scanResult.student && (
            <div className="mt-3 pt-3 border-t border-white/15 grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="opacity-60 block">STUDENT</span>
                <span className="font-sans font-bold text-sm">{scanResult.student.name || 'Student'}</span>
              </div>
              <div>
                <span className="opacity-60 block">ASSIGNED BUS</span>
                <span className="font-bold text-sm">
                  Bus #{scanResult.student.busNumber || scanResult.student.assignedBus || '—'}
                </span>
              </div>
            </div>
          )}

          <p className="text-xs mt-2 opacity-90">{scanResult.message}</p>
        </div>
      )}

      {/* Manual Pass ID / Email / Roll Number Fallback */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verifyPassPayload(manualInput);
        }}
        className="pt-2 border-t border-slate-100 flex gap-2"
      >
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Enter Student Email, Roll No, or Pass ID..."
          className="flex-1 px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          disabled={verifying || !manualInput.trim()}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg disabled:opacity-40 cursor-pointer"
        >
          {verifying ? 'Checking...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}

export default ValidateBusPassScanner;
