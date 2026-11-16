// src/pages/admin/Students.jsx
import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Trash2, Edit2, ShieldCheck, Mail, Phone, 
  Upload, Download, CheckSquare, Square, ChevronLeft, ChevronRight, 
  Filter, AlertCircle, CheckCircle2, ShieldAlert, Bus, MapPin, Key
} from 'lucide-react';
import { 
  getPaginatedStudents, 
  createStudent, 
  updateStudent, 
  deleteStudent,
  bulkGeneratePasswords,
  bulkDeleteStudents,
  bulkUpdateStudentStatus,
  bulkExtendPassValidity
} from '../../services/students';
import { subscribeToRoutes } from '../../services/transit';
import { subscribeToBuses } from '../../services/transit';
import { subscribeToStudentSchema } from '../../services/students';
import { StudentCsvImportModal } from '../../components/domain/StudentCsvImportModal';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/layout/PageHeader';
import { useToast } from '../../contexts/ToastContext';

export function formatPassDate(rawVal) {
  if (!rawVal) return '—';
  try {
    const d = new Date(rawVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  } catch (_) {}
  if (typeof rawVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawVal)) {
    const parts = rawVal.slice(0, 10).split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthName = months[parseInt(parts[1], 10) - 1] || parts[1];
    return `${parts[2]} ${monthName} ${parts[0]}`;
  }
  return String(rawVal);
}

