import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'verified' | 'live' | 'danger' | 'success';
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cn('mq-badge', `mq-badge--${tone}`, className)} {...rest} />;
}
