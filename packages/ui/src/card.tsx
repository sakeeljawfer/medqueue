import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padded = true, interactive = false, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'mq-card',
        padded && 'mq-card--pad',
        interactive && 'mq-card--interactive',
        className,
      )}
      {...rest}
    />
  );
});
