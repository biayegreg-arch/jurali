/** Shape-matched loading placeholder — pulsing block, sized via className. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}
