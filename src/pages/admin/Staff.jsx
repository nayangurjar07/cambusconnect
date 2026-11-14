// src/pages/admin/Staff.jsx
import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Search, Trash2, Edit2, Phone, Bus, AlertCircle, Shield, UserCheck, ShieldCheck } from 'lucide-react';
import { subscribeToStaff, createStaffMember, updateStaffMember, deleteStaffMember, validateStaffRoleConflict, getStaffRoleLabel } from '../../services/workforce';
import { subscribeToBuses } from '../../services/transit';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/layout/PageHeader';
import { useToast } from '../../contexts/ToastContext';

export function AdminStaff() {
  const { showSuccess, showError } = useToast();
  const [staff, setStaff] = useState([]);
  const [buses, setBuses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'driver',
    roleTier: 'primary',
    phone: '',
    assignedBus: '',
    assignedBusId: '',
    licenseNumber: '',
  });

  useEffect(() => {
    const unsubStaff = subscribeToStaff(setStaff);
    const unsubBuses = subscribeToBuses(setBuses);
    return () => {
      unsubStaff();
      unsubBuses();
    };
  }, []);

  const filtered = staff.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.role && s.role.toLowerCase().includes(q)) ||
      (s.staffRoleLabel && s.staffRoleLabel.toLowerCase().includes(q)) ||
      (s.assignedBus && s.assignedBus.toLowerCase().includes(q))
    );
  });

  // Calculate live role assignment conflict
  const roleConflict = (formData.role === 'driver' || formData.role === 'conductor') && formData.assignedBus
    ? validateStaffRoleConflict(staff, formData.assignedBus, formData.role, formData.roleTier, editingStaff?.email)
    : { hasConflict: false };

  const handleBusSelect = (busNumber) => {
    const bus = buses.find(b => String(b.number) === String(busNumber));
    setFormData(prev => ({
      ...prev,
      assignedBus: busNumber,
      assignedBusId: bus ? bus.id : ''
    }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      showError("Please enter staff name and email.");
      return;
    }

    if (roleConflict.hasConflict) {
      showError(roleConflict.message);
      return;
    }

    setSubmitting(true);
    try {
      await createStaffMember(formData);
      showSuccess(`Staff member ${formData.name} added successfully`);
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'driver',
        roleTier: 'primary',
        phone: '',
        assignedBus: '',
        assignedBusId: '',
        licenseNumber: '',
      });
    } catch (err) {
      showError("Failed to add staff: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (member) => {
    setEditingStaff(member);
    const matchedBus = buses.find(b => String(b.number) === String(member.assignedBus));
    setFormData({
      name: member.name || '',
      email: member.email || '',
      password: '',
      role: member.role || 'driver',
      roleTier: member.roleTier || 'primary',
      phone: member.phone || '',
      assignedBus: member.assignedBus || '',
      assignedBusId: member.assignedBusId || (matchedBus ? matchedBus.id : ''),
      licenseNumber: member.licenseNumber || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStaff?.email) return;

    if (roleConflict.hasConflict) {
      showError(roleConflict.message);
      return;
    }

    setSubmitting(true);
    try {
      await updateStaffMember(editingStaff.email, formData);
      showSuccess(`Staff record for ${formData.name} updated`);
      setIsEditModalOpen(false);
      setEditingStaff(null);
    } catch (err) {
      showError("Update failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (email, name) => {
    if (email === 'admin@indoreinstitute.com') {
      showError("Security: The primary system administrator account cannot be deleted.");
      return;
    }

    if (window.confirm(`Remove staff member ${name}?`)) {
      try {
        await deleteStaffMember(email);
        showSuccess(`Staff record removed`);
      } catch (err) {
        showError("Delete failed: " + err.message);
      }
    }
  };

  const renderRoleBadge = (member) => {
    const role = member.role || 'staff';
    const tier = member.roleTier || 'primary';
    const label = member.staffRoleLabel || getStaffRoleLabel(role, tier);

    if (role === 'driver') {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
          tier === 'primary' 
            ? 'bg-blue-50 text-blue-700 border-blue-200' 
            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          <Shield className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }

    if (role === 'conductor') {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
          tier === 'primary' 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
            : 'bg-teal-50 text-teal-700 border-teal-200'
        }`}>
          <UserCheck className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }

    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <ShieldCheck className="w-3 h-3" />
          <span>System Admin</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff & Crew Management"
        subtitle={`${staff.length} registered team members`}
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsAddModalOpen(true)}>
            Add Staff Member
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="max-w-sm w-full">
          <Input
            icon={Search}
            placeholder="Search by name, role, email, or bus..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Member</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Designation & Role</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Assigned Fleet Bus</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Phone</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">License</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((member) => (
                <tr key={member.id || member.email} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-gray-100 text-gray-700 text-xs font-medium flex items-center justify-center shrink-0">
                        {member.name ? member.name.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{member.name}</div>
                        <div className="text-xs text-gray-400">{member.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-2.5">
                    {renderRoleBadge(member)}
                  </td>

                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">
                    {member.assignedBus ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-800">
                        <Bus className="w-3.5 h-3.5 text-blue-600" />
                        <span>Bus {member.assignedBus}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal text-xs">Unassigned</span>
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-sm text-gray-600">
                    {member.phone ? (
                      <a href={`tel:${member.phone}`} className="hover:underline">
                        {member.phone}
                      </a>
                    ) : '—'}
                  </td>

                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                    {member.licenseNumber || '—'}
                  </td>

                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(member)}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="Edit staff member"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.email, member.name)}
                        disabled={member.email === 'admin@indoreinstitute.com'}
                        title={member.email === 'admin@indoreinstitute.com' ? "Primary admin cannot be deleted" : "Delete staff"}
                        className={`p-1.5 rounded-md transition-colors ${
                          member.email === 'admin@indoreinstitute.com' 
                            ? 'text-gray-300 cursor-not-allowed opacity-50' 
                            : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-gray-400">
                    No staff members found matching "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Add Staff Modal ─── */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Staff Member"
      >
        <form onSubmit={handleAddSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name *"
              placeholder="e.g. Ramesh Verma"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Email Address *"
              type="email"
              placeholder="e.g. ramesh@institute.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Login Password *"
              placeholder="e.g. cambus123"
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">Role *</label>
              <select
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="driver">Driver</option>
                <option value="conductor">Conductor</option>
                <option value="staff">Route Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Role Tier Selection (Driver / Conductor) */}
          {(formData.role === 'driver' || formData.role === 'conductor') && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                {formData.role === 'driver' ? 'Driver Tier Slot *' : 'Conductor Tier Slot *'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, roleTier: 'primary' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    formData.roleTier === 'primary'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{formData.role === 'driver' ? 'Primary Driver' : 'Primary Conductor'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, roleTier: 'secondary' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    formData.roleTier === 'secondary'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{formData.role === 'driver' ? 'Secondary (Sub) Driver' : 'Secondary (Sub) Conductor'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Bus Number Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Assigned Fleet Bus</label>
            <select
              value={formData.assignedBus}
              onChange={(e) => handleBusSelect(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              <option value="">— No Bus Assigned (Standby) —</option>
              {buses.map(b => (
                <option key={b.id} value={b.number}>
                  Bus {b.number} {b.route ? `— ${b.route}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Role Conflict Inline Warning */}
          {roleConflict.hasConflict && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-extrabold block">Role Assignment Conflict:</strong>
                <span>{roleConflict.message}</span>
                <p className="mt-1 text-[11px] text-amber-700">
                  Switch to <strong>Secondary ({formData.role === 'driver' ? 'Sub-Driver' : 'Sub-Conductor'})</strong> or select another bus to prevent session collisions.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="License No."
              placeholder="e.g. MP-09-2018-0023412"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={submitting} disabled={roleConflict.hasConflict}>
              Add Staff Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Staff Modal ─── */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Staff — ${editingStaff?.name || ''}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">Role *</label>
              <select
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="driver">Driver</option>
                <option value="conductor">Conductor</option>
                <option value="staff">Route Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Role Tier Selection (Driver / Conductor) */}
          {(formData.role === 'driver' || formData.role === 'conductor') && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                {formData.role === 'driver' ? 'Driver Tier Slot *' : 'Conductor Tier Slot *'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, roleTier: 'primary' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    formData.roleTier === 'primary'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{formData.role === 'driver' ? 'Primary Driver' : 'Primary Conductor'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, roleTier: 'secondary' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    formData.roleTier === 'secondary'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{formData.role === 'driver' ? 'Secondary (Sub) Driver' : 'Secondary (Sub) Conductor'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Bus Number Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Assigned Fleet Bus</label>
            <select
              value={formData.assignedBus}
              onChange={(e) => handleBusSelect(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
            >
              <option value="">— No Bus Assigned (Standby) —</option>
              {buses.map(b => (
                <option key={b.id} value={b.number}>
                  Bus {b.number} {b.route ? `— ${b.route}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Role Conflict Inline Warning */}
          {roleConflict.hasConflict && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-extrabold block">Role Assignment Conflict:</strong>
                <span>{roleConflict.message}</span>
                <p className="mt-1 text-[11px] text-amber-700">
                  Switch to <strong>Secondary ({formData.role === 'driver' ? 'Sub-Driver' : 'Sub-Conductor'})</strong> or select another bus to prevent session collisions.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="License No."
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={submitting} disabled={roleConflict.hasConflict}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
