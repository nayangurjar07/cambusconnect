// src/pages/admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Bus, Users, QrCode, AlertTriangle, Clock, Map, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { subscribeToBuses } from '../../services/transit';
import { subscribeToNotifications } from '../../services/communications';
import { PageHeader } from '../../components/layout/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { Card } from '../../components/ui/Card';
import { StatusIndicator } from '../../components/ui/StatusIndicator';
import { Badge } from '../../components/ui/Badge';
import { NotificationItem } from '../../components/domain/NotificationItem';

export function AdminDashboard() {
  const [buses, setBuses] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsub1 = subscribeToBuses(setBuses);
    const unsub2 = subscribeToNotifications((list) => setNotifications(list.slice(0, 5)));
    return () => { unsub1(); unsub2(); };
  }, []);

  const onTimeBuses = buses.filter(b => b.status === 'On Time').length;
  const delayedBuses = buses.filter(b => b.status === 'Delayed').length;
  const breakdownBuses = buses.filter(b => b.status === 'Breakdown').length;
  const totalRiders = buses.reduce((sum, b) => sum + (b.headcount || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle="Fleet operations overview" />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="animate-slide-up animate-stagger-1"><MetricCard title="Total Fleet" value={buses.length} subtitle="Registered vehicles" icon={Bus} /></div>
        <div className="animate-slide-up animate-stagger-2"><MetricCard title="Active Riders" value={totalRiders} subtitle="Currently onboard" icon={Users} /></div>
        <div className="animate-slide-up animate-stagger-3"><MetricCard title="On Time" value={onTimeBuses} subtitle={`of ${buses.length} buses`} icon={Clock} /></div>
        <div className="animate-slide-up animate-stagger-4">
          <MetricCard
            title="Issues"
            value={delayedBuses + breakdownBuses}
            subtitle={`${delayedBuses} delayed, ${breakdownBuses} breakdown`}
            icon={AlertTriangle}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fleet Status Table */}
        <div className="lg:col-span-2">
          <Card>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Fleet Status</h3>
              <Link to="/admin/buses" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Bus</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Route</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Driver</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Riders</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {buses.slice(0, 8).map((bus, index) => {
                    const staggerClass = `animate-stagger-${Math.min(5, (index % 5) + 1)}`;
                    return (
                      <tr key={bus.id} className={`hover:bg-white/40 transition-colors animate-slide-up ${staggerClass}`}>
                        <td className="px-4 py-2.5 text-sm font-semibold text-gray-900">{bus.number}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600 truncate max-w-[140px]">{bus.route || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600 truncate max-w-[120px]">{bus.driver || '—'}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-700">{bus.headcount || 0}</td>
                        <td className="px-4 py-2.5"><StatusIndicator status={bus.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {buses.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">No buses registered</div>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Alerts */}
        <div>
          <Card>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Recent Alerts</h3>
              <Link to="/admin/notifications" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                All
              </Link>
            </div>
            <div className="p-3 space-y-2 max-h-[340px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">No recent alerts</div>
              ) : (
                notifications.map(n => <NotificationItem key={n.id} notification={n} />)
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
