import { ConfirmDialog } from './ConfirmDialog';
import type { useDeleteClient } from '@/lib/useDeleteClient';

export interface DeleteClientConfirmDialogProps {
  deleteClient: ReturnType<typeof useDeleteClient>;
}

/** Shared by `/clients` and `/dashboard` — both mount `useDeleteClient` and
 * this exact dialog around it. */
export function DeleteClientConfirmDialog({ deleteClient }: DeleteClientConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={deleteClient.target !== null}
      title={`Supprimer ${deleteClient.target?.name ?? 'ce client'} ?`}
      message="Cette action supprimera définitivement ce client et tout son historique de dettes et paiements. Cette action est irréversible."
      confirmLabel={deleteClient.pending ? 'Suppression…' : 'Supprimer'}
      variant="danger"
      icon="trash-2"
      onConfirm={deleteClient.confirmDelete}
      onCancel={deleteClient.cancel}
    />
  );
}
