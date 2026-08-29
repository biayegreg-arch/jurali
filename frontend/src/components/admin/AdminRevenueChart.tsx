import { formatPrice } from '@/lib/utils';

export interface MonthlyRevenuePoint {
  month: string; // "2026-08"
  totalFcfa: number;
}

/** Real single-series monthly bar chart — shared by /admin and /admin/revenue. */
export function AdminRevenueChart({ points }: { points: MonthlyRevenuePoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.totalFcfa));
  return (
    <div className="flex items-end gap-2" style={{ height: 120 }}>
      {points.map((m) => (
        <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="w-full flex items-end" style={{ height: 100 }}>
            <div
              className="w-full rounded-sm bg-primary"
              style={{ height: `${Math.max(2, (m.totalFcfa / max) * 100)}%` }}
              title={`${formatPrice(m.totalFcfa)} FCFA`}
            />
          </div>
          <div className="text-xs text-muted-foreground truncate w-full text-center">
            {m.month.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}
