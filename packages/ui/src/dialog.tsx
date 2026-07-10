'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="mq-dialog__overlay" />
        <RadixDialog.Content className="mq-dialog__content">
          <RadixDialog.Title className="mq-dialog__title">{title}</RadixDialog.Title>
          {description && (
            <RadixDialog.Description className="mq-dialog__description">
              {description}
            </RadixDialog.Description>
          )}
          {children}
          {footer && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--mq-space)',
                marginTop: 'calc(var(--mq-space) * 3)',
              }}
            >
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
