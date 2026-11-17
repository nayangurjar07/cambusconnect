// src/components/layout/PageHeader.jsx
import React from 'react';

export function PageHeader({ title, subtitle, actions, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div className="animate-slide-up">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm font-medium text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
