// src/components/domain/PassCard.jsx
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Bus, 
  Clock, 
  Lock, 
  Smartphone,
  RefreshCw
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { generateTotpPayload, TIME_STEP_MS } from '../../utils/crypto';

export function PassCard({ 
  student, 
  showQR = true, 
  deviceSessionId = null,
  isDeviceBlocked = false,
  deviceBlockedMessage = null 
}) {
  const canvasRef = useRef(null);
  const [secondsRemaining, setSecondsRemaining] = useState(15);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);

  if (!student) return null;

  const isValid = student.passValidity
    ? new Date(student.passValidity) >= new Date()
    : true;

  const studentId = String(student.collegeId || student.enrollment || student.id || student.email || 'UNKNOWN');
  const studentName = String(student.name || 'Student');
  const routeName = String(student.busRoute || 'Campus Transit');
  const assignedBus = student.assignedBusNumber || student.assignedBusId || '--';

  // Real-time ticking clock (HH:MM:SS)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // 15-Second Rotating TOTP Dynamic QR Generator rendered strictly to HTML5 Canvas
  useEffect(() => {
    if (!showQR || isDeviceBlocked) return;
    let mounted = true;

    const renderQrCanvas = async () => {
      if (!student.email) return;
      const secret = student.qrSecret || student.id || student.email;
      if (!secret) {
        setIsGenerating(false);
        return;
      }

      try {
        setIsGenerating(true);
        const payload = await generateTotpPayload(student.email, secret, deviceSessionId);

        if (mounted && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, payload, {
            width: 220,
            margin: 1.5,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            },
            errorCorrectionLevel: 'M'
          });
        }
      } catch (err) {
        console.error("[PassCard] QR canvas rendering error:", err);
      } finally {
        if (mounted) setIsGenerating(false);
      }
    };

    const updateCountdown = () => {
      const now = Date.now();
      const msLeft = TIME_STEP_MS - (now % TIME_STEP_MS);
      const secs = Math.ceil(msLeft / 1000);
      setSecondsRemaining(secs);

      // Trigger re-render right when crossing boundary
      if (secs === 15 || secs <= 1) {
        renderQrCanvas();
      }
    };

    renderQrCanvas();
    updateCountdown();

    const ticker = setInterval(updateCountdown, 1000);

    return () => {
      mounted = false;
      clearInterval(ticker);
    };
  }, [student, showQR, deviceSessionId, isDeviceBlocked]);

  // Calculate percentage width for smooth countdown bar
  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / 15) * 100));

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.06)] relative transition-all">
      {/* Pass Header - Enterprise Blue Theme */}
      <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 text-white font-bold text-sm flex items-center justify-center backdrop-blur-xs shadow-xs">
            {student.photoURL ? (
              <img 
                src={student.photoURL} 
                alt={studentName} 
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              studentName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-100">Cambus Passholder</div>
            <div className="text-base font-bold tracking-tight text-white leading-tight">{studentName}</div>
          </div>
        </div>
        <Badge variant={isValid ? 'success' : 'danger'} dot>
          {isValid ? 'Verified Active' : 'Expired'}
        </Badge>
      </div>

      {/* Pass Metadata Grid */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Enrollment ID</div>
            <div className="font-bold text-slate-900 mt-1 truncate tabular-nums">{studentId}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Transit Route</div>
            <div className="font-bold text-slate-900 mt-1 truncate">{routeName}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Bus</div>
            <div className="font-bold text-blue-600 mt-1">
              {assignedBus !== '--' ? `Bus ${assignedBus}` : 'Unassigned'}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Valid Through</div>
            <div className="font-bold text-slate-900 mt-1">{student.passValidity || 'Active Semester'}</div>
          </div>
        </div>

        {/* Dynamic Rotating QR Presentation (Layer 1 + 2 + 3 Security) */}
        {showQR && (
          <div className="pt-3 border-t border-slate-100 flex flex-col items-center gap-3 relative">
            {/* Single-Device Binding Violation Overlay */}
            {isDeviceBlocked ? (
              <div className="w-full py-8 px-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-amber-900">Pass Active on Another Device</h4>
                <p className="text-xs text-amber-800 leading-relaxed max-w-xs mx-auto">
                  {deviceBlockedMessage || "To prevent unauthorized ticket sharing, bus passes are bound to a single registered smartphone."}
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-300 rounded-full text-[11px] font-semibold text-amber-900 shadow-2xs">
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>Single-Device Lockout Active</span>
                </div>
              </div>
            ) : (
              <>
                {/* HTML5 Canvas Protected Frame */}
                <div className="relative p-3.5 bg-white border-2 border-slate-200 rounded-2xl shadow-xs flex items-center justify-center min-w-[240px] min-h-[240px]">
                  {isGenerating && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center gap-2 z-10 text-slate-400 text-xs font-semibold">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      <span>Generating Pass...</span>
                    </div>
                  )}
                  <canvas 
                    ref={canvasRef} 
                    className="block rounded-lg pointer-events-none select-none max-w-full"
                    aria-label="Secure Digital Transit Barcode"
                  />
                </div>

                {/* 15-Second Dynamic Progress Bar */}
                <div className="w-full max-w-[240px] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1 text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span className="tabular-nums font-bold">{currentTimeStr}</span>
                    </span>
                    <span className="tabular-nums text-blue-600 font-bold">
                      {secondsRemaining}s
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-1000 ease-linear rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Anti-Fraud Security Trust Badge */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold pt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>15s Dynamic Anti-Screenshot Authentication</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PassCard;
