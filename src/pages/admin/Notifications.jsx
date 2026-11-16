// src/pages/admin/Notifications.jsx
import React, { useState, useEffect } from 'react';
import { Bell, Send, Trash2, Radio } from 'lucide-react';
import { 
  subscribeToNotifications, 
  createNotification, 
  deleteNotification 
} from '../../services/communications';
import { subscribeToRoutes } from '../../services/transit';
import { subscribeToShiftConfig } from '../../services/workforce';
import { NotificationItem } from '../../components/domain/NotificationItem';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/layout/PageHeader';
import { useToast } from '../../contexts/ToastContext';

export function AdminNotifications() {
  const { showSuccess, showError } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [targetRouteId, setTargetRouteId] = useState('all');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    const unsubNotifs = subscribeToNotifications(setNotifications);
    const unsubRoutes = subscribeToRoutes(setRoutes);
    const unsubShifts = subscribeToShiftConfig(setShifts);
    return () => {
      unsubNotifs();
      unsubRoutes();
      unsubShifts();
    };
  }, []);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!message) {
      showError("Please enter an announcement message.");
      return;
    }

    setBroadcasting(true);
    try {
      await createNotification({
        title: title || 'Transit Notice',
        message,
        type,
        targetRouteId
      });
      showSuccess("Announcement broadcasted");
      setTitle('');
      setMessage('');
    } catch (err) {
      showError("Broadcast failed: " + err.message);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      showSuccess("Announcement removed");
    } catch (err) {
      showError("Delete failed: " + err.message);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        title="Notifications"
        subtitle="Broadcast route updates and alerts"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Broadcast Form */}
        <Card className="p-4 h-fit">
          <div className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            New Broadcast
          </div>

          <form onSubmit={handleBroadcast} className="space-y-3">
            <Input
              label="Title"
              placeholder="e.g. Route 4 Delay"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 sm:col-span-1">
                <label className="text-xs font-medium text-gray-700">Type</label>
                <select
                  className="w-full bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="info">Info</option>
                  <option value="delay">Delay</option>
                  <option value="alert">Alert</option>
                  <option value="crowd">Capacity</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-medium text-gray-700">Target Route</label>
                <select
                  className="w-full bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 truncate"
                  value={targetRouteId}
                  onChange={(e) => setTargetRouteId(e.target.value)}
                >
                  <option value="all">All Routes & Campuses</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Message</label>
              <textarea
                rows={3}
                className="w-full bg-white border border-gray-200 rounded-md p-2.5 text-xs text-gray-900 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
                placeholder="Message displayed to passengers and drivers..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="w-full"
              icon={Send}
              isLoading={broadcasting}
            >
              Send Broadcast
            </Button>
          </form>
        </Card>

        {/* Existing Announcements Feed */}
        <div className="lg:col-span-2 space-y-2">
          <div className="text-xs font-medium text-gray-500 mb-1">
            Active Bulletins ({notifications.length})
          </div>

          {notifications.map(n => (
            <NotificationItem
              key={n.id}
              notification={n}
              onDelete={handleDelete}
            />
          ))}

          {notifications.length === 0 && (
            <Card className="p-8 text-center text-xs text-gray-400">
              No active announcements. Broadcasts will appear here.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
