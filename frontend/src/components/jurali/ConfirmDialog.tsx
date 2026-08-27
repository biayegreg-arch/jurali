'use client';

// Generic confirm-before-you-act popup — first use is "Se déconnecter"
// (Paramètres > Sécurité) but written to be reusable for any destructive
// or hard-to-undo action (no existing modal/dialog primitive in this
// codebase to build on, so this is the first one).
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/jurali/Icon';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  icon = 'log-out',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          onClick={onCancel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center px-4"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2 }}
            className="bg-background border border-border rounded-xl p-6 w-full max-w-sm shadow-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  variant === 'danger' ? 'bg-danger/10' : 'bg-secondary'
                }`}
              >
                <Icon
                  i={icon}
                  size={18}
                  className={variant === 'danger' ? 'text-danger' : 'text-primary'}
                />
              </div>
              <div
                id="confirm-dialog-title"
                className="font-headings font-bold text-base text-foreground"
              >
                {title}
              </div>
            </div>
            <div id="confirm-dialog-message" className="text-sm text-muted-foreground mb-6">
              {message}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-input border border-border text-foreground font-headings font-bold text-sm py-2.5 rounded-lg"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`flex-1 font-headings font-bold text-sm py-2.5 rounded-lg ${
                  variant === 'danger'
                    ? 'bg-danger text-danger-foreground'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
