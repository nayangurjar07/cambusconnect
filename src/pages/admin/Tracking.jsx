// src/pages/admin/Tracking.jsx
import React, { useState, useEffect } from 'react';
import { Bus, MapPin, Radio, Users, Phone } from 'lucide-react';
import { subscribeToBuses, updateBusStatus } from '../../services/transit';
import { FleetMap } from '../../components/domain/FleetMap';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusIndicator } from '../../components/ui/StatusIndicator';
import { PageHeader } from '../../components/layout/PageHeader';
import { useToast } from '../../contexts/ToastContext';

export function AdminTracking() {
  const { showSuccess, showError } = useToast();
  const [buses, setBuses] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const unsub = subscribeToBuses((list) => {
      setBuses(list);
      if (list.length > 0 && !selectedBus) {
        setSelectedBus(list[0]);
      }
    });
    return () => unsub();
  }, []);

  const filteredBuses = statusFilter === 'all' 
    ? buses 
    : buses.filter(b => b.status === statusFilter);

  const handleStatusUpdate = async (busId, newStatus) => {
    try {
      await updateBusStatus(busId, newStatus);
      showSuccess(`Status updated to: ${newStatus}`);
    } catch (err) {
      showError("Status change failed: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fleet Tracking"
        subtitle={`${buses.length} vehicles monitored`}
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'all', label: `All (${buses.length})` },
          { id: 'On Time', label: `On Time (${buses.filter(b => b.status === 'On Time').length})` },
          { id: 'Delayed', label: `Delayed (${buses.filter(b => b.status === 'Delayed').length})` },
          { id: 'Breakdown', label: `Issues (${buses.filter(b => b.status === 'Breakdown').length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.id 
                ? 'bg-gray-900 text-white' 
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Radar Map */}
        <div className="lg:col-span-2 h-[560px]">
          <FleetMap
            buses={filteredBuses}
            selectedBus={selectedBus}
            onSelectBus={setSelectedBus}
          />
        </div>

        {/* Selected Vehicle Diagnostics & Controls */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-xs font-medium text-gray-500 mb-3">Vehicle Details</div>

            {selectedBus ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">
                      Bus {selectedBus.number}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {selectedBus.route || 'Campus Route'}
                    </p>
                  </div>
                  <StatusIndicator status={selectedBus.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-md">
                    <span className="text-gray-400 text-[11px] block">Riders</span>
                    <span className="text-sm font-semibold text-gray-900 mt-0.5 block">{selectedBus.headcount || 0}</span>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-md">
                    <span className="text-gray-400 text-[11px] block">ETA</span>
                    <span className="text-sm font-semibold text-blue-600 mt-0.5 block">{selectedBus.eta || '12 min'}</span>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-md">
                    <span className="text-gray-400 text-[11px] block">Source</span>
                    <span className="text-xs text-gray-700 mt-0.5 block truncate">
                      {selectedBus.tracking?.sourceType || 'driver_app'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-md">
                    <span className="text-gray-400 text-[11px] block">Speed</span>
                    <span className="text-xs text-gray-700 mt-0.5 block">
                      {selectedBus.speed || 24} km/h
                    </span>
                  </div>
                </div>

                {/* Driver / Staff Contacts */}
                <div className="p-2.5 bg-gray-50 rounded-md space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Driver:</span>
                    <span className="font-medium text-gray-900">{selectedBus.driver || 'Unassigned'}</span>
                  </div>
                  {selectedBus.phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Phone:</span>
                      <a href={`tel:${selectedBus.phone}`} className="text-blue-600 hover:underline">
                        {selectedBus.phone}
                      </a>
                    </div>
                  )}
                  {selectedBus.conductor && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Conductor:</span>
                      <span className="font-medium text-gray-900">{selectedBus.conductor}</span>
                    </div>
                  )}
                </div>

                {/* Status Controls */}
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-500 block mb-1.5">
                    Update Status
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button 
                      variant={selectedBus.status === 'On Time' ? 'primary' : 'outline'} 
                      size="sm" 
                      onClick={() => handleStatusUpdate(selectedBus.id, 'On Time')}
                    >
                      On Time
                    </Button>
                    <Button 
                      variant={selectedBus.status === 'Delayed' ? 'primary' : 'outline'} 
                      size="sm" 
                      onClick={() => handleStatusUpdate(selectedBus.id, 'Delayed')}
                    >
                      Delayed
                    </Button>
                    <Button 
                      variant={selectedBus.status === 'Breakdown' ? 'danger' : 'outline'} 
                      size="sm" 
                      onClick={() => handleStatusUpdate(selectedBus.id, 'Breakdown')}
                    >
                      Issue
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-400">
                Select a bus to inspect diagnostics.
              </div>
            )}
          </Card>

          {/* Quick Vehicle Roster */}
          <Card className="p-3">
            <div className="text-xs font-medium text-gray-500 mb-2">Fleet List</div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {filteredBuses.map(b => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBus(b)}
                  className={`p-2 rounded-md border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    selectedBus?.id === b.id 
                      ? 'bg-blue-50 border-blue-200 text-blue-900 font-medium' 
                      : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="font-medium">Bus {b.number}</span>
                  <span className="text-[11px] text-gray-400">{b.route}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
