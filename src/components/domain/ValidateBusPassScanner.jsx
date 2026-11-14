// src/components/domain/ValidateBusPassScanner.jsx
import React from 'react';
import { Camera, Loader2, AlertCircle, Zap, ZapOff, SwitchCamera } from 'lucide-react';

/**
 * ValidateBusPassScanner
 * Minimalist, compact transit QR camera scanner with clean blue reticle framing and in-HUD camera controls.
 */
export function ValidateBusPassScanner({
  elementId,
  isCameraActive,
  onStartCamera,
  onStopCamera,
  cameraLoading = false,
  cameraError = '',
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
          id={elementId}
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

      {/* ─── Compact Minimal Action Button (Subtle, No Glowing Crimson or Stark Black) ── */}
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
