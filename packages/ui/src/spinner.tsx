import { cn } from './cn';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label ?? 'Loading'}>
      <span className={cn('mq-spinner', className)} aria-hidden />
    </span>
  );
}
