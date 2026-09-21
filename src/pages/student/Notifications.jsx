// src/pages/student/Notifications.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToNotifications } from '../../services/communications';
import { PageHeader } from '../../components/layout/PageHeader';
import { NotificationItem } from '../../components/domain/NotificationItem';

export function StudentNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsub = subscribeToNotifications((list) => {
      const route = profile?.busRoute || '';
      setNotifications(
        list.filter(n => !n.targetRouteId || n.targetRouteId === 'all' || n.targetRouteId === route)
      );
    });
    return () => unsub();
  }, [profile?.busRoute]);

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Notifications" subtitle="Route announcements and alerts" />

      {notifications.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
          No notifications for your route.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
