'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { QueueState, QueueYou } from '@medqueue/shared';
import { API_URL } from './api';

/**
 * Subscribes to a session's live queue over the /queue socket namespace.
 * Auth uses a short-lived socket token fetched from the API (the access
 * cookie is httpOnly, so it cannot be read directly).
 */
export function useQueueSocket(sessionId: string | null): {
  state: QueueState | null;
  you: QueueYou | null;
  connected: boolean;
} {
  const [state, setState] = useState<QueueState | null>(null);
  const [you, setYou] = useState<QueueYou | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function connect(): Promise<void> {
      const res = await fetch(`${API_URL}/auth/socket-token`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok || cancelled) return;
      const { token } = (await res.json()) as { token: string };

      const socket = io(`${API_URL}/queue`, {
        auth: { token },
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        socket.emit('subscribe', { sessionId });
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('queue.state', (payload: QueueState) => {
        if (payload.sessionId === sessionId) setState(payload);
      });
      socket.on('queue.you', (payload: QueueYou) => {
        if (payload.sessionId === sessionId) setYou(payload);
      });
    }

    void connect();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  return { state, you, connected };
}
