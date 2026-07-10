import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn('mq-btn', `mq-btn--${variant}`, `mq-btn--${size}`, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="mq-spinner" aria-hidden />}
      {children}
    </button>
  );
});
