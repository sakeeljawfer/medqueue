import { cn } from './cn';

export interface LiveIndicatorProps {
  label?: string;
  className?: string;
}

/** Pulsing amber dot — the only place the amber accent may appear. */
export function LiveIndicator({ label, className }: LiveIndicatorProps) {
  return (
    <span
      className={cn('mq-badge mq-badge--live', className)}
      role="status"
      aria-live="polite"
    >
      <span className="mq-live-dot" aria-hidden />
      {label}
    </span>
  );
}
