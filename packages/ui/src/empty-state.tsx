import type { ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('mq-empty', className)}>
      {icon && (
        <div className="mq-empty__art" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="mq-empty__title">{title}</h3>
      {body && <p className="mq-empty__body">{body}</p>}
      {action}
    </div>
  );
}