export function AdminStudents() {
  const { showSuccess, showError } = useToast();
  const [students, setStudents] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [schema, setSchema] = useState([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisibleDocs, setLastVisibleDocs] = useState({});
  const PAGE_SIZE = 25;

  // Selection & Bulk
  const [selectedEmails, setSelectedEmails] = useState(new Set());

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    collegeId: '',
    phone: '',
    parentPhone: '',
    busRoute: '',
    routeId: '',
    assignedBusNumber: '',
    pickupStop: '',
    passValidity: '2026-12-31',
    status: 'Active'
  });

  useEffect(() => {
    const unsubRoutes = subscribeToRoutes(setRoutes);
    const unsubBuses = subscribeToBuses(setBuses);
    const unsubSchema = subscribeToStudentSchema(setSchema);

    return () => {
      unsubRoutes();
      unsubBuses();
      unsubSchema();
    };
  }, []);

  const fetchPage = async (pageNumber, isReset = false) => {
    setIsLoading(true);
    try {
      const cursor = (isReset || pageNumber === 1) ? null : lastVisibleDocs[pageNumber - 1];
      const { students: newStudents, lastVisible, totalCount } = await getPaginatedStudents(
        PAGE_SIZE,
        cursor,
        selectedRouteFilter,
        selectedStatusFilter,
        searchQuery
      );
      
      setStudents(newStudents);
      setTotalStudents(totalCount);
      if (lastVisible) {
        setLastVisibleDocs(prev => ({ ...prev, [pageNumber]: lastVisible }));
      }
    } catch (err) {
      showError("Failed to load students: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery) {
      fetchPage(currentPage);
    }
  }, [currentPage, selectedRouteFilter, selectedStatusFilter]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      setLastVisibleDocs({});
      fetchPage(1, true);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedRouteFilter, selectedStatusFilter]);

  // Compute pass status normalized
  const getPassStatus = (student) => {
    if (student.status === 'Revoked' || student.status === 'revoked') {
      return { label: 'Revoked', variant: 'danger', code: 'REVOKED' };
    }
    if (student.status === 'Inactive' || student.status === 'inactive') {
      return { label: 'Inactive', variant: 'neutral', code: 'INACTIVE' };
    }

    if (!student.passValidity) {
      return { label: 'Active', variant: 'success', code: 'ACTIVE' };
    }

    let validUntil = null;
    try {
      if (typeof student.passValidity === 'string') {
        if (student.passValidity.includes('T')) {
          validUntil = new Date(student.passValidity);
        } else {
          validUntil = new Date(`${student.passValidity}T23:59:59`);
        }
      } else if (student.passValidity instanceof Date) {
        validUntil = student.passValidity;
      }
    } catch (_) {}

    if (!validUntil || isNaN(validUntil.getTime()) || validUntil < new Date()) {
      return { label: 'Expired', variant: 'danger', code: 'EXPIRED' };
    }

    return { label: 'Active', variant: 'success', code: 'ACTIVE' };
  };

  const filteredStudents = students; // Filtering is now handled server-side

  // Pagination slices
  const totalPages = Math.max(1, Math.ceil(totalStudents / PAGE_SIZE));
  const pagedStudents = students;

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const all = new Set(pagedStudents.map(s => s.email));
      setSelectedEmails(all);
    } else {
      setSelectedEmails(new Set());
    }
  };

  const handleToggleSelect = (email) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  // Bulk Operations
  const handleBulkExtendValidity = () => {
    if (selectedEmails.size === 0) return;
    setConfirmAction({
      title: 'Extend Pass Validity',
      message: `Extend bus pass validity for ${selectedEmails.size} selected students by 6 months?`,
      confirmText: 'Extend Validity',
      variant: 'primary',
      onConfirm: async () => {
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + 6);
        const isoDate = futureDate.toISOString().split('T')[0];

        try {
          const emailList = Array.from(selectedEmails);
          const res = await bulkExtendPassValidity(emailList, isoDate);
          showSuccess(`Extended pass validity for ${res.updatedCount} students (Atomic Batch)`);
          setSelectedEmails(new Set());
          await fetchPage(1);
        } catch (err) {
          showError("Bulk extend failed: " + err.message);
        }
      }
    });
  };

  const handleBulkRevoke = () => {
    if (selectedEmails.size === 0) return;
    setConfirmAction({
      title: 'Revoke Pass Privileges',
      message: `Revoke bus pass privileges for ${selectedEmails.size} selected students?`,
      confirmText: 'Revoke Passes',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const emailList = Array.from(selectedEmails);
          const res = await bulkUpdateStudentStatus(emailList, 'Revoked');
          showSuccess(`Revoked ${res.updatedCount} passes (Atomic Batch)`);
          setSelectedEmails(new Set());
          await fetchPage(1);
        } catch (err) {
          showError("Bulk revoke failed: " + err.message);
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedEmails.size === 0) return;
    setConfirmAction({
      title: 'Delete Student Records',
      message: `PERMANENTLY DELETE ${selectedEmails.size} students? This cannot be undone.`,
      confirmText: 'Delete Permanently',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const emailList = Array.from(selectedEmails);
          const res = await bulkDeleteStudents(emailList);
          showSuccess(`Permanently deleted ${res.deletedCount} student records (Atomic Batch)`);
          setSelectedEmails(new Set());
          await fetchPage(1);
        } catch (err) {
          showError("Bulk delete failed: " + err.message);
        }
      }
    });
  };

  const handleBulkGeneratePasswords = () => {
    const targetEmails = selectedEmails.size > 0 
      ? Array.from(selectedEmails) 
      : filteredStudents.map(s => s.email);
    
    if (targetEmails.length === 0) return;

    setConfirmAction({
      title: 'Generate Student Passwords',
      message: `Auto-generate passwords for ${targetEmails.length} students?\n\nA CSV file with the generated credentials will be downloaded immediately.`,
      confirmText: 'Generate Passwords',
      variant: 'primary',
      onConfirm: async () => {
        try {
          const results = await bulkGeneratePasswords(targetEmails);
          
          // Generate CSV output
          const headers = ['Email', 'Generated Password', 'Status'];
          const rows = results.map(r => `"${r.email}","${r.password}","${r.status}"`);
          const csvContent = `${headers.join(',')}\n${rows.join('\n')}\n`;
          
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `cambus_student_passwords_${new Date().toISOString().split('T')[0]}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          const successCount = results.filter(r => r.status === 'Created').length;
          if (successCount > 0) {
            showSuccess(`Generated ${successCount} new passwords and downloaded CSV`);
          } else {
            showSuccess(`Processed credentials for ${results.length} students (CSV downloaded)`);
          }
          setSelectedEmails(new Set());
        } catch (err) {
          showError("Password generation failed: " + err.message);
        }
      }
    });
  };

  // CSV Export
  const handleExportCsv = () => {
    if (filteredStudents.length === 0) {
      showError("No student records to export.");
      return;
    }

    const headers = ['Name', 'Email', 'Enrollment ID', 'Phone', 'Emergency Phone', 'Route', 'Stop', 'Bus Number', 'Pass Validity', 'Status'];
    const rows = filteredStudents.map(s => [
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.email || '').replace(/"/g, '""')}"`,
      `"${(s.collegeId || s.enrollment || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.parentPhone || '').replace(/"/g, '""')}"`,
      `"${(s.busRoute || '').replace(/"/g, '""')}"`,
      `"${(s.pickupStop || '').replace(/"/g, '""')}"`,
      `"${(s.assignedBusNumber || '').replace(/"/g, '""')}"`,
      `"${s.passValidity || ''}"`,
      `"${getPassStatus(s).label}"`
    ]);

    const csvContent = `${headers.join(',')}\n${rows.map(r => r.join(',')).join('\n')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cambus_students_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess(`Exported ${filteredStudents.length} students to CSV`);
  };

  // Route and Stop changes
  const handleRouteChange = (routeName) => {
    const matchedRoute = routes.find(r => r.name === routeName);
    setFormData(prev => ({
      ...prev,
      busRoute: routeName,
      routeId: matchedRoute?.id || '',
      pickupStop: matchedRoute?.stops?.[0]?.name || prev.pickupStop
    }));
  };

  // Open Form Modals
  const openAddModal = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      collegeId: '',
      phone: '',
      parentPhone: '',
      busRoute: routes[0]?.name || '',
      routeId: routes[0]?.id || '',
      assignedBusNumber: buses[0]?.number || '',
      pickupStop: routes[0]?.stops?.[0]?.name || '',
      passValidity: '2026-12-31',
      status: 'Active'
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name || '',
      email: student.email || '',
      password: '', // Not used for editing
      collegeId: student.collegeId || student.enrollment || '',
      phone: student.phone || '',
      parentPhone: student.parentPhone || '',
      busRoute: student.busRoute || '',
      routeId: student.routeId || '',
      assignedBusNumber: student.assignedBusNumber || '',
      pickupStop: student.pickupStop || '',
      passValidity: student.passValidity || '2026-12-31',
      status: student.status || 'Active'
    });
    setIsEditModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      showError("Please enter student name and email.");
      return;
    }

    setSubmitting(true);
    try {
      await createStudent(formData);
      showSuccess(`Student ${formData.name} registered`);
      setIsAddModalOpen(false);
    } catch (err) {
      showError("Registration failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStudent?.email) return;

    setSubmitting(true);
    try {
      await updateStudent(editingStudent.email, formData);
      showSuccess(`Student ${formData.name} updated`);
      setIsEditModalOpen(false);
      setEditingStudent(null);
    } catch (err) {
      showError("Update failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (email, name) => {
    setConfirmAction({
      title: 'Remove Student',
      message: `Are you sure you want to remove student "${name || email}"?`,
      confirmText: 'Remove Student',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteStudent(email);
          showSuccess(`Student removed`);
          await fetchPage(1);
        } catch (err) {
          showError("Delete failed: " + err.message);
        }
      }
    });
  };

  const activeRouteObj = routes.find(r => r.name === formData.busRoute);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Student Directory & Passes"
        subtitle={`${totalStudents} registered pass holders`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Key}
              onClick={handleBulkGeneratePasswords}
            >
              Generate Passwords
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Upload}
              onClick={() => setIsImportModalOpen(true)}
            >
              Import CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={openAddModal}
            >
              Add Student
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          <div className="md:col-span-2">
            <Input
              icon={Search}
              placeholder="Search by name, ID, email, or phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div>
            <select
              className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
              value={selectedRouteFilter}
              onChange={(e) => {
                setSelectedRouteFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Routes ({routes.length})</option>
              {routes.map(r => (
                <option key={r.id} value={r.name}>{r.code} - {r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Pass Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Bulk Action Banner */}
      {selectedEmails.size > 0 && (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-blue-900">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span>{selectedEmails.size} students selected</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleBulkGeneratePasswords}>
              <Key className="w-4 h-4 mr-1.5" /> Passwords
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkExtendValidity}>
              Extend Validity (+6 Mo)
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkRevoke}>
              Revoke Passes
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="text-red-600 hover:bg-red-50">
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Student Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={pagedStudents.length > 0 && selectedEmails.size === pagedStudents.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Student Profile</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Enrollment ID</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Assigned Transit</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Pickup Stop</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Pass Validity</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedStudents.map((student, index) => {
                const statusObj = getPassStatus(student);
                const isSelected = selectedEmails.has(student.email);
                const staggerClass = `animate-stagger-${Math.min(5, (index % 5) + 1)}`;

                return (
                  <tr key={student.id || student.email} className={`animate-slide-up ${staggerClass} hover:bg-white/40 transition-colors ${isSelected ? 'bg-blue-50/50 backdrop-blur-sm' : ''}`}>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(student.email)}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{student.name}</div>
                          <div className="text-xs text-gray-400">{student.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-xs text-gray-700 font-mono">
                      {student.collegeId || student.enrollment || '—'}
                    </td>

                    <td className="px-4 py-2.5 text-xs text-gray-700">
                      <div className="font-medium">{student.busRoute || 'Unassigned'}</div>
                      {student.assignedBusNumber && (
                        <div className="text-gray-400">Bus {student.assignedBusNumber}</div>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[140px] truncate">
                      {student.pickupStop || '—'}
                    </td>

                    <td className="px-4 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                      {formatPassDate(student.passValidity)}
                    </td>

                    <td className="px-4 py-2.5">
                      <Badge variant={statusObj.variant}>
                        {statusObj.label}
                      </Badge>
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Edit Student"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(student.email, student.name)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="Delete Student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-gray-400">
                    No students found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {filteredStudents.length > 0 && (
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalStudents)} to{' '}
              {Math.min(currentPage * PAGE_SIZE, totalStudents)} of {totalStudents} students
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register Pass Holder"
      >
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name"
              placeholder="e.g. Ananya Sharma"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Email"
              placeholder="e.g. ananya@institute.edu"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Login Password"
              placeholder="e.g. cambus123"
              type="text" // Text type so admin can see what they are typing
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              helperText="The student will use this to log in."
            />
            <Input
              label="Enrollment / College ID"
              placeholder="e.g. CS211045"
              value={formData.collegeId}
              onChange={(e) => setFormData({ ...formData, collegeId: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Pass Expiry Date"
              type="date"
              value={formData.passValidity}
              onChange={(e) => setFormData({ ...formData, passValidity: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Assigned Route
              </label>
              <select
                className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
                value={formData.busRoute}
                onChange={(e) => handleRouteChange(e.target.value)}
              >
                <option value="">-- Select Route --</option>
                {routes.map(r => (
                  <option key={r.id} value={r.name}>{r.code} - {r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Assigned Bus
              </label>
              <select
                className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
                value={formData.assignedBusNumber}
                onChange={(e) => setFormData({ ...formData, assignedBusNumber: e.target.value })}
              >
                <option value="">-- Select Bus --</option>
                {buses.map(b => (
                  <option key={b.id} value={b.number}>Bus {b.number} ({b.route || 'General'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Boarding Stop
              </label>
              {activeRouteObj?.stops?.length > 0 ? (
                <select
                  className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
                  value={formData.pickupStop}
                  onChange={(e) => setFormData({ ...formData, pickupStop: e.target.value })}
                >
                  <option value="">-- Select Waypoint --</option>
                  {activeRouteObj.stops.map(s => (
                    <option key={s.id || s.sequence} value={s.name}>
                      {s.name} ({s.pickupTime || 'Stop'})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="e.g. Palasia Square"
                  value={formData.pickupStop}
                  onChange={(e) => setFormData({ ...formData, pickupStop: e.target.value })}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Pass Status
              </label>
              <select
                className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Revoked">Revoked</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Student Phone"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Emergency Phone"
              placeholder="+91 9876543211"
              value={formData.parentPhone}
              onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={submitting}>
              Register Student
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Pass — ${editingStudent?.name || ''}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Enrollment ID"
              value={formData.collegeId}
              onChange={(e) => setFormData({ ...formData, collegeId: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Assigned Route
              </label>
              <select
                className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
                value={formData.busRoute}
                onChange={(e) => handleRouteChange(e.target.value)}
              >
                <option value="">-- Select Route --</option>
                {routes.map(r => (
                  <option key={r.id} value={r.name}>{r.code} - {r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Assigned Bus
              </label>
              <select
                className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
                value={formData.assignedBusNumber}
                onChange={(e) => setFormData({ ...formData, assignedBusNumber: e.target.value })}
              >
                <option value="">-- Select Bus --</option>
                {buses.map(b => (
                  <option key={b.id} value={b.number}>Bus {b.number} ({b.route || 'General'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Boarding Stop
              </label>
              {activeRouteObj?.stops?.length > 0 ? (
                <select
                  className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
                  value={formData.pickupStop}
                  onChange={(e) => setFormData({ ...formData, pickupStop: e.target.value })}
                >
                  <option value="">-- Select Waypoint --</option>
                  {activeRouteObj.stops.map(s => (
                    <option key={s.id || s.sequence} value={s.name}>
                      {s.name} ({s.pickupTime || 'Stop'})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={formData.pickupStop}
                  onChange={(e) => setFormData({ ...formData, pickupStop: e.target.value })}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Pass Status
              </label>
              <select
                className="w-full px-3.5 py-2.5 text-sm bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-900"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Revoked">Revoked</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Pass Expiry Date"
              type="date"
              value={formData.passValidity}
              onChange={(e) => setFormData({ ...formData, passValidity: e.target.value })}
            />
            <Input
              label="Student Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

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

      {/* CSV Import Modal */}
      <StudentCsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        schema={schema}
        onImportComplete={() => {
          showSuccess("Student directory refreshed from CSV");
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        onClose={() => {
          if (!confirmLoading) setConfirmAction(null);
        }}
        onConfirm={async () => {
          if (confirmAction?.onConfirm) {
            setConfirmLoading(true);
            try {
              await confirmAction.onConfirm();
            } finally {
              setConfirmLoading(false);
              setConfirmAction(null);
            }
          }
        }}
        isLoading={confirmLoading}
        title={confirmAction?.title || 'Please Confirm'}
        message={confirmAction?.message || ''}
        confirmText={confirmAction?.confirmText || 'Confirm'}
        variant={confirmAction?.variant || 'primary'}
      />
    </div>
  );
}
