'use client';

import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';

/** Subtle fade + slide-up wrapper for a page's main content on mount. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial="hidden" animate="show" variants={fadeInUp}>
      {children}
    </motion.div>
  );
}
