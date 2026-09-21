// src/components/domain/ValidateBusPassScanner.jsx
import React from 'react';
import { Camera, Loader2, AlertCircle } from 'lucide-react';

/**
 * ValidateBusPassScanner
 * Reusable camera scanner with reticle overlay, laser animation, and camera controls.
 * Supports embedded mode (no outer redundant card frame) or standalone card mode.
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
    <div className={`w-full max-w-md mx-auto ${className}`}>
      {!embedded && title && (
        <h2 className="text-base font-semibold text-gray-900 text-center mb-4">
          {title}
        </h2>
      )}

      {/* ─── Camera Viewfinder Screen ────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square w-full shadow-inner flex items-center justify-center border border-slate-800">
        {/* Mount element for Html5Qrcode video stream */}
        <div
          id={elementId}
          className="w-full h-full absolute inset-0 overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
        />

        {/* Custom Reticle Overlay (Reference design) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          {/* 4 Outer Emerald Corner Brackets */}
          <div className="absolute top-4 left-4 w-7 h-7 border-t-4 border-l-4 border-[#00e676] rounded-tl-lg" />
          <div className="absolute top-4 right-4 w-7 h-7 border-t-4 border-r-4 border-[#00e676] rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 w-7 h-7 border-b-4 border-l-4 border-[#00e676] rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 w-7 h-7 border-b-4 border-r-4 border-[#00e676] rounded-br-lg" />

          {/* Center Target Box */}
          <div className="relative w-[72%] h-[72%] flex items-center justify-center">
            {/* Darkened backdrop surrounding target box */}
            <div className="absolute -inset-96 bg-black/35 -z-10 pointer-events-none" />

            {/* 4 Inner White Target Brackets */}
            <div className="absolute top-0 left-0 w-10 h-10 border-t-[5px] border-l-[5px] border-white" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-[5px] border-r-[5px] border-white" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[5px] border-l-[5px] border-white" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[5px] border-r-[5px] border-white" />

            {/* Animated Horizontal Laser Scan Beam */}
            {isCameraActive && (
              <div className="absolute left-1 right-1 h-1 bg-[#00e676] rounded-full shadow-[0_0_16px_3px_#00e676,0_0_24px_6px_rgba(0,230,118,0.6)] animate-scanner-laser pointer-events-none" />
            )}
          </div>
        </div>

        {/* Idle Overlay when camera is off */}
        {!isCameraActive && !cameraLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/85 text-center space-y-2 backdrop-blur-xs">
            <div className="w-12 h-12 rounded-full bg-slate-800/90 text-slate-300 flex items-center justify-center shadow-inner">
              <Camera className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-200">Scanner Camera Standby</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Position student QR code within the framing reticle
            </p>
          </div>
        )}

        {/* Loading Overlay */}
        {cameraLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/90 text-center space-y-2">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
            <p className="text-xs text-slate-300 font-medium">Initializing camera optical sensor...</p>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute bottom-3 inset-x-3 z-30 p-2.5 bg-red-950/90 border border-red-800 text-red-200 text-xs rounded-xl text-center font-medium flex items-center justify-center gap-1.5 shadow-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{cameraError}</span>
          </div>
        )}
      </div>

      {/* ─── Bottom Full-Width Action Button ──────────────────────────────────── */}
      <button
        type="button"
        onClick={isCameraActive ? onStopCamera : onStartCamera}
        disabled={cameraLoading}
        className={`mt-4 w-full py-3 px-4 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
          isCameraActive
            ? 'bg-rose-600 hover:bg-rose-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {cameraLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting Camera...</span>
          </>
        ) : isCameraActive ? (
          <>
            <Camera className="w-4 h-4" />
            <span>Stop Camera Scanner</span>
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
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
    <div className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm max-w-md w-full mx-auto ${className}`}>
      {content}
    </div>
  );
}
