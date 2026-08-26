'use client';

// Phone input with a searchable world country-code selector — client and
// profile phone numbers can genuinely be any country (unlike the account
// phone on /login and /signup, which stays a fixed "+221" split UI since
// it's always a Senegalese number tied to auth). Composes back to a single
// E.164-ish string (`+<dialCode><localDigits>`, or '' when empty) so it
// slots into `ClientFormValues.phone` / Settings' `phone` state without
// changing their shape.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import {
  COUNTRY_DIAL_CODES,
  findCountryByDialPrefix,
  flagEmoji,
  type CountryDialCode,
} from '@/lib/jurali-countries';

export interface PhoneFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helper?: string;
  /** Set false when the caller already renders its own label above the
   * field (login/signup's own `<label>Téléphone</label>`) — avoids a
   * duplicate label. */
  showLabel?: boolean;
  /** Shrinks padding/radius/text to match a compact unlabeled form stack
   * (Settings' profile edit) instead of `ClientForm`'s roomy fields. */
  compact?: boolean;
}

export function PhoneField({
  value,
  onChange,
  label = 'Numéro de téléphone',
  helper,
  showLabel = true,
  compact = false,
}: PhoneFieldProps) {
  // Country choice can't be derived purely from `value`: while no digits
  // are typed yet, the composed value stays '' (so the phone remains
  // optional), and `findCountryByDialPrefix('')` always falls back to
  // Sénégal — deriving `selected` straight from `value` would silently
  // discard a country picked before any digit was typed. Kept as local
  // state instead, only re-synced from `value` when it's non-empty (e.g.
  // loading an existing client's stored international number).
  const [selected, setSelected] = useState<CountryDialCode>(() => findCountryByDialPrefix(value));
  useEffect(() => {
    if (value.startsWith('+')) setSelected(findCountryByDialPrefix(value));
  }, [value]);

  const localDigits = value.startsWith('+') ? value.slice(1 + selected.dialCode.length) : '';

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open]);

  function selectCountry(country: CountryDialCode) {
    setOpen(false);
    setSearch('');
    setSelected(country);
    onChange(localDigits ? `+${country.dialCode}${localDigits}` : '');
  }

  function setLocalDigits(raw: string) {
    const digits = raw.replace(/\D/g, '');
    onChange(digits ? `+${selected.dialCode}${digits}` : '');
  }

  const query = search.trim().toLowerCase();
  const filtered = query
    ? COUNTRY_DIAL_CODES.filter(
        (c) => c.nameFr.toLowerCase().includes(query) || c.dialCode.includes(query),
      )
    : COUNTRY_DIAL_CODES;

  return (
    <div>
      {showLabel && (
        <div className="text-xs font-headings font-bold uppercase tracking-wide text-foreground mb-2">
          {label}
        </div>
      )}
      <div className="relative" ref={containerRef}>
        <div
          className={
            compact
              ? 'flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2.5'
              : 'flex items-center gap-3 bg-input border border-border rounded-xl px-4 py-3.5'
          }
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 flex-shrink-0"
          >
            <span className={compact ? 'text-sm leading-none' : 'text-base leading-none'}>
              {flagEmoji(selected.iso2)}
            </span>
            <span
              className={
                compact ? 'text-sm text-muted-foreground' : 'text-base text-muted-foreground'
              }
            >
              +{selected.dialCode}
            </span>
            <Icon i="chevron-down" size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
          <div className="w-px h-5 bg-border flex-shrink-0" />
          <input
            type="tel"
            inputMode="numeric"
            value={localDigits}
            onChange={(e) => setLocalDigits(e.target.value)}
            placeholder="77 123 45 67"
            className={
              compact
                ? 'flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none min-w-0'
                : 'flex-1 bg-transparent text-base text-foreground placeholder-muted-foreground outline-none min-w-0'
            }
          />
        </div>

        {open && (
          <div className="absolute z-10 mt-1 w-full bg-background border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border px-3 py-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher un pays..."
                className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
              />
            </div>
            {filtered.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">Aucun résultat</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted border-b border-border last:border-b-0"
                >
                  <span className="leading-none">{flagEmoji(c.iso2)}</span>
                  <span className="flex-1 min-w-0 truncate">{c.nameFr}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">+{c.dialCode}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {helper && <div className="text-xs text-muted-foreground mt-2">{helper}</div>}
    </div>
  );
}
