// src/components/domain/NotificationItem.jsx
import React from 'react';
import { AlertTriangle, Info, Clock } from 'lucide-react';
import { cn } from '../../utils/cn';

const typeConfig = {
  delay:   { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  alert:   { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  info:    { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  crowd:   { icon: Info, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

export function NotificationItem({ notification }) {
  const config = typeConfig[notification.type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div className={cn("p-3 rounded-lg border", config.border, config.bg)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-gray-900">{notification.title}</h4>
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notification.message}</p>
          {notification.createdAt && (
            <span className="text-[11px] text-gray-400 mt-1 block">
              {new Date(notification.createdAt?.seconds ? notification.createdAt.seconds * 1000 : notification.createdAt).toLocaleString([], {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
