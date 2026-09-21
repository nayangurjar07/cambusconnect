// src/pages/admin/Buses.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Plus, Edit2, Trash2, MapPin, User, Route as RouteIcon, ShieldAlert } from 'lucide-react';
import { subscribeToBuses, createBus, updateBus, deleteBus } from '../../services/transit';
import { subscribeToRoutes } from '../../services/transit';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusIndicator } from '../../components/ui/StatusIndicator';
import { Badge } from '../../components/ui/Badge';

export function AdminBuses() {
  const { showSuccess, showError } = useToast();
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [formData, setFormData] = useState({
    number: '',
    registrationNumber: '',
    route: '',
    routeId: '',
    capacity: 45,
    driver: '',
    phone: '',
    conductor: '',
    conductorPhone: '',
    status: 'On Time'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubBuses = subscribeToBuses(setBuses);
    const unsubRoutes = subscribeToRoutes(setRoutes);
    return () => {
      unsubBuses();
      unsubRoutes();
    };
  }, []);

  const openModal = (bus = null) => {
    if (bus) {
      setEditingBus(bus);
      setFormData({
        number: bus.number || '',
        registrationNumber: bus.registrationNumber || '',
        route: bus.route || '',
        routeId: bus.routeId || '',
        capacity: bus.capacity || 45,
        driver: bus.driver || '',
        phone: bus.phone || '',
        conductor: bus.conductor || '',
        conductorPhone: bus.conductorPhone || '',
        status: bus.status || 'On Time'
      });
    } else {
      setEditingBus(null);
      setFormData({
        number: '',
        registrationNumber: '',
        route: routes[0]?.name || '',
        routeId: routes[0]?.id || '',
        capacity: 45,
        driver: '',
        phone: '',
        conductor: '',
        conductorPhone: '',
        status: 'On Time'
      });
    }
    setIsModalOpen(true);
  };

  const handleRouteChange = (e) => {
    const selectedRouteId = e.target.value;
    if (!selectedRouteId) {
      setFormData(prev => ({ ...prev, routeId: '', route: '' }));
      return;
    }
    const matched = routes.find(r => r.id === selectedRouteId);
    if (matched) {
      setFormData(prev => ({ ...prev, routeId: matched.id, route: matched.name }));
    } else {
      setFormData(prev => ({ ...prev, routeId: '', route: selectedRouteId }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.number.trim()) {
      showError('Bus number is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        capacity: Number(formData.capacity) || 45
      };
      if (editingBus) {
        await updateBus(editingBus.id, payload);
        showSuccess(`Bus ${formData.number} updated`);
      } else {
        await createBus(payload);
        showSuccess(`Bus ${formData.number} added`);
      }
      setIsModalOpen(false);
    } catch (err) {
      showError('Failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (bus) => {
    if (!window.confirm(`Remove Bus ${bus.number}? This will permanently unregister the vehicle.`)) return;
    try {
      await deleteBus(bus.id);
      showSuccess(`Bus ${bus.number} removed`);
    } catch (err) {
      showError('Failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fleet Vehicles"
        subtitle={`${buses.length} registered campus buses`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/admin/routes">
              <Button variant="outline" size="sm" icon={RouteIcon}>
                Manage Routes
              </Button>
            </Link>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => openModal()}>
              Add Bus
            </Button>
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Bus No</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Reg Number</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Assigned Route</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Capacity & Occupancy</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Driver</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Conductor</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {buses.map(bus => {
                const capacity = Number(bus.capacity) || 45;
                const headcount = Number(bus.headcount) || 0;
                const isFull = headcount >= capacity;
                const isNearFull = headcount >= capacity * 0.85;

                return (
                  <tr key={bus.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-bold text-gray-900">
                      Bus {bus.number}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-600">
                      {bus.registrationNumber || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700 max-w-[200px] truncate">
                      {bus.route || 'Unassigned'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold font-mono ${
                          isFull ? 'text-red-700' : isNearFull ? 'text-amber-700' : 'text-gray-700'
                        }`}>
                          {headcount} / {capacity}
                        </span>
                        {isFull && (
                          <span className="px-1.5 py-0.2 bg-red-100 text-red-700 text-[10px] font-bold rounded">
                            FULL
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 max-w-[120px] truncate">
                      <div>{bus.driver || '—'}</div>
                      {bus.phone && <div className="text-xs text-gray-400">{bus.phone}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 max-w-[120px] truncate">
                      <div>{bus.conductor || '—'}</div>
                      {bus.conductorPhone && <div className="text-xs text-gray-400">{bus.conductorPhone}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusIndicator status={bus.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openModal(bus)}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Edit Bus"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(bus)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="Remove Bus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {buses.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">
              No buses registered. Click "Add Bus" to register a fleet vehicle.
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBus ? `Edit Bus ${editingBus.number}` : 'Register New Vehicle'}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Bus Number"
              placeholder="e.g. 101"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              required
            />
            <Input
              label="Registration Number"
              placeholder="e.g. MP-09-FA-1234"
              value={formData.registrationNumber}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Assigned Route
              </label>
              <select
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.routeId || ''}
                onChange={handleRouteChange}
              >
                <option value="">-- Select Route --</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.code} - {r.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              type="number"
              min="1"
              max="120"
              label="Passenger Capacity"
              placeholder="e.g. 45"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Driver Name"
              placeholder="e.g. Ramesh Kumar"
              value={formData.driver}
              onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
            />
            <Input
              label="Driver Phone"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Conductor Name"
              placeholder="e.g. Suresh Patel"
              value={formData.conductor}
              onChange={(e) => setFormData({ ...formData, conductor: e.target.value })}
            />
            <Input
              label="Conductor Phone"
              placeholder="+91 9876543212"
              value={formData.conductorPhone}
              onChange={(e) => setFormData({ ...formData, conductorPhone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Operating Status
            </label>
            <select
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="On Time">On Time</option>
              <option value="Delayed">Delayed</option>
              <option value="Inactive">Inactive</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={submitting}>
              {editingBus ? 'Save Changes' : 'Add Bus'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
