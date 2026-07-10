import type { CSSProperties } from 'react';
import { cn } from './cn';

export interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  radius?: CSSProperties['borderRadius'];
  className?: string;
}

export function Skeleton({ width, height = 16, radius, className }: SkeletonProps) {
  return (
    <div
      className={cn('mq-skeleton', className)}
      style={{ width, height, borderRadius: radius }}
      aria-hidden
    />
  );
}
