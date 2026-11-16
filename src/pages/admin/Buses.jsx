// src/pages/admin/Buses.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Plus, Edit2, Trash2, Route, Users, Radio, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeToBuses,
  subscribeToRoutes,
  createBus,
  updateBus,
  deleteBus,
  getBusTrackingHealth
} from '../../services/transit';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

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
  const navigate = useNavigate();
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
    } catch (_) {
      showError('Could not delete bus');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 text-slate-900 font-sans">
      {/* Header */}
      <PageHeader
        title="Fleet Registry & Crew Slots"
        subtitle="Manage campus buses, registration details, dedicated assigned routes, and operational crew"
        badge={
          <Badge variant="primary" dot>
            {buses.length} {buses.length === 1 ? 'Vehicle' : 'Vehicles'}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Route}
              onClick={() => navigate('/admin/routes')}
            >
              Route Network
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={openCreateModal}
            >
              Register New Bus
            </Button>
          </div>
        }
      />

      {/* Fleet Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Bus # / Reg</th>
                <th className="py-3 px-4">Dedicated Route</th>
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
                  <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                    No buses registered yet. Click "+ Register New Bus" to add fleet vehicles.
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
                    <tr key={bus.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">Bus #{bus.number}</span>
                        {bus.registrationNumber && (
                          <span className="text-xs text-slate-400 block">{bus.registrationNumber}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {bus.route ? (
                          <Badge variant="primary">{bus.route}</Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditModal(bus)}
                            className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                          >
                            + Assign Route
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="primary" className="text-[10px] px-1.5 py-0">P</Badge>
                          <span className="font-semibold text-slate-800">{pDriver}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0">S</Badge>
                          <span>{sDriver}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="primary" className="text-[10px] px-1.5 py-0">P</Badge>
                          <span className="font-semibold text-slate-800">{pCond}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0">S</Badge>
                          <span>{sCond}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <Badge variant={health.isLive ? 'success' : 'danger'} dot>
                          {health.isLive ? 'LIVE' : 'UNAVAILABLE'}
                        </Badge>
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          {health.lastSeenText}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold tabular-nums text-slate-800">
                        {bus.headcount || 0} / {bus.capacity || 45}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={Edit2}
                          onClick={() => openEditModal(bus)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={Trash2}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleDelete(bus)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Bus Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingBusId ? `Edit Bus #${formData.number}` : 'Register New Bus'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bus Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
                    placeholder="e.g. 14"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registration No
                  </label>
                  <input
                    type="text"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
                    placeholder="MP-09-FA-1234"
                  />
                </div>
              </div>

              {/* Dedicated Route Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Dedicated Assigned Route
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      navigate('/admin/routes');
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Manage Routes →
                  </button>
                </div>
                <select
                  value={formData.routeId || ''}
                  onChange={(e) => handleRouteSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                >
                  <option value="">— Select Institutional Route —</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.stops?.length || 0} stops)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operational Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                  >
                    <option value="On Time">On Time</option>
                    <option value="Delayed">Delayed</option>
                    <option value="Breakdown">Breakdown</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={saving}
                >
                  {editingBusId ? 'Update Bus' : 'Register Bus'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminBuses;