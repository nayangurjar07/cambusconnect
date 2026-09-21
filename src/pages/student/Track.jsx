// src/pages/student/Track.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToBuses } from '../../services/transit';
import { PageHeader } from '../../components/layout/PageHeader';
import { FleetMap } from '../../components/domain/FleetMap';
import { VehicleCard } from '../../components/domain/VehicleCard';
import { StatusIndicator } from '../../components/ui/StatusIndicator';

export function StudentTrack() {
  const { profile } = useAuth();
  const [buses, setBuses] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);

  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      if (list.length > 0 && !selectedBus) {
        const myBus = list.find(b => b.id === profile?.assignedBusId || b.number === profile?.assignedBusNumber) || list[0];
        setSelectedBus(myBus);
      }
    });
    return () => unsub();
  }, [profile]);

  return (
    <div className="space-y-4">
      <PageHeader title="Live Tracking" subtitle="Real-time bus locations" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2">
          <FleetMap 
            buses={buses} 
            selectedBus={selectedBus} 
            onSelectBus={setSelectedBus} 
            className="h-[400px] lg:h-[500px]" 
          />
        </div>

        {/* Vehicle List */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Active Buses</h3>
            <p className="text-xs text-gray-500 mt-0.5">{buses.length} vehicles</p>
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
            {buses.map(bus => (
              <VehicleCard
                key={bus.id}
                bus={bus}
                compact
                onClick={() => setSelectedBus(bus)}
              />
            ))}
            {buses.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">
                No active buses
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
