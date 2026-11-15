// src/components/domain/ValidateBusPassScanner.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Loader2, AlertCircle, Zap, ZapOff, SwitchCamera, CheckCircle2, XCircle, Upload } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useToast } from '../../contexts/ToastContext';
import { incrementBusHeadcount, logBoarding } from '../../services/transit';
import { decodeQrFromImageFile } from '../../services/qrDecoder';

/**
 * ValidateBusPassScanner
 * Minimalist, compact transit QR camera scanner supporting both standalone mode
 * (auto camera lifecycle, pass decoding, headcount increment) and controlled mode.
 */
export function ValidateBusPassScanner({
  elementId: propElementId,
  isCameraActive: propIsActive,
  onStartCamera: propStartCamera,
  onStopCamera: propStopCamera,
  cameraLoading: propLoading = false,
  cameraError: propError = '',
  title = "Validate Student Bus Pass",
  embedded = false,
  className = "",
  onToggleTorch: propToggleTorch,
  torchActive: propTorchActive = false,
  showTorch: propShowTorch = false,
  onFlipCamera: propFlipCamera,
  showFlip: propShowFlip = false,
  compact = false,
  assignedBus = null,
  verifierRole = 'driver',
  verifierEmail = ''
}) {
  const { showSuccess, showError, showWarning } = useToast();

  // Internal state for standalone mode
  const [internalActive, setInternalActive] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState('');
  const [internalTorch, setInternalTorch] = useState(false);
  const [internalFacing, setInternalFacing] = useState('environment');
  const [hasMultipleCams, setHasMultipleCams] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanCooldown, setScanCooldown] = useState(false);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const cooldownRef = useRef({});

  const isControlled = typeof propStartCamera === 'function';
  const effectiveElementId = propElementId || 'validate-qr-viewport-canvas';
  const isCameraActive = isControlled ? propIsActive : internalActive;
  const cameraLoading = isControlled ? propLoading : internalLoading;
  const cameraError = isControlled ? propError : internalError;
  const torchActive = isControlled ? propTorchActive : internalTorch;
  const showTorch = isControlled ? propShowTorch : true;
  const showFlip = isControlled ? propShowFlip : hasMultipleCams;

  // Standalone camera start
  const startInternalCamera = async (facing = internalFacing) => {
    setInternalError('');
    setInternalLoading(true);
    try {
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch (_) {}
      }

      const qrScanner = new Html5Qrcode(effectiveElementId);
      scannerRef.current = qrScanner;

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 1) {
          setHasMultipleCams(true);
        }
      } catch (_) {}

      await qrScanner.start(
        { facingMode: facing },
        {
          fps: 15,
          qrbox: (w, h) => {
            const edge = Math.min(w, h);
            const size = Math.max(160, Math.floor(edge * 0.72));
            return { width: size, height: size };
          }
        },
        (decodedText) => handleDecodedPass(decodedText),
        () => {}
      );

      setInternalActive(true);
    } catch (err) {
      setInternalError(err.message || 'Camera access denied');
      showError('Could not start camera scanner. Check camera permissions.');
    } finally {
      setInternalLoading(false);
    }
  };

  const stopInternalCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (_) {}
      scannerRef.current = null;
    }
    setInternalActive(false);
    setInternalTorch(false);
  };

  const toggleInternalTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const next = !internalTorch;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: next }]
      });
      setInternalTorch(next);
    } catch (_) {
      showWarning('Flashlight not supported on this camera.');
    }
  };

  const flipInternalCamera = async () => {
    const nextFacing = internalFacing === 'environment' ? 'user' : 'environment';
    setInternalFacing(nextFacing);
    if (internalActive) {
      await stopInternalCamera();
      setTimeout(() => startInternalCamera(nextFacing), 150);
    }
  };

  // Decode QR Pass in standalone mode
  const handleDecodedPass = async (rawInput) => {
    if (scanCooldown) return;
    setScanCooldown(true);
    setTimeout(() => setScanCooldown(false), 2200);

    const token = String(rawInput || '').trim();
    if (!token) return;

    // Check anti-passback cooldown (same student scanned within 3 minutes)
    const now = Date.now();
    const lastScan = cooldownRef.current[token];
    if (lastScan && now - lastScan < 180 * 1000) {
      const diffSec = Math.round((180 * 1000 - (now - lastScan)) / 1000);
      showWarning(`Pass already checked in! Anti-passback cooldown: ${diffSec}s remaining.`);
      setScanResult({
        status: 'denied',
        reason: `Pass already scanned recently (${diffSec}s cooldown).`
      });
      return;
    }
    cooldownRef.current[token] = now;

    // Increment headcount if bus is assigned
    if (assignedBus?.id) {
      try {
        await incrementBusHeadcount(assignedBus.id, 1, assignedBus.capacity || 45);
        await logBoarding({
          studentId: token.slice(0, 32),
          studentName: 'Verified Passenger',
          busId: assignedBus.id,
          busNumber: assignedBus.number,
          routeName: assignedBus.route || 'Campus Route'
        });
      } catch (_) {}
    }

    setScanResult({
      status: 'approved',
      studentId: token.length > 24 ? `${token.slice(0, 20)}...` : token,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
    showSuccess(`Pass Approved (+1 Boarded) · Bus #${assignedBus?.number || '—'}`);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const decodedText = await decodeQrFromImageFile(file);
      await handleDecodedPass(decodedText);
    } catch (err) {
      showError('Could not decode QR code from the uploaded image.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const onStartCamera = isControlled ? propStartCamera : () => startInternalCamera(internalFacing);
  const onStopCamera = isControlled ? propStopCamera : stopInternalCamera;
  const onToggleTorch = isControlled ? propToggleTorch : toggleInternalTorch;
  const onFlipCamera = isControlled ? propFlipCamera : flipInternalCamera;

  const content = (
    <div className={`w-full ${compact ? 'max-w-[210px]' : 'max-w-[230px] sm:max-w-[250px]'} mx-auto ${className}`}>
      {!embedded && title && (
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider text-center mb-2.5">
          {title}
        </h2>
      )}

      {/* ─── Compact Minimalist Camera Viewfinder (Clean Light Surface, No Harsh Black) ── */}
      <div className={`relative rounded-2xl overflow-hidden aspect-square w-full shadow-xs flex items-center justify-center group transition-colors ${
        isCameraActive 
          ? 'bg-slate-900 border border-slate-700/80 shadow-md' 
          : 'bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100/70 border border-slate-200/90'
      }`}>
        {/* Mount element for Html5Qrcode video stream */}
        <div
          id={effectiveElementId}
          className="w-full h-full absolute inset-0 overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
        />

        {/* Minimalist Single Reticle Frame (Clean transit blue brackets, no green) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 p-4">
          <div className="relative w-full h-full max-w-[150px] max-h-[150px] flex items-center justify-center">
            {/* 4 Clean Corner Alignment Brackets */}
            <div className={`absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 rounded-tl-md transition-colors ${
              isCameraActive ? 'border-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]' : 'border-slate-300'
            }`} />
            <div className={`absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 rounded-tr-md transition-colors ${
              isCameraActive ? 'border-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]' : 'border-slate-300'
            }`} />
            <div className={`absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 rounded-bl-md transition-colors ${
              isCameraActive ? 'border-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]' : 'border-slate-300'
            }`} />
            <div className={`absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 rounded-br-md transition-colors ${
              isCameraActive ? 'border-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]' : 'border-slate-300'
            }`} />

            {/* Subtle Cyan/Blue Laser Scan Beam (Clean light beam, no neon green) */}
            {isCameraActive && (
              <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_rgba(34,211,238,0.85)] rounded-full animate-scanner-laser pointer-events-none" />
            )}
          </div>
        </div>

        {/* Floating In-HUD Quick Action Controls (Torch & Camera Flip) */}
        {isCameraActive && (showTorch || showFlip) && (
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

        {/* Standby State Overlay when camera is idle (Light, Clean, Minimalist) */}
        {!isCameraActive && !cameraLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-3.5 bg-gradient-to-b from-slate-50/95 via-slate-50/90 to-slate-100/90 text-center space-y-1.5 backdrop-blur-xs">
            <div className="w-10 h-10 rounded-2xl bg-white text-blue-600 flex items-center justify-center border border-slate-200/90 shadow-2xs">
              <Camera className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xs font-bold text-slate-800 tracking-tight">Scanner Standby</p>
            <p className="text-[11px] text-slate-500 max-w-[160px] leading-snug">
              Position student QR bus pass within framing reticle
            </p>
          </div>
        )}

        {/* Loading Overlay */}
        {cameraLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-3.5 bg-slate-900/95 text-center space-y-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <p className="text-[11px] text-slate-200 font-medium">Initializing camera sensor...</p>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute bottom-2 inset-x-2 z-30 p-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] rounded-lg text-center font-semibold flex items-center justify-center gap-1 shadow-xs">
            <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
            <span className="truncate">{cameraError}</span>
          </div>
        )}
      </div>

      {/* ─── Compact Minimal Action Button ── */}
      <button
        type="button"
        onClick={isCameraActive ? onStopCamera : onStartCamera}
        disabled={cameraLoading}
        className={`mt-2.5 w-full py-2.5 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98] ${
          isCameraActive
            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/90'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 shadow-sm'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {cameraLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Connecting Sensor...</span>
          </>
        ) : isCameraActive ? (
          <>
            <Camera className="w-3.5 h-3.5 text-rose-600" />
            <span>Stop Camera Scanner</span>
          </>
        ) : (
          <>
            <Camera className="w-3.5 h-3.5 text-blue-100" />
            <span>Start Camera Scanner</span>
          </>
        )}
      </button>

      {/* Optional Standalone File Upload */}
      {!isControlled && (
        <div className="mt-2 text-center">
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
            className="text-[11px] text-slate-500 hover:text-blue-600 inline-flex items-center gap-1 cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span>Upload Pass Image</span>
          </button>
        </div>
      )}

      {/* Standalone Scan Feedback Banner */}
      {!isControlled && scanResult && (
        <div className={`mt-2.5 p-2 rounded-lg text-xs flex items-center gap-2 border ${
          scanResult.status === 'approved'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {scanResult.status === 'approved' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <div className="truncate">
            <span className="font-bold">
              {scanResult.status === 'approved' ? 'Pass Verified' : 'Pass Denied'}
            </span>
            <span className="text-[10px] text-slate-500 ml-1">
              {scanResult.studentId || scanResult.reason}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className={`bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm max-w-sm w-full mx-auto ${className}`}>
      {content}
    </div>
  );
}

export default ValidateBusPassScanner;
