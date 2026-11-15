// src/pages/driver/ScanPass.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToBuses } from '../../services/transit';
import ValidateBusPassScanner from '../../components/domain/ValidateBusPassScanner';

export function DriverScanPass() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [buses, setBuses] = useState([]);

  useEffect(() => {
    const unsub = subscribeToBuses(setBuses);
    return () => unsub();
  }, []);

  const userEmail = user?.email?.toLowerCase().trim();
  const assignedBus =
    buses.find(
      (b) =>
        String(b.number) === String(user?.assignedBus) ||
        b.primaryDriver?.email === userEmail ||
        b.secondaryDriver?.email === userEmail ||
        b.primaryConductor?.email === userEmail ||
        b.secondaryConductor?.email === userEmail
    ) || buses[0];

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 font-sans text-slate-900">
      {/* Crisp Field Header */}
      <div className="bg-slate-950 text-white rounded-xl p-4 border border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 block">
            Boarding Verification Terminal
          </span>
          <h1 className="text-lg font-bold tracking-tight mt-0.5">
            Scan Student Bus Pass
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {assignedBus && (
            <span className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold tabular-nums">
              Bus #{assignedBus.number} ({assignedBus.headcount || 0}/{assignedBus.capacity || 45})
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate('/driver/dashboard')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
          >
            ← Cockpit
          </button>
        </div>
      </div>

      {/* Scanner Viewport Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        <ValidateBusPassScanner
          assignedBus={assignedBus}
          verifierRole={user?.role || 'driver'}
          verifierEmail={user?.email}
        />
      </div>
    </div>
  );
}

export default DriverScanPass;
