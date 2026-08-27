import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hoverLift, tapScale } from '@/lib/motion';

export interface SummaryStatProps {
  label: string;
  value: React.ReactNode;
  currency?: string;
  sub?: string;
  accent?: boolean;
}

/** A single KPI tile — ported from Banani's shared SummaryStat.jsx. */
export function SummaryStat({
  label,
  value,
  currency = 'FCFA',
  sub = '',
  accent = false,
}: SummaryStatProps) {
  return (
    <motion.div
      className={cn(
        'flex-1 rounded-xl px-4 py-3',
        accent ? 'bg-primary' : 'bg-surface border border-border',
      )}
      whileHover={hoverLift}
      whileTap={tapScale}
    >
      <div
        className={cn(
          'text-xs font-body mb-1',
          accent ? 'text-secondary' : 'text-muted-foreground',
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          'font-headings font-bold text-3xl leading-none',
          accent ? 'text-primary-foreground' : 'text-foreground',
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          'text-xs mt-1 font-body',
          accent ? 'text-secondary' : 'text-muted-foreground',
        )}
      >
        {currency}
        {sub ? ` · ${sub}` : ''}
      </div>
    </motion.div>
  );
}
