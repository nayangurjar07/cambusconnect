// src/pages/admin/Routes.jsx
import React, { useState, useEffect } from 'react';
import { 
  Route as RouteIcon, Plus, Edit2, Trash2, MapPin, 
  Clock, CheckCircle2, XCircle, ArrowUp, ArrowDown, ChevronRight, ChevronDown 
} from 'lucide-react';
import { 
  subscribeToRoutes, 
  createRoute, 
  updateRoute, 
  deleteRoute, 
  seedDefaultRoutesIfEmpty 
} from '../../services/transit';
import { subscribeToShiftConfig } from '../../services/workforce';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../contexts/ToastContext';

function formatShiftLabel(shiftId, shifts = []) {
  const match = shifts.find(s => s.id === shiftId);
  if (match?.name) return match.name;
  if (shiftId === 'shift_1') return 'Morning Pickup (Shift 1)';
  if (shiftId === 'shift_2') return 'Evening Drop (Shift 2)';
  return shiftId ? shiftId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Default Shift';
}

export function AdminRoutes() {
  const { showSuccess, showError } = useToast();
  const [routes, setRoutes] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    active: true,
    assignedShiftIds: ['shift_1'],
    stops: []
  });

  useEffect(() => {
    const unsubRoutes = subscribeToRoutes(setRoutes);
    const unsubShifts = subscribeToShiftConfig(setShifts);
    return () => {
      unsubRoutes();
      unsubShifts();
    };
  }, []);

  const openModal = (route = null) => {
    if (route) {
      setEditingRoute(route);
      setFormData({
        code: route.code || '',
        name: route.name || '',
        active: route.active !== false,
        assignedShiftIds: route.assignedShiftIds || ['shift_1'],
        stops: Array.isArray(route.stops) ? JSON.parse(JSON.stringify(route.stops)) : []
      });
    } else {
      setEditingRoute(null);
      setFormData({
        code: `R${routes.length + 1}`,
        name: '',
        active: true,
        assignedShiftIds: ['shift_1'],
        stops: [
          { id: `s_${Date.now()}_1`, name: '', landmark: '', sequence: 1, pickupTime: '08:00 AM' }
        ]
      });
    }
    setIsModalOpen(true);
  };

  const handleAddStop = () => {
    const newSeq = formData.stops.length + 1;
    setFormData(prev => ({
      ...prev,
      stops: [
        ...prev.stops,
        { id: `s_${Date.now()}_${newSeq}`, name: '', landmark: '', sequence: newSeq, pickupTime: '08:15 AM' }
      ]
    }));
  };

  const handleUpdateStop = (index, field, value) => {
    setFormData(prev => {
      const nextStops = [...prev.stops];
      nextStops[index] = { ...nextStops[index], [field]: value };
      return { ...prev, stops: nextStops };
    });
  };

  const handleRemoveStop = (index) => {
    setFormData(prev => {
      const filtered = prev.stops.filter((_, i) => i !== index);
      // Re-sequence
      const resequenced = filtered.map((s, idx) => ({ ...s, sequence: idx + 1 }));
      return { ...prev, stops: resequenced };
    });
  };

  const handleMoveStop = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= formData.stops.length) return;
    setFormData(prev => {
      const stops = [...prev.stops];
      const temp = stops[index];
      stops[index] = stops[targetIdx];
      stops[targetIdx] = temp;
      const resequenced = stops.map((s, idx) => ({ ...s, sequence: idx + 1 }));
      return { ...prev, stops: resequenced };
    });
  };

  const handleToggleShift = (shiftId) => {
    setFormData(prev => {
      const current = prev.assignedShiftIds || [];
      const updated = current.includes(shiftId)
        ? current.filter(id => id !== shiftId)
        : [...current, shiftId];
      return { ...prev, assignedShiftIds: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showError('Route name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingRoute) {
        await updateRoute(editingRoute.id, formData);
        showSuccess(`Route ${formData.code} updated`);
      } else {
        await createRoute(formData);
        showSuccess(`Route ${formData.code} created`);
      }
      setIsModalOpen(false);
    } catch (err) {
      showError('Failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteRoute = async () => {
    if (!routeToDelete) return;
    setIsDeleting(true);
    try {
      await deleteRoute(routeToDelete.id);
      showSuccess(`Route ${routeToDelete.code} deleted`);
      setRouteToDelete(null);
    } catch (err) {
      showError('Failed to delete route: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await seedDefaultRoutesIfEmpty();
      showSuccess("Default routes seeded into Firestore!");
    } catch (err) {
      showError("Seed failed: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transit Routes"
        subtitle={`${routes.length} defined campus ${routes.length === 1 ? 'route' : 'routes'} with structured pickup waypoints`}
        actions={
          <div className="flex items-center gap-2">
            {!import.meta.env.PROD && (
              <Button variant="ghost" size="sm" onClick={handleSeedDefaults}>
                Seed Defaults
              </Button>
            )}
            <Button variant="primary" size="sm" icon={Plus} onClick={() => openModal()}>
              Add Route
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        {routes.map(route => {
          const isExpanded = expandedRouteId === route.id;
          const stopsCount = route.stops?.length || 0;

          return (
            <Card key={route.id} className="overflow-hidden border border-gray-200">
              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <button 
                    type="button" 
                    onClick={() => setExpandedRouteId(isExpanded ? null : route.id)}
                    className="mt-0.5 p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-200">
                        {route.code || 'R'}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900">{route.name}</h3>
                      <Badge variant={route.active !== false ? 'success' : 'neutral'}>
                        {route.active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {stopsCount} {stopsCount === 1 ? 'Stop' : 'Stops'}
                      </span>
                      {route.assignedShiftIds?.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>Shifts: </span>
                          {route.assignedShiftIds.map(sId => (
                            <span key={sId} className="bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded text-[11px] font-medium">
                              {formatShiftLabel(sId, shifts)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Edit2}
                    onClick={() => openModal(route)}
                  >
                    Edit Route
                  </Button>
                  <button
                    onClick={() => setRouteToDelete(route)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                    title="Delete Route"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Collapsible Stops List */}
              {isExpanded && (
                <div className="bg-gray-50/70 border-t border-gray-100 p-4">
                  <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Pickup Waypoints & Landmark Schedule
                  </div>
                  {stopsCount === 0 ? (
                    <p className="text-xs text-gray-400 italic">No stops added yet to this route.</p>
                  ) : (
                    <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-200">
                      {route.stops.map((stop, idx) => (
                        <div key={stop.id || idx} className="relative flex items-center justify-between text-xs">
                          <div className="absolute -left-6 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold ring-4 ring-white">
                            {stop.sequence || idx + 1}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900">{stop.name}</span>
                            {stop.landmark && (
                              <span className="text-gray-500 ml-2">({stop.landmark})</span>
                            )}
                          </div>
                          <span className="font-mono text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-2xs">
                            {stop.pickupTime || '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {routes.length === 0 && (
          <div className="p-12 text-center text-sm text-gray-400 border border-dashed rounded-lg">
            No routes configured yet. Click "Add Route" or "Seed Defaults" to populate routes.
          </div>
        )}
      </div>

      {/* Add / Edit Route Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoute ? `Edit Route — ${editingRoute.name}` : 'Create Campus Route'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Route Code"
              placeholder="e.g. R1"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
            <div className="col-span-2">
              <Input
                label="Route Name"
                placeholder="e.g. Route 1 - Annapurna / Rajendra Nagar"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-4 py-2 border-y border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
              <span className="text-xs font-medium text-gray-900">Route is Active</span>
            </label>

            <div className="text-xs text-gray-500 border-l border-gray-200 pl-4 flex items-center gap-2">
              <span className="font-medium text-gray-700">Shifts:</span>
              {shifts.map(shift => {
                const isChecked = (formData.assignedShiftIds || []).includes(shift.id);
                return (
                  <label key={shift.id} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={isChecked}
                      onChange={() => handleToggleShift(shift.id)}
                    />
                    <span className="text-xs text-gray-700">{shift.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Stops List Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-900">
                Pickup Stops ({formData.stops.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={handleAddStop}
              >
                Add Stop
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {formData.stops.map((stop, idx) => (
                <div key={stop.id || idx} className="p-2.5 bg-gray-50 rounded-md border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-700 w-5">#{idx + 1}</span>
                    <Input
                      placeholder="Stop Name (e.g. Annapurna Mandir)"
                      value={stop.name}
                      onChange={(e) => handleUpdateStop(idx, 'name', e.target.value)}
                      className="flex-1"
                      required
                    />
                    <Input
                      placeholder="Landmark"
                      value={stop.landmark || ''}
                      onChange={(e) => handleUpdateStop(idx, 'landmark', e.target.value)}
                      className="w-1/3"
                    />
                    <Input
                      placeholder="Pickup Time"
                      value={stop.pickupTime || ''}
                      onChange={(e) => handleUpdateStop(idx, 'pickupTime', e.target.value)}
                      className="w-24"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveStop(idx, -1)}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === formData.stops.length - 1}
                        onClick={() => handleMoveStop(idx, 1)}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(idx)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {formData.stops.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No stops added. Click "Add Stop" to create stops along this route.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={submitting}>
              {editingRoute ? 'Save Changes' : 'Create Route'}
            </Button>
          </div>
        </form>
      </Modal>
      {/* Delete Route Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(routeToDelete)}
        onClose={() => setRouteToDelete(null)}
        onConfirm={confirmDeleteRoute}
        isLoading={isDeleting}
        title="Delete Transit Route"
        message={`Are you sure you want to delete Route "${routeToDelete?.name}" (${routeToDelete?.code})? Buses and students assigned to this route will need to be updated.`}
        confirmText="Delete Route"
        variant="danger"
      />
    </div>
  );
}
