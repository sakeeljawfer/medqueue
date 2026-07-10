import { cn } from './cn';

export interface TokenNumberProps {
  value: number;
  size?: 'md' | 'lg' | 'display';
  className?: string;
}

/** Oversized tabular-numeral token display used on tickets and consoles. */
export function TokenNumber({ value, size = 'lg', className }: TokenNumberProps) {
  return (
    <span className={cn('mq-token', `mq-token--${size}`, className)}>
      {String(value).padStart(2, '0')}
    </span>
  );
}
