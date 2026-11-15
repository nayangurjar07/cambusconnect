// src/pages/admin/Staff.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { UserCheck, Plus, Search, Edit2, Trash2, ShieldCheck, Bus, Phone, CreditCard, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeToStaff,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
  validateStaffRoleConflict,
  getStaffRoleLabel
} from '../../services/workforce';
import { subscribeToBuses } from '../../services/transit';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const INITIAL_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'driver',
  roleTier: 'primary',
  assignedBus: '',
  assignedBusId: '',
  licenseNumber: '',
  status: 'Active'
};

export function AdminStaff() {
  const { showSuccess, showError } = useToast();
  const [staff, setStaff] = useState([]);
  const [buses, setBuses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubStaff = subscribeToStaff(setStaff);
    const unsubBuses = subscribeToBuses(setBuses);
    return () => {
      unsubStaff();
      unsubBuses();
    };
  }, []);

  // Real-time role & bus slot conflict check
  const conflictCheck = useMemo(() => {
    if (!formData.assignedBus || (formData.role !== 'driver' && formData.role !== 'conductor')) {
      return { hasConflict: false };
    }
    return validateStaffRoleConflict(
      staff,
      formData.assignedBus,
      formData.role,
      formData.roleTier,
      editingEmail
    );
  }, [staff, formData.assignedBus, formData.role, formData.roleTier, editingEmail]);

  // Helper to inspect which slots are already occupied on a selected bus
  const selectedBusOccupancy = useMemo(() => {
    if (!formData.assignedBus) return { primary: null, secondary: null };
    const primaryCheck = validateStaffRoleConflict(
      staff,
      formData.assignedBus,
      formData.role,
      'primary',
      editingEmail
    );
    const secondaryCheck = validateStaffRoleConflict(
      staff,
      formData.assignedBus,
      formData.role,
      'secondary',
      editingEmail
    );
    return {
      primary: primaryCheck.conflictingMember || null,
      secondary: secondaryCheck.conflictingMember || null
    };
  }, [staff, formData.assignedBus, formData.role, editingEmail]);

  const openCreateModal = () => {
    setEditingEmail(null);
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (member) => {
    setEditingEmail(member.email);
    setFormData({
      name: member.name || '',
      email: member.email || '',
      password: '',
      phone: member.phone || '',
      role: member.role || 'driver',
      roleTier: member.roleTier || 'primary',
      assignedBus: member.assignedBus || '',
      assignedBusId: member.assignedBusId || '',
      licenseNumber: member.licenseNumber || '',
      status: member.status || 'Active'
    });
    setIsModalOpen(true);
  };

  const handleBusChange = (busNumber) => {
    const matchedBus = buses.find((b) => String(b.number) === String(busNumber));
    let nextTier = formData.roleTier;

    if (busNumber && (formData.role === 'driver' || formData.role === 'conductor')) {
      const primaryTaken = validateStaffRoleConflict(
        staff,
        busNumber,
        formData.role,
        'primary',
        editingEmail
      ).hasConflict;
      const secondaryTaken = validateStaffRoleConflict(
        staff,
        busNumber,
        formData.role,
        'secondary',
        editingEmail
      ).hasConflict;

      if (primaryTaken && !secondaryTaken) {
        nextTier = 'secondary';
      } else if (!primaryTaken) {
        nextTier = 'primary';
      }
    }

    setFormData((prev) => ({
      ...prev,
      assignedBus: busNumber,
      assignedBusId: matchedBus?.id || '',
      roleTier: nextTier
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      showError('Name and Email are required.');
      return;
    }
    if (conflictCheck.hasConflict) {
      showError(conflictCheck.message);
      return;
    }

    setSaving(true);
    try {
      if (editingEmail) {
        await updateStaffMember(editingEmail, formData);
        showSuccess(`Updated ${formData.name}`);
      } else {
        await createStaffMember(formData);
        showSuccess(`Added ${formData.name} as ${getStaffRoleLabel(formData.role, formData.roleTier)}`);
      }
      setIsModalOpen(false);
    } catch (err) {
      showError(err.message || 'Failed to save staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleTerminate = async (member) => {
    if (!window.confirm(`Revoke access and terminate ${member.name || member.email}?`)) return;
    try {
      await deleteStaffMember(member.email);
      showSuccess(`Access revoked for ${member.email}`);
    } catch (err) {
      showError('Failed to revoke staff member');
    }
  };

  const filteredStaff = staff.filter((s) => {
    if (s.status === 'Terminated' || s.role === 'revoked') return false;
    if (roleFilter !== 'all' && s.role !== roleFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      String(s.assignedBus || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 font-sans text-slate-900">
      {/* Header */}
      <PageHeader
        title="Drivers & Conductors Roster"
        subtitle="Manage assigned transit personnel, primary/secondary crew slots, and vehicle authorizations"
        badge={
          <Badge variant="primary" dot>
            {filteredStaff.length} Active Personnel
          </Badge>
        }
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={openCreateModal}
          >
            Add Driver / Conductor
          </Button>
        }
      />

      {/* Filters Strip */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          {[
            { id: 'all', label: 'All Crew' },
            { id: 'driver', label: 'Drivers' },
            { id: 'conductor', label: 'Conductors' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                roleFilter === tab.id
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or Bus #..."
            className="w-full pl-10 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Operations Roster Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role & Tier</th>
                <th className="py-3 px-4">Assigned Bus</th>
                <th className="py-3 px-4">Contact / License</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                    No active crew members found. Click "+ Add Driver / Conductor" to assign personnel.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const tier = member.roleTier || 'primary';
                  return (
                    <tr key={member.id || member.email} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{member.name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={tier === 'secondary' ? 'warning' : 'primary'}>
                          {getStaffRoleLabel(member.role, tier)}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 tabular-nums">
                        {member.assignedBus ? (
                          <span className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg font-bold text-xs">
                            Bus #{member.assignedBus}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums">
                        <div className="font-semibold text-slate-800">{member.phone || '—'}</div>
                        {member.licenseNumber && (
                          <div className="text-[11px] text-slate-400">DL: {member.licenseNumber}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={Edit2}
                          onClick={() => openEditModal(member)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={Trash2}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleTerminate(member)}
                        >
                          Revoke
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

      {/* Modal with Dynamic Bus Dropdown & Role Tier Validation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingEmail ? 'Edit Crew Assignment' : 'Assign New Driver / Conductor'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
                    placeholder="e.g. Rajesh Sharma"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email (Login ID) *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingEmail)}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder="driver@cambus.in"
                  />
                </div>
              </div>

              {!editingEmail && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Portal Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              )}

              {/* Role & Dynamic Bus Number Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Crew Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                  >
                    <option value="driver">Driver</option>
                    <option value="conductor">Conductor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Bus (Live Registry Dropdown)
                  </label>
                  <select
                    value={formData.assignedBus}
                    onChange={(e) => handleBusChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                  >
                    <option value="">— Unassigned —</option>
                    {buses.map((b) => (
                      <option key={b.id} value={b.number}>
                        Bus #{b.number} ({b.route || 'No Route'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Primary vs Secondary Tier Selector */}
              {(formData.role === 'driver' || formData.role === 'conductor') && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Assignment Slot (Prevents Crew Clash)
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {['primary', 'secondary'].map((tier) => {
                      const occupiedBy =
                        tier === 'primary'
                          ? selectedBusOccupancy.primary
                          : selectedBusOccupancy.secondary;
                      const isSelected = formData.roleTier === tier;

                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => setFormData({ ...formData, roleTier: tier })}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-2xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="text-xs font-bold uppercase tracking-wider">
                            {tier === 'primary'
                              ? `Primary ${formData.role}`
                              : `Secondary (Sub) ${formData.role}`}
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 ${
                              isSelected ? 'text-blue-700' : 'text-slate-400'
                            }`}
                          >
                            {occupiedBy
                              ? `Occupied: ${occupiedBy.name || occupiedBy.email}`
                              : 'Slot Available'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live Conflict Warning */}
              {conflictCheck.hasConflict && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs">
                  <strong>Slot Conflict:</strong> {conflictCheck.message}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
                    placeholder="+91 9876543210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    License / Badge ID
                  </label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
                    placeholder="MP-09-XXXX"
                  />
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
                  disabled={saving || conflictCheck.hasConflict}
                  isLoading={saving}
                >
                  {editingEmail ? 'Update Assignment' : 'Save Crew Member'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminStaff;