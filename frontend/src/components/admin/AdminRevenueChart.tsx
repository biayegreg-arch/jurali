import { Skeleton } from '@/components/jurali/Skeleton';
import { formatPrice } from '@/lib/utils';

export interface MonthlyRevenuePoint {
  month: string; // "2026-08"
  totalFcfa: number;
}

/** Real single-series monthly bar chart — shared by /admin and /admin/revenue. */
export function AdminRevenueChart({
  points,
  loading = false,
}: {
  points: MonthlyRevenuePoint[];
  loading?: boolean;
}) {
  if (loading) {
    // Shape-matched skeleton — 6 bars of varying pulsing height, same
    // footprint as the real chart so the layout doesn't jump on load.
    const heights = [55, 70, 40, 85, 60, 95];
    return (
      <div className="flex items-end gap-2" style={{ height: 120 }}>
        {heights.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full flex items-end" style={{ height: 100 }}>
              <Skeleton className="w-full" style={{ height: `${h}%` }} />
            </div>
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>
    );
  }

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
