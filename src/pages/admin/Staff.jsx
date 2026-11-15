// src/pages/admin/Staff.jsx
import React, { useState, useEffect, useMemo } from 'react';
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

    // Auto-select Secondary if Primary is already taken on that bus
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Workforce & Crew Roster
          </span>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">
            Drivers & Conductors Management
          </h1>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition cursor-pointer"
        >
          + Add Driver / Conductor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit">
          {[
            { id: 'all', label: 'All Crew' },
            { id: 'driver', label: 'Drivers' },
            { id: 'conductor', label: 'Conductors' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase transition cursor-pointer ${
                roleFilter === tab.id
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, or Bus #..."
          className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 sm:w-72"
        />
      </div>

      {/* Dense Operations Roster Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase text-slate-500">
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
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No active crew members found.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const tier = member.roleTier || 'primary';
                  const badgeStyle =
                    tier === 'secondary'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-900 text-white border-slate-900';

                  return (
                    <tr key={member.id || member.email} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{member.name || 'Unnamed'}</p>
                        <p className="text-xs font-mono text-slate-500">{member.email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-mono rounded border ${badgeStyle}`}
                        >
                          {getStaffRoleLabel(member.role, tier)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums">
                        {member.assignedBus ? (
                          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded font-semibold text-xs">
                            Bus #{member.assignedBus}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                        <div>{member.phone || '—'}</div>
                        {member.licenseNumber && (
                          <div className="text-[11px] text-slate-400">DL: {member.licenseNumber}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(member)}
                          className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded hover:bg-slate-100 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTerminate(member)}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 border border-rose-200 rounded hover:bg-rose-50 cursor-pointer"
                        >
                          Revoke
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

      {/* Add / Edit Modal with Dynamic Bus Dropdown & Role Tier Validation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold">
                {editingEmail ? 'Edit Crew Assignment' : 'Assign New Driver / Conductor'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-600 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    placeholder="e.g. Rajesh Sharma"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-600 mb-1">
                    Email (Login ID) *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingEmail)}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                    placeholder="driver@cambus.in"
                  />
                </div>
              </div>

              {!editingEmail && (
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-600 mb-1">
                    Initial Portal Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              )}

              {/* Role & Dynamic Bus Number Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-600 mb-1">
                    Crew Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="driver">Driver</option>
                    <option value="conductor">Conductor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-600 mb-1">
                    Assign Bus Number (Dropdown)
                  </label>
                  <select
                    value={formData.assignedBus}
                    onChange={(e) => handleBusChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
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
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase text-slate-600">
                    Assignment Slot (Prevents Primary / Sub-Crew Clash)
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
                          className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                            isSelected
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-mono uppercase font-bold">
                            {tier === 'primary'
                              ? `Primary ${formData.role}`
                              : `Secondary (Sub) ${formData.role}`}
                          </div>
                          <div
                            className={`text-[11px] mt-1 ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
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
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs">
                  <strong>Slot Conflict:</strong> {conflictCheck.message} Select the Secondary slot or choose another bus.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-600 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    placeholder="+91 9876543210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-600 mb-1">
                    License / Badge ID
                  </label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    placeholder="MP-09-XXXX"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || conflictCheck.hasConflict}
                  className="px-5 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingEmail ? 'Update Assignment' : 'Save Crew Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminStaff;
