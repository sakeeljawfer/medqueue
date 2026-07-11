'use client';

import { AnimatePresence, motion } from 'framer-motion';

/**
 * Digit-by-digit morph: changed digits slide out/in instead of the whole
 * number re-rendering with a flash.
 */
export function MorphNumber({ value, className }: { value: number; className?: string }) {
  const digits = String(value).padStart(2, '0').split('');

  return (
    <span className={className} style={{ display: 'inline-flex', overflow: 'hidden' }}>
      {digits.map((digit, i) => (
        <span key={`${digits.length}-${i}`} style={{ position: 'relative', display: 'inline-block' }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={digit}
              initial={{ y: '0.9em', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-0.9em', opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              style={{ display: 'inline-block' }}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
