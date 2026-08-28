import { Icon } from './Icon';

export interface DeleteClientButtonProps {
  id: string;
  name: string;
  onDelete: (id: string, name: string) => void;
  size?: number;
  className?: string;
}

/** Shared by `DebtorRow` (mobile card) and `DebtorTableRow` (desktop table)
 * — both rows are wrapped in a `MotionLink` spanning the whole row, so a
 * click here must stop it from also triggering that row's navigation. */
export function DeleteClientButton({
  id,
  name,
  onDelete,
  size = 18,
  className = 'text-muted-foreground',
}: DeleteClientButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Supprimer ${name}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete(id, name);
      }}
      className={className}
    >
      <Icon i="trash-2" size={size} />
    </button>
  );
}
