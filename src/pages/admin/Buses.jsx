// src/pages/admin/Buses.jsx
import React, { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeToBuses,
  subscribeToRoutes,
  createBus,
  updateBus,
  deleteBus,
  getBusTrackingHealth
} from '../../services/transit';

const INITIAL_BUS_FORM = {
  number: '',
  registrationNumber: '',
  route: '',
  routeId: '',
  capacity: 45,
  status: 'On Time'
};

export function AdminBuses() {
  const { showSuccess, showError } = useToast();
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBusId, setEditingBusId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_BUS_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubBuses = subscribeToBuses(setBuses);
    const unsubRoutes = subscribeToRoutes(setRoutes);
    return () => {
      unsubBuses();
      unsubRoutes();
    };
  }, []);

  const openCreateModal = () => {
    setEditingBusId(null);
    setFormData(INITIAL_BUS_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (bus) => {
    setEditingBusId(bus.id);
    setFormData({
      number: bus.number || '',
      registrationNumber: bus.registrationNumber || '',
      route: bus.route || '',
      routeId: bus.routeId || '',
      capacity: bus.capacity || 45,
      status: bus.status || 'On Time'
    });
    setIsModalOpen(true);
  };

  const handleRouteSelect = (routeId) => {
    const r = routes.find((item) => item.id === routeId);
    setFormData((prev) => ({
      ...prev,
      routeId,
      route: r ? r.name : prev.route
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.number.trim()) {
      showError('Bus Number is required.');
      return;
    }
    setSaving(true);
    try {
      if (editingBusId) {
        await updateBus(editingBusId, formData);
        showSuccess(`Updated Bus #${formData.number}`);
      } else {
        await createBus(formData);
        showSuccess(`Registered Bus #${formData.number}`);
      }
      setIsModalOpen(false);
    } catch (err) {
      showError(err.message || 'Failed to save bus');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bus) => {
    if (!window.confirm(`Delete Bus #${bus.number} from the fleet?`)) return;
    try {
      await deleteBus(bus.id);
      showSuccess(`Removed Bus #${bus.number}`);
    } catch (err) {
      showError('Could not delete bus');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Vehicle Inventory & Crew Slots
          </span>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">
            Campus Bus Fleet Registry
          </h1>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition cursor-pointer"
        >
          + Register New Bus
        </button>
      </div>

      {/* Dense Fleet Operations Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Bus # / Reg</th>
                <th className="py-3 px-4">Assigned Route</th>
                <th className="py-3 px-4">Drivers (Primary / Sub)</th>
                <th className="py-3 px-4">Conductors (Primary / Sub)</th>
                <th className="py-3 px-4">Telemetry Status</th>
                <th className="py-3 px-4">Occupancy</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {buses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No buses registered yet. Click "+ Register New Bus" to add vehicles.
                  </td>
                </tr>
              ) : (
                buses.map((bus) => {
                  const health = getBusTrackingHealth(bus, 110);
                  const pDriver = bus.primaryDriver?.name || bus.driver || 'Unassigned';
                  const sDriver = bus.secondaryDriver?.name || '—';
                  const pCond = bus.primaryConductor?.name || bus.conductor || 'Unassigned';
                  const sCond = bus.secondaryConductor?.name || '—';

                  return (
                    <tr key={bus.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900">Bus #{bus.number}</span>
                        {bus.registrationNumber && (
                          <span className="block text-xs text-slate-500">{bus.registrationNumber}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800">{bus.route || 'Unassigned'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-900 text-white rounded mr-1.5">
                            P
                          </span>
                          <span className="font-medium text-slate-800">{pDriver}</span>
                        </div>
                        <div className="mt-1 flex items-center text-slate-500">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded mr-1.5">
                            S
                          </span>
                          <span>{sDriver}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-900 text-white rounded mr-1.5">
                            P
                          </span>
                          <span className="font-medium text-slate-800">{pCond}</span>
                        </div>
                        <div className="mt-1 flex items-center text-slate-500">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded mr-1.5">
                            S
                          </span>
                          <span>{sCond}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${
                            health.isLive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {health.isLive ? '● LIVE' : '▲ UNAVAILABLE'}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          {health.lastSeenText}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold tabular-nums text-slate-700">
                        {bus.headcount || 0} / {bus.capacity || 45}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(bus)}
                          className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded hover:bg-slate-100 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(bus)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 border border-rose-200 rounded hover:bg-rose-50 cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Bus Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingBusId ? `Edit Bus #${formData.number}` : 'Register New Bus'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Bus Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Vehicle Registration Plate
                </label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="MP-09-FA-1012"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Assigned Route
                </label>
                {routes.length > 0 ? (
                  <select
                    value={formData.routeId}
                    onChange={(e) => handleRouteSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-900"
                  >
                    <option value="">— Select Route —</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code ? `[${r.code}] ` : ''}{r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.route}
                    onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                    placeholder="e.g. Vijay Nagar - Campus"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Bus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminBuses;
