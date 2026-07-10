'use client';

import * as RadixToast from '@radix-ui/react-toast';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from './cn';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: 'default' | 'success' | 'error';
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((opts: ToastOptions) => void) | null>(null);

export function useToast(): (opts: ToastOptions) => void {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside <ToastProvider>');
  return push;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((opts: ToastOptions) => {
    setToasts((prev) => [...prev, { ...opts, id: Date.now() + Math.random() }]);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="down">
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            duration={toast.durationMs ?? 4000}
            className={cn(
              'mq-toast',
              toast.tone === 'error' && 'mq-toast--error',
              toast.tone === 'success' && 'mq-toast--success',
            )}
            onOpenChange={(open) => {
              if (!open) setToasts((prev) => prev.filter((t) => t.id !== toast.id));
            }}
          >
            <div>
              <RadixToast.Title className="mq-toast__title">{toast.title}</RadixToast.Title>
              {toast.description && (
                <RadixToast.Description className="mq-toast__description">
                  {toast.description}
                </RadixToast.Description>
              )}
            </div>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="mq-toast__viewport" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
