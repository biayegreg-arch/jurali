// FCFA-prefixed amount input + quick-preset buttons, shared by Nouvelle
// dette and Paiement reçu. Preset values confirmed 2026-08-24 (second
// Banani batch, NewDebtDesktop). See .planning/banani/new-debt.md.
import { formatPrice } from '@/lib/utils';

const DEFAULT_PRESETS = [500, 1_000, 10_000, 25_000];

export interface AmountFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  presets?: number[];
}

export function AmountField({
  label,
  value,
  onChange,
  presets = DEFAULT_PRESETS,
}: AmountFieldProps) {
  return (
    <div className="mb-5">
      <div className="text-xs font-headings uppercase tracking-wide text-foreground mb-2">
        {label}
      </div>
      <div className="flex items-center gap-1 bg-input border border-border rounded-xl px-3 py-3">
        <span className="text-muted-foreground text-base font-body">FCFA</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={value === null ? '' : String(value)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            onChange(digits === '' ? null : Number(digits));
          }}
          className="flex-1 bg-transparent text-2xl font-headings font-bold text-foreground placeholder-muted-foreground outline-none text-right"
        />
      </div>
      <div className="mt-3 flex gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className="flex-1 bg-surface border border-border text-foreground font-headings font-semibold text-sm py-2.5 rounded-lg"
          >
            {formatPrice(preset)}
          </button>
        ))}
      </div>
    </div>
  );
}
