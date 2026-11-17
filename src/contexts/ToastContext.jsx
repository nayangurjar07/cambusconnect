// src/contexts/ToastContext.jsx
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const MAX_TOASTS = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const lastToastRef = useRef({ message: '', type: '', time: 0 });

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    if (!message) return;
    const now = Date.now();

    // Prevent identical rapid spam (e.g. from rapid camera frame scans)
    if (
      lastToastRef.current.message === message &&
      lastToastRef.current.type === type &&
      now - lastToastRef.current.time < 1200
    ) {
      return;
    }
    lastToastRef.current = { message, type, time: now };

    const id = `${now}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast = { id, message, type };

    setToasts((prev) => {
      // Strict FIFO Queue: Never show more than 3 toasts.
      // If 3 already exist, delete the oldest/top one (index 0) and shift down to append the new 3rd one.
      const shifted = prev.length >= MAX_TOASTS ? prev.slice(prev.length - (MAX_TOASTS - 1)) : prev;
      return [...shifted, newToast];
    });

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const showSuccess = useCallback((msg, duration) => addToast(msg, 'success', duration), [addToast]);
  const showError = useCallback((msg, duration) => addToast(msg, 'error', duration), [addToast]);
  const showWarning = useCallback((msg, duration) => addToast(msg, 'warning', duration), [addToast]);
  const showInfo = useCallback((msg, duration) => addToast(msg, 'info', duration), [addToast]);

  return (
    <ToastContext.Provider value={{
      addToast,
      removeToast,
      showSuccess,
      showError,
      showWarning,
      showInfo
    }}>
      {children}
      
      {/* Toast Render Overlay - Max 3 toasts, Mobile Responsive Position (Top on mobile, Bottom-Right on desktop) */}
      <div 
        className="fixed top-3 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:top-auto sm:bottom-5 sm:right-5 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none transition-all duration-300"
        aria-live="polite"
      >
        {toasts.map(toast => {
          let bg = 'bg-slate-900/95 text-white border-slate-700 shadow-slate-900/40';
          let icon = <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />;

          if (toast.type === 'success') {
            bg = 'bg-emerald-950/95 text-emerald-50 border-emerald-700/80 shadow-emerald-950/30';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />;
          } else if (toast.type === 'error') {
            bg = 'bg-rose-950/95 text-rose-50 border-rose-700/80 shadow-rose-950/30';
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
          } else if (toast.type === 'warning') {
            bg = 'bg-amber-950/95 text-amber-50 border-amber-700/80 shadow-amber-950/30';
            icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 ${bg}`}
            >
              {icon}
              <div className="flex-1 text-xs sm:text-sm font-medium leading-snug break-words">
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 transition-opacity p-1 rounded-md cursor-pointer -mr-1 -mt-1 active:scale-95"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
