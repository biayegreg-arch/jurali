import type { Transition, Variants } from 'framer-motion';

/**
 * Shared motion tokens — one place to keep the "premium but subtle" feel
 * consistent (no bounce, short durations, small offsets). Global
 * prefers-reduced-motion handling lives in MotionConfig (see layout.tsx),
 * so call sites don't need to check it themselves.
 */
export const EASE_PREMIUM = [0.16, 1, 0.3, 1] as const;

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_PREMIUM } },
};

/**
 * List-row entrance with a per-index delay, capped at 6 items so a long
 * list doesn't crawl in — pass `custom={index}` alongside this variant.
 */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: EASE_PREMIUM, delay: Math.min(index, 6) * 0.04 },
  }),
};

export const tapScale = { scale: 0.97 };
export const hoverLift = { y: -2 };

export const countUpTransition: Transition = { duration: 0.7, ease: EASE_PREMIUM };
