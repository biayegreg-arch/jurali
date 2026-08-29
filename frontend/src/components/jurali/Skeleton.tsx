import type { CSSProperties } from 'react';

/** Shape-matched loading placeholder — pulsing block, sized via className. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} style={style} />;
}
