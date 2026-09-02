'use client';

// Shared by /clients/new (create) and /clients/[id]/edit — Banani's
// `CreateClientDesktop.jsx` reused for both, per the confirmed 2026-08-26
// decision to build a real PATCH-backed edit flow rather than leaving
// Fiche client's "Modifier" button inert. Mobile-first: Banani only gave a
// desktop mock, so the unprefixed classes below are the phone layout,
// `lg:` adds the sidebar + 2-column info panel.
import { Icon } from './Icon';
import { PhoneField } from './PhoneField';
import { AUTO_REMINDER_THRESHOLD_DAYS } from '@/lib/server/jurali/auto-reminder';
import { OVERDUE_ALERT_THRESHOLD_DAYS } from '@/lib/server/jurali/overdue-alert';

export interface ClientFormValues {
  firstName: string;
  phone: string;
  email: string;
  address: string;
  autoReminderEnabled: boolean;
  /** Empty string = use the account-wide default (AUTO_REMINDER_THRESHOLD_DAYS). */
  autoReminderThresholdDays: string;
  /** Empty string = use the account-wide default (OVERDUE_ALERT_THRESHOLD_DAYS). */
  overdueAlertThresholdDays: string;
}

export interface ClientFormProps {
  mode: 'create' | 'edit';
  values: ClientFormValues;
  onChange: (values: ClientFormValues) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  cancelHref: string;
  /** Per-client reminder overrides are Premium-gated, same as the
   * account-wide toggles in Réglages — only shown once editing an
   * existing client (mode === 'edit'), per the confirmed 2026-09-02
   * decision. */
  isPremium?: boolean;
}

export function ClientForm({
  mode,
  values,
  onChange,
  onSubmit,
  submitting,
  error,
  cancelHref,
  isPremium = false,
}: ClientFormProps) {
  function set<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-lg lg:max-w-none w-full mx-auto lg:mx-0">
      <Field
        icon="user"
        label="Nom complet"
        required
        value={values.firstName}
        onChange={(v) => set('firstName', v)}
        placeholder="Aïssatou Ndiaye"
        helper="Obligatoire"
      />
      <PhoneField
        value={values.phone}
        onChange={(v) => set('phone', v)}
        helper="Recommandé — pour les rappels WhatsApp"
      />
      <Field
        icon="mail"
        label="Email"
        value={values.email}
        onChange={(v) => set('email', v)}
        placeholder="email@exemple.com"
        type="email"
        helper="Optionnel — pour les factures"
      />
      <Field
        icon="map-pin"
        label="Localisation"
        value={values.address}
        onChange={(v) => set('address', v)}
        placeholder="Dakar, Sénégal"
        helper="Optionnel — pour tes notes"
      />

      {mode === 'edit' && (
        <div>
          <div className="text-xs font-headings font-bold uppercase tracking-wide text-foreground mb-2">
            Rappels pour ce client
          </div>
          {!isPremium ? (
            <a
              href="/premium"
              className="flex items-center gap-3 bg-secondary border border-border rounded-xl px-4 py-3.5"
            >
              <Icon i="crown" size={18} className="text-primary flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                Personnalise les rappels de ce client — réservé à Premium.
              </div>
            </a>
          ) : (
            <div className="flex flex-col gap-4 bg-input border border-border rounded-xl px-4 py-3.5">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">Rappel WhatsApp automatique</span>
                <input
                  type="checkbox"
                  checked={values.autoReminderEnabled}
                  onChange={(e) => set('autoReminderEnabled', e.target.checked)}
                  className="w-5 h-5 accent-primary"
                />
              </label>
              {values.autoReminderEnabled && (
                <DaysField
                  label="Envoyer le rappel après"
                  value={values.autoReminderThresholdDays}
                  onChange={(v) => set('autoReminderThresholdDays', v)}
                  placeholder={String(AUTO_REMINDER_THRESHOLD_DAYS)}
                />
              )}
              <DaysField
                label="Alerter dette en retard après"
                value={values.overdueAlertThresholdDays}
                onChange={(v) => set('overdueAlertThresholdDays', v)}
                placeholder={String(OVERDUE_ALERT_THRESHOLD_DAYS)}
              />
            </div>
          )}
        </div>
      )}

      {error && <div className="text-sm text-danger">{error}</div>}

      <div className="flex flex-col-reverse lg:flex-row gap-3 pt-2">
        <a
          href={cancelHref}
          className="lg:px-6 flex items-center justify-center gap-2 bg-surface border border-border text-foreground font-headings font-bold text-base py-3.5 lg:py-4 rounded-xl"
        >
          <Icon i="x" size={18} />
          Annuler
        </a>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !values.firstName.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl disabled:opacity-50"
        >
          <Icon i="check" size={20} />
          {submitting ? 'Enregistrement…' : mode === 'create' ? 'Créer le client' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  helper,
  required = false,
  type = 'text',
}: {
  icon: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helper: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <div className="text-xs font-headings font-bold uppercase tracking-wide text-foreground mb-2">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </div>
      <div
        className={`flex items-center gap-3 bg-input border rounded-xl px-4 py-3.5 ${
          required ? 'border-2 border-primary' : 'border-border'
        }`}
      >
        <Icon i={icon} size={18} className="text-muted-foreground flex-shrink-0" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-base text-foreground placeholder-muted-foreground outline-none min-w-0"
        />
      </div>
      <div className="text-xs text-muted-foreground mt-2">{helper}</div>
    </div>
  );
}

function DaysField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={90}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-16 bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground text-center outline-none"
        />
        <span className="text-sm text-muted-foreground">jours</span>
      </div>
    </div>
  );
}

export function ClientFormInfoPanel() {
  return (
    <div className="hidden lg:flex flex-col gap-5 w-[340px] flex-shrink-0">
      <div className="bg-secondary border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon i="info" size={16} className="text-primary" />
          <span className="font-headings font-bold text-sm text-foreground">Important</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Le numéro de téléphone est essentiel pour les rappels WhatsApp automatiques. Sans numéro,
          tu ne pourras pas envoyer de reminders.
        </p>
      </div>
      <div className="bg-input border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon i="shield" size={16} className="text-primary" />
          <span className="font-headings font-bold text-sm text-foreground">
            Données sécurisées
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Les informations de tes clients ne sont jamais partagées. Jurali ne vend pas de données.
        </p>
      </div>
    </div>
  );
}
