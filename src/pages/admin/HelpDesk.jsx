// src/pages/admin/HelpDesk.jsx
import React, { useState, useEffect } from 'react';
import { LifeBuoy, Search, CheckCircle2, Trash2, Clock, MessageSquare, Check, Calendar, Phone } from 'lucide-react';
import { subscribeToSupportQueries, updateQueryStatus, subscribeToLostItems, updateLostItemStatus, deleteLostItem } from '../../services/communications';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/layout/PageHeader';
import { useToast } from '../../contexts/ToastContext';

function SupportTab() {
  const { showSuccess, showError } = useToast();
  const [queries, setQueries] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSupportQueries(setQueries);
    return () => unsub();
  }, []);

  const filtered = filterStatus === 'all'
    ? queries
    : queries.filter(q => q.status === filterStatus);

  const handleResolve = async (status) => {
    if (!selectedQuery) return;
    setUpdating(true);
    try {
      await updateQueryStatus(selectedQuery.id, status, adminNotes);
      showSuccess(`Status updated to ${status}`);
      setSelectedQuery(null);
      setAdminNotes('');
    } catch (err) {
      showError("Update failed: " + "An unexpected error occurred. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {['all', 'Pending', 'Resolved'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              filterStatus === s 
                ? 'bg-gray-900 text-white' 
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? `All (${queries.length})` : `${s} (${queries.filter(q => q.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(q => {
          const isPending = q.status === 'Pending';
          return (
            <Card key={q.id} className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[11px] font-medium text-gray-500 uppercase">
                    {q.category || 'Transit'}
                  </span>
                  <Badge variant={isPending ? 'warning' : 'success'}>
                    {q.status || 'Pending'}
                  </Badge>
                </div>
                <h3 className="font-semibold text-sm text-gray-900 mt-1">
                  {q.subject || 'Support Ticket'}
                </h3>
                <p className="text-xs text-gray-600 mt-1.5 line-clamp-3 leading-relaxed">
                  {q.message}
                </p>
                <div className="mt-3 pt-2.5 border-t border-gray-100 text-xs text-gray-500 space-y-0.5">
                  <div>From: <span className="font-medium text-gray-800">{q.studentName || 'Student'}</span></div>
                  <div>Email: <span className="text-gray-600">{q.studentEmail}</span></div>
                  {q.adminNotes && (
                    <div className="p-2 bg-gray-50 rounded-md text-gray-700 text-xs mt-2">
                      <span className="font-medium">Note:</span> {q.adminNotes}
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs mt-3">
                <span className="text-gray-400">
                  {q.createdAt?.toDate ? q.createdAt.toDate().toLocaleDateString() : 'Recent'}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { setSelectedQuery(q); setAdminNotes(q.adminNotes || ''); }}
                >
                  Manage
                </Button>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-xs text-gray-400">
            No support tickets under this filter.
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(selectedQuery)}
        onClose={() => setSelectedQuery(null)}
        title={selectedQuery?.subject || 'Support Ticket'}
      >
        <div className="space-y-3 text-xs">
          <div className="text-xs text-gray-500">
            From: <strong className="text-gray-800">{selectedQuery?.studentName}</strong> ({selectedQuery?.studentEmail})
          </div>
          <div className="p-3 bg-gray-50 rounded-md text-gray-800 leading-relaxed text-sm">
            {selectedQuery?.message}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              Response / Action Notes
            </label>
            <textarea
              rows={3}
              className="w-full bg-white border border-gray-200 rounded-md p-2.5 text-xs text-gray-900 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
              placeholder="e.g. Spoke with driver of Bus 14. Stop verified."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={() => setSelectedQuery(null)}>
              Cancel
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleResolve('Pending')} 
              isLoading={updating}
            >
              Mark Pending
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              icon={Check} 
              onClick={() => handleResolve('Resolved')} 
              isLoading={updating}
            >
              Resolve Ticket
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LostFoundTab() {
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsub = subscribeToLostItems(setItems);
    return () => unsub();
  }, []);

  const filtered = filter === 'all'
    ? items
    : items.filter(i => i.status === filter);

  const handleStatus = async (id, status) => {
    try {
      await updateLostItemStatus(id, status);
      showSuccess(`Status updated to ${status}`);
    } catch (e) {
      showError("Update failed: " + e.message);
    }
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Delete record for "${title}"?`)) {
      try {
        await deleteLostItem(id);
        showSuccess("Record deleted");
      } catch (e) {
        showError("Delete failed: " + e.message);
      }
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {['all', 'Open', 'Found', 'Claimed'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              filter === s 
                ? 'bg-gray-900 text-white' 
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? `All (${items.length})` : `${s} (${items.filter(i => i.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(item => (
          <Card key={item.id} className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-900">{item.title}</h3>
                <Badge variant={item.status === 'Claimed' ? 'neutral' : item.status === 'Found' ? 'success' : 'warning'}>
                  {item.status || 'Open'}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed mb-3">
                {item.description || 'No description provided.'}
              </p>
              <div className="space-y-1 py-2.5 border-t border-gray-100 text-xs text-gray-500">
                {item.busNumber && <div>Vehicle: <span className="font-medium text-gray-800">Bus {item.busNumber}</span></div>}
                <div>Contact: <span className="font-medium text-gray-800">{item.contactName || 'Student'}</span></div>
                {item.contactPhone && (
                  <div>Phone: <a href={`tel:${item.contactPhone}`} className="text-blue-600 hover:underline">{item.contactPhone}</a></div>
                )}
                <div className="text-gray-400">Date: {item.dateLost || 'Recent'}</div>
              </div>
            </div>
            <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleStatus(item.id, 'Found')}
                  className="px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                >
                  Found
                </button>
                <button
                  onClick={() => handleStatus(item.id, 'Claimed')}
                  className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors"
                >
                  Claimed
                </button>
              </div>
              <button
                onClick={() => handleDelete(item.id, item.title)}
                className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-xs text-gray-400">
            No items under this filter.
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminHelpDesk() {
  const [activeTab, setActiveTab] = useState('support');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Help Desk"
        subtitle="Manage support tickets and lost & found items"
      />

      <div className="flex border-b border-gray-200">
        <button
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'support'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('support')}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Support Tickets
          </div>
        </button>
        <button
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'lostfound'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('lostfound')}
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Lost & Found
          </div>
        </button>
      </div>

      {activeTab === 'support' ? <SupportTab /> : <LostFoundTab />}
    </div>
  );
}
