/**
 * k6 load test: 500 concurrent patients watching one live queue.
 *
 * Speaks the Socket.IO v4 protocol over a raw WebSocket (Engine.IO v4
 * framing), because k6 has no Socket.IO client:
 *   server → "0{...}"                     Engine.IO open
 *   client → "40/queue,{"token":"…"}"     namespace connect + auth
 *   server → "40/queue,{...}"             namespace ack
 *   client → '42/queue,["subscribe",{"sessionId":"…"}]'
 *   server → '42/queue,["queue.state",{...}]' on every advance
 *   client ↔ "2"/"3" ping-pong keepalives
 *
 * Usage:
 *   k6 run load/queue-watch.js \
 *     -e API_URL=http://localhost:4000 \
 *     -e SESSION_ID=<live session id> \
 *     -e SOCKET_TOKEN=<jwt from POST /auth/socket-token>
 *
 * A patient token works; queue.state is broadcast to every subscriber in the
 * session room, which is the fan-out being measured.
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const stateUpdates = new Counter('queue_state_updates');
const connectTime = new Trend('socket_connect_ms', true);

export const options = {
  scenarios: {
    watchers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 500 }, // ramp to a full waiting room
        { duration: '3m', target: 500 }, // hold while the doctor advances
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    socket_connect_ms: ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:4000';
const SESSION_ID = __ENV.SESSION_ID;
const SOCKET_TOKEN = __ENV.SOCKET_TOKEN;

export default function () {
  if (!SESSION_ID || !SOCKET_TOKEN) {
    throw new Error('SESSION_ID and SOCKET_TOKEN env vars are required');
  }

  const url = `${API_URL.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`;
  const started = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    let namespaceConnected = false;

    socket.on('message', (msg) => {
      if (msg.startsWith('0')) {
        // Engine.IO open → connect to the /queue namespace with JWT auth.
        socket.send(`40/queue,${JSON.stringify({ token: SOCKET_TOKEN })}`);
        return;
      }
      if (msg === '2') {
        socket.send('3'); // Engine.IO ping → pong
        return;
      }
      if (msg.startsWith('40/queue')) {
        namespaceConnected = true;
        connectTime.add(Date.now() - started);
        socket.send(`42/queue,${JSON.stringify(['subscribe', { sessionId: SESSION_ID }])}`);
        return;
      }
      if (msg.startsWith('44/queue')) {
        // Namespace connection refused (bad/expired token).
        check(null, { 'socket auth accepted': () => false });
        socket.close();
        return;
      }
      if (msg.startsWith('42/queue')) {
        const payload = JSON.parse(msg.slice(msg.indexOf(',') + 1));
        if (payload[0] === 'queue.state') stateUpdates.add(1);
      }
    });

    // Watch for the whole hold period, then leave.
    socket.setTimeout(() => {
      check(namespaceConnected, { 'joined /queue namespace': (ok) => ok });
      socket.close();
    }, 200_000);
  });

  check(res, { 'websocket handshake 101': (r) => r && r.status === 101 });
}
