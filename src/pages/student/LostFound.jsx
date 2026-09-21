// src/pages/student/LostFound.jsx
import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, CheckCircle2, AlertCircle, MapPin, Bus, Building2, Tag, Calendar, Info } from 'lucide-react';
import { subscribeLostFoundItems, createLostFoundItem } from '../../services/communications';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

export function StudentLostFound() {
  const { profile, user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successReport, setSuccessReport] = useState(null);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    locationType: 'BUS', // 'BUS' | 'CAMPUS'
    busNumber: '',
    campusLocation: '',
    contactPhone: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const unsub = subscribeLostFoundItems((list) => {
      setItems(list);
      setLoading(false);
    }, (err) => {
      console.warn("Lost & Found subscription error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Please enter the name of the lost item.');
      return;
    }

    setSubmitting(true);
    try {
      const email = user?.email || profile?.email || '';
      const uid = user?.uid || profile?.collegeId || profile?.id || '';
      const name = profile?.name || user?.displayName || 'Student';

      const result = await createLostFoundItem({
        title: formData.title.trim(),
        itemName: formData.title.trim(),
        description: formData.description.trim(),
        locationType: formData.locationType,
        location: formData.locationType === 'BUS' 
          ? (formData.busNumber ? `Bus ${formData.busNumber}` : 'Campus Transit Bus')
          : (formData.campusLocation || 'Campus Area'),
        busNumber: formData.locationType === 'BUS' ? formData.busNumber : '',
        campusLocation: formData.locationType === 'CAMPUS' ? formData.campusLocation : '',
        route: profile?.busRoute || '',
        userEmail: email,
        email: email,
        userId: uid,
        reportedBy: name,
        contactName: name,
        contactPhone: formData.contactPhone || profile?.phone || '',
        userPhone: formData.contactPhone || profile?.phone || '',
        status: 'Lost'
      });

      // Show success modal with reference details
      setSuccessReport({
        refNumber: result.refNumber || result.id?.slice(0, 8).toUpperCase() || 'LNF-SUBMITTED',
        itemName: formData.title.trim(),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        location: formData.locationType === 'BUS' 
          ? `Bus ${formData.busNumber || 'Fleet'}` 
          : (formData.campusLocation || 'Campus Area'),
        note: result.note
      });

      // Reset form only after confirmed successful write
      setFormData({
        title: '',
        description: '',
        locationType: 'BUS',
        busNumber: '',
        campusLocation: '',
        contactPhone: ''
      });
      setIsModalOpen(false);
      showSuccess('Report submitted successfully.');
    } catch (err) {
      console.error("Submission failed:", err);
      let readable = 'Your report could not be submitted right now. Please try again.';
      if (err.code === 'permission-denied') {
        readable = "You don't currently have permission to submit a Lost & Found report. Please ensure your session is active.";
      } else if (err.message) {
        readable = `Submission error: An unexpected error occurred. Please try again.`;
      }
      setFormError(readable);
      showError(readable);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(item => {
    const title = (item.title || item.itemName || item.item || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const loc = (item.location || item.busNumber || '').toLowerCase();
    const matchesSearch = !searchTerm || title.includes(searchTerm.toLowerCase()) || desc.includes(searchTerm.toLowerCase()) || loc.includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    const itemStatus = (item.status || 'Lost').toLowerCase();
    return itemStatus === statusFilter.toLowerCase();
  });

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="Lost & Found"
        subtitle="Report lost belongings or browse items found across campus and fleet transit"
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => { setFormError(''); setIsModalOpen(true); }}>
            Report Lost Item
          </Button>
        }
      />

      {/* Search & Filter Bar */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search items, descriptions, bus numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-md pl-9 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 w-full sm:w-auto shrink-0">
            {['all', 'lost', 'found'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Items List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading lost & found catalog...</div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center space-y-2">
          <Package className="w-8 h-8 text-gray-300 mx-auto" />
          <div className="text-sm font-medium text-gray-900">No items found</div>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchTerm ? "No lost items matched your search terms." : "No active reports currently recorded."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => {
            const title = item.title || item.itemName || item.item || 'Unnamed Item';
            const status = item.status || 'Lost';
            const location = item.location || (item.busNumber ? `Bus ${item.busNumber}` : item.route || 'Campus Transit');
            const dateStr = item.dateLost || (item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Recent');

            return (
              <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3.5 flex items-start justify-between gap-3 hover:border-gray-300 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                    status.toLowerCase() === 'found' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{title}</h4>
                      <Badge variant={status.toLowerCase() === 'found' ? 'success' : 'warning'}>
                        {status}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {dateStr}
                      </span>
                      {item.reportedBy && (
                        <span>By {item.reportedBy}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Report a Lost Item">
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="What did you lose?"
            placeholder="e.g. Black Lenovo laptop charger, Blue Tupperware bottle"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            autoFocus
          />

          {/* Location Type Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Where was it lost?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationType: 'BUS' })}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors ${
                  formData.locationType === 'BUS'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Bus className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="text-xs font-medium">On a Bus</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationType: 'CAMPUS' })}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors ${
                  formData.locationType === 'CAMPUS'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="text-xs font-medium">On Campus Area</div>
              </button>
            </div>
          </div>

          {/* Conditional Location Input */}
          {formData.locationType === 'BUS' ? (
            <Input
              label="Bus number / Route"
              placeholder="e.g. Bus 22 (Vijay Nagar Route)"
              value={formData.busNumber}
              onChange={(e) => setFormData({ ...formData, busNumber: e.target.value })}
            />
          ) : (
            <Input
              label="Campus location / Building"
              placeholder="e.g. Block C Canteen, Library 2nd Floor, Main Gate"
              value={formData.campusLocation}
              onChange={(e) => setFormData({ ...formData, campusLocation: e.target.value })}
            />
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Identifying description</label>
            <textarea
              rows={3}
              placeholder="Color, distinctive marks, stickers, bag compartments, etc..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-md p-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <Input
            label="Contact phone number (Optional)"
            placeholder="For coordinator verification if found"
            value={formData.contactPhone}
            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={submitting}>
              Submit Report
            </Button>
          </div>
        </form>
      </Modal>

      {/* Success Confirmation Modal */}
      {successReport && (
        <Modal isOpen={!!successReport} onClose={() => setSuccessReport(null)} title="Report Submitted">
          <div className="text-center space-y-3 py-2">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Your report has been logged</h3>
              <p className="text-xs text-gray-500 mt-0.5">Reference ID: <span className="font-mono font-bold text-gray-900">{successReport.refNumber}</span></p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg text-left text-xs space-y-1.5 border border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-400">Item:</span>
                <span className="font-medium text-gray-800">{successReport.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Location:</span>
                <span className="font-medium text-gray-800">{successReport.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date:</span>
                <span className="font-medium text-gray-800">{successReport.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="font-semibold text-amber-600">Pending Review</span>
              </div>
            </div>

            <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-md text-[11px] text-blue-700 text-left flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600" />
              <span>Campus Transit coordinators have received this report. You will be contacted if matching items are turned in.</span>
            </div>

            <Button variant="primary" size="sm" className="w-full" onClick={() => setSuccessReport(null)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

