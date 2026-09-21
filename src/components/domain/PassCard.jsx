// src/components/domain/PassCard.jsx
import React, { useState, useEffect } from 'react';
import { QrCode, ShieldCheck, AlertTriangle, Copy, Check, ExternalLink, Bus, Calendar, Hash, Clock } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { generateTotpPayload } from '../../utils/crypto';

export function PassCard({ student, showQR = true }) {
  const [copied, setCopied] = useState(false);
  if (!student) return null;

  const isValid = student.passValidity
    ? new Date(student.passValidity) >= new Date()
    : true;

  const studentId = String(student.collegeId || student.enrollment || student.id || student.email || 'UNKNOWN');
  const studentName = String(student.name || 'Student');
  const routeName = String(student.busRoute || 'Campus Transit');
  const tenantId = student.tenantId || (student.email?.includes('medicaps') ? 'medicaps' : 'iist');

  const [tokenString, setTokenString] = useState('');
  const [refreshCountdown, setRefreshCountdown] = useState(0);

  useEffect(() => {
    let mounted = true;
    
    const updateToken = async () => {
      if (!student.email) return;
      // Use qrSecret if available, fallback to email for legacy students until they are upgraded
      const secret = student.qrSecret || student.email;
      const payload = await generateTotpPayload(student.email, secret);
      
      if (mounted) {
        setTokenString(payload);
        // Calculate seconds until next 15-minute boundary
        const TIME_WINDOW_MS = 15 * 60 * 1000;
        const now = Date.now();
        const msUntilNextWindow = TIME_WINDOW_MS - (now % TIME_WINDOW_MS);
        setRefreshCountdown(Math.ceil(msUntilNextWindow / 1000));
      }
    };
    
    updateToken();
    
    const interval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          updateToken();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [student]);

  const qrImageUrl = tokenString 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=svg&data=${encodeURIComponent(tokenString)}`
    : '';

  const handleCopyToken = () => {
    navigator.clipboard.writeText(tokenString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.05)] transition-all">
      {/* Pass Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cambus Digital Pass</div>
            <div className="text-base font-bold tracking-tight text-white leading-tight">{studentName}</div>
          </div>
        </div>
        <Badge variant={isValid ? 'success' : 'danger'} dot>
          {isValid ? 'Verified Active' : 'Expired'}
        </Badge>
      </div>

      {/* Pass Body */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-150/70">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Enrollment / ID</div>
            <div className="font-bold text-slate-900 mt-1 truncate">{studentId}</div>
          </div>
          <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-150/70">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Bus Route</div>
            <div className="font-bold text-slate-900 mt-1 truncate">{routeName}</div>
          </div>
          <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-150/70">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Bus</div>
            <div className="font-bold text-blue-600 mt-1">
              Bus {student.assignedBusNumber || student.assignedBusId || '14'}
            </div>
          </div>
          <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-150/70">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Valid Through</div>
            <div className="font-bold text-slate-900 mt-1">{student.passValidity || '31 Dec 2026'}</div>
          </div>
        </div>

        {/* QR Code Presentation */}
        {showQR && (
          <div className="pt-3 border-t border-slate-100 flex flex-col items-center gap-3">
            <div className="relative p-3 bg-white border-2 border-slate-200/90 rounded-2xl shadow-xs">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="Student QR Code"
                  className="w-40 h-40 object-contain rounded-lg"
                  loading="eager"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">Generating...</div>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span>Auto-refreshes in {Math.floor(refreshCountdown / 60)}:{(refreshCountdown % 60).toString().padStart(2, '0')}</span>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Cryptographically Secured Transit Token</span>
            </div>

            <button
              type="button"
              onClick={handleCopyToken}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-full transition-colors active:scale-95"
              title="Copy token string for manual testing"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to clipboard' : 'Copy pass token'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
