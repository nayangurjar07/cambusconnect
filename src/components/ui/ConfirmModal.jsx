// src/components/ui/ConfirmModal.jsx
import React from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Reusable Confirmation Dialog replacing raw window.confirm()
 * Fully responsive, accessible, with brand theme styling.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Please Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary', // 'primary' | 'danger' | 'warning'
  isLoading = false,
  icon: CustomIcon
}) {
  const isDestructive = variant === 'danger';
  const IconComponent = CustomIcon || (isDestructive ? Trash2 : AlertTriangle);

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      className="p-1"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-2xl shrink-0 ${
            isDestructive 
              ? 'bg-red-50 text-red-600 border border-red-100' 
              : 'bg-blue-50 text-blue-600 border border-blue-100'
          }`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="flex-1 text-sm text-slate-600 leading-relaxed pt-0.5">
            {typeof message === 'string' ? (
              <p className="whitespace-pre-line">{message}</p>
            ) : (
              message
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl px-4"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'danger' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            isLoading={isLoading}
            className="rounded-xl px-5 font-bold shadow-md"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
