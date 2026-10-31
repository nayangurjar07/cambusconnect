// src/components/domain/ValidateBusPassScanner.jsx
import React from 'react';
import { Camera, Loader2, AlertCircle } from 'lucide-react';

/**
 * ValidateBusPassScanner
 * Minimalist, compact transit QR camera scanner with clean blue reticle framing.
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
  className = ""
}) {
  const content = (
    <div className={`w-full max-w-[280px] sm:max-w-[300px] mx-auto ${className}`}>
      {!embedded && title && (
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider text-center mb-3">
          {title}
        </h2>
      )}

      {/* ─── Compact Minimalist Camera Viewfinder ────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square w-full shadow-md border border-slate-700/50 flex items-center justify-center">
        {/* Mount element for Html5Qrcode video stream */}
        <div
          id={elementId}
          className="w-full h-full absolute inset-0 overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
        />

        {/* Minimalist Single Reticle Frame (No green, no black double-boxes) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 p-5">
          <div className="relative w-full h-full max-w-[190px] max-h-[190px] flex items-center justify-center">
            {/* 4 Clean Corner Alignment Brackets */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-blue-500 rounded-tl" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-blue-500 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-blue-500 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-blue-500 rounded-br" />

            {/* Subtle Blue Laser Scan Beam */}
            {isCameraActive && (
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_rgba(59,130,246,0.8)] rounded-full animate-scanner-laser pointer-events-none" />
            )}
          </div>
        </div>

        {/* Standby State Overlay when camera is idle */}
        {!isCameraActive && !cameraLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 bg-slate-900/90 text-center space-y-2 backdrop-blur-xs">
            <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700/60 shadow-sm">
              <Camera className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-xs font-semibold text-slate-200">Scanner Standby</p>
            <p className="text-[11px] text-slate-400 max-w-[180px] leading-tight">
              Position student QR pass within framing reticle
            </p>
          </div>
        )}

        {/* Loading Overlay */}
        {cameraLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 bg-slate-900/95 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <p className="text-[11px] text-slate-300 font-medium">Initializing camera sensor...</p>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute bottom-2.5 inset-x-2.5 z-30 p-2 bg-red-950/90 border border-red-800/80 text-red-200 text-[11px] rounded-xl text-center font-medium flex items-center justify-center gap-1.5 shadow-lg">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="truncate">{cameraError}</span>
          </div>
        )}
      </div>

      {/* ─── Compact Action Button ──────────────────────────────────── */}
      <button
        type="button"
        onClick={isCameraActive ? onStopCamera : onStartCamera}
        disabled={cameraLoading}
        className={`mt-3 w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98] ${
          isCameraActive
            ? 'bg-slate-800 hover:bg-slate-900 text-white border border-slate-700/60'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 shadow-md'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {cameraLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : isCameraActive ? (
          <>
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span>Stop Camera Scanner</span>
          </>
        ) : (
          <>
            <Camera className="w-3.5 h-3.5" />
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
    <div className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm max-w-sm w-full mx-auto ${className}`}>
      {content}
    </div>
  );
}
