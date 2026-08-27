'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

/** next/link wrapped so it can take motion props (variants, whileTap, …). */
export const MotionLink = motion.create(Link);
