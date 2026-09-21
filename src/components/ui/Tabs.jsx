// src/components/ui/Tabs.jsx
import React from 'react';
import { cn } from '../../utils/cn';

export function Tabs({ tabs, activeTab, onChange, variant = 'underline', className }) {
  if (variant === 'pills') {
    return (
      <div className={cn("flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto", className)}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap active:scale-[0.98]",
                isActive
                  ? "bg-white text-blue-600 shadow-sm shadow-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  isActive ? "bg-blue-50 text-blue-600" : "bg-slate-200 text-slate-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("border-b border-slate-200/80 overflow-x-auto", className)}>
      <nav className="flex gap-2 -mb-px min-w-max" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer",
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "ml-2 text-xs px-2 py-0.5 rounded-full font-semibold",
                  isActive ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
