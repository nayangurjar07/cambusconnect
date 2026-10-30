// src/components/ui/DataTable.jsx
import React from 'react';
import { cn } from '../../utils/cn';
import { EmptyState } from './EmptyState';

/**
 * Professional data table for operational views.
 * 
 * Usage:
 * <DataTable
 *   columns={[
 *     { key: 'name', label: 'Name' },
 *     { key: 'status', label: 'Status', render: (row) => <Badge>...</Badge> },
 *   ]}
 *   data={rows}
 *   onRowClick={(row) => ...}
 *   emptyIcon={Inbox}
 *   emptyTitle="No records"
 * />
 */
export function DataTable({
  columns = [],
  data = [],
  onRowClick,
  className,
  emptyIcon,
  emptyTitle = 'No data found',
  emptyDescription,
  compact = false,
}) {
  if (data.length === 0) {
    return (
      <div className={cn("bg-white border border-gray-200 rounded-lg", className)}>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
      </div>
    );
  }

  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap",
                    compact ? "px-3 py-2" : "px-4 py-3"
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "transition-colors",
                  onRowClick && "cursor-pointer hover:bg-gray-50"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "text-sm text-gray-700 whitespace-nowrap",
                      compact ? "px-3 py-2" : "px-4 py-3"
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
