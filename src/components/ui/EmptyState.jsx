// src/components/ui/EmptyState.jsx
import React from 'react';
import { cn } from '../../utils/cn';

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      {Icon && (
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-gray-400" />
        </div>
      )}
      <h3 className="text-sm font-medium text-gray-900">{title || 'No data'}</h3>
      {description && (
        <p className="text-sm text-gray-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
