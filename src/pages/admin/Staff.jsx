// src/pages/admin/Staff.jsx
import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Search, Trash2, Edit2, Phone, Bus } from 'lucide-react';
import { subscribeToStaff, createStaffMember, updateStaffMember, deleteStaffMember } from '../../services/workforce';
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
    phone: '',
    assignedBus: '',
    licenseNumber: '',
  });

  useEffect(() => {
    const unsub = subscribeToStaff(setStaff);
    return () => unsub();
  }, []);

  const filtered = staff.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.role && s.role.toLowerCase().includes(q)) ||
      (s.assignedBus && s.assignedBus.toLowerCase().includes(q))
    );
  });

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      showError("Please enter staff name and email.");
      return;
    }

    setSubmitting(true);
    try {
      await createStaffMember(formData);
      showSuccess(`Staff member ${formData.name} added`);
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'driver',
        phone: '',
        assignedBus: '',
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
    setFormData({
      name: member.name || '',
      email: member.email || '',
      password: '', // Not used in edit mode
      role: member.role || 'driver',
      phone: member.phone || '',
      assignedBus: member.assignedBus || '',
      licenseNumber: member.licenseNumber || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStaff?.email) return;

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        subtitle={`${staff.length} team members`}
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsAddModalOpen(true)}>
            Add Staff
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
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Role</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Assigned Bus</th>
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
                    <Badge variant={member.role === 'driver' ? 'primary' : 'neutral'} className="capitalize">
                      {member.role || 'Staff'}
                    </Badge>
                  </td>

                  <td className="px-4 py-2.5 text-sm text-gray-600">
                    {member.assignedBus ? `Bus ${member.assignedBus}` : '—'}
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

      {/* Add Staff Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Staff Member"
      >
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name"
              placeholder="e.g. Ramesh Verma"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="e.g. ramesh@institute.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Login Password"
              placeholder="e.g. cambus123"
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Role</label>
              <select
                className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="driver">Driver</option>
                <option value="conductor">Conductor</option>
                <option value="staff">Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <Input
              label="Assigned Bus"
              placeholder="e.g. 14"
              value={formData.assignedBus}
              onChange={(e) => setFormData({ ...formData, assignedBus: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
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
            <Button variant="primary" size="sm" type="submit" isLoading={submitting}>
              Add Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Staff — ${editingStaff?.name || ''}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Role</label>
              <select
                className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="driver">Driver</option>
                <option value="conductor">Conductor</option>
                <option value="staff">Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Assigned Bus"
              value={formData.assignedBus}
              onChange={(e) => setFormData({ ...formData, assignedBus: e.target.value })}
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <Input
            label="License No."
            value={formData.licenseNumber}
            onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
