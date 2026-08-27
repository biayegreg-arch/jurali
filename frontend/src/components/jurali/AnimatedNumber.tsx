'use client';

import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { formatPrice } from '@/lib/utils';
import { countUpTransition } from '@/lib/motion';

export interface AnimatedNumberProps {
  value: number;
  /** Defaults to formatPrice (no currency suffix — callers append their own). */
  format?: (n: number) => string;
  className?: string;
}

/**
 * Counts from the previously displayed value to `value` on every change —
 * including the first mount (from 0), so a KPI never just "pops in" static.
 */
export function AnimatedNumber({ value, format = formatPrice, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  // Kept in a ref (not an effect dep) so passing an inline formatter doesn't
  // restart the count-up animation on every unrelated parent re-render.
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const controls = animate(prevValue.current, value, {
      ...countUpTransition,
      onUpdate: (latest) => setDisplay(latest),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value]);

  return <span className={className}>{formatRef.current(Math.round(display))}</span>;
}
