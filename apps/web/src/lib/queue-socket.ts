'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { QueueState, QueueYou } from '@medqueue/shared';
import { API_URL, getAuthTokenForPath } from './api';

/**
 * Subscribes to a session's live queue over the /queue socket namespace.
 * Auth uses a short-lived socket token fetched from the API (or stored bearer token).
 * Connects reliably and joins session room for live instant sync.
 */
export function useQueueSocket(sessionId: string | null): {
  state: QueueState | null;
  you: QueueYou | null;
  connected: boolean;
  lastUpdated: number;
} {
  const [state, setState] = useState<QueueState | null>(null);
  const [you, setYou] = useState<QueueYou | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function connect(): Promise<void> {
      try {
        const tokenForSocket =
          getAuthTokenForPath('/doctor') ??
          getAuthTokenForPath('/ticket') ??
          getAuthTokenForPath('/');
        const headers: Record<string, string> = {};
        if (tokenForSocket) {
          headers['Authorization'] = `Bearer ${tokenForSocket}`;
        }

        let token = tokenForSocket ?? undefined;
        try {
          const res = await fetch(`${API_URL}/auth/socket-token`, {
            method: 'POST',
            credentials: 'include',
            headers,
          });
          if (res.ok) {
            const body = (await res.json()) as { token: string };
            if (body.token) token = body.token;
          }
        } catch {
          // Fall back to tokenForSocket
        }

        if (cancelled) return;

        const socket = io(`${API_URL}/queue`, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          setConnected(true);
          socket.emit('subscribe', { sessionId });
        });

        socket.on('disconnect', () => setConnected(false));

        socket.on('queue.state', (payload: QueueState) => {
          if (payload.sessionId === sessionId) {
            setState(payload);
            setLastUpdated(Date.now());
          }
        });

        socket.on('queue.you', (payload: QueueYou) => {
          if (payload.sessionId === sessionId) {
            setYou(payload);
            setLastUpdated(Date.now());
          }
        });

        socket.on('queue.booked', () => {
          setLastUpdated(Date.now());
        });

        socket.on('queue.updated', () => {
          setLastUpdated(Date.now());
        });
      } catch {
        // Socket connection error catch
      }
    }

    void connect();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  return { state, you, connected, lastUpdated };
}
