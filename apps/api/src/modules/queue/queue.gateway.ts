import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import type { Namespace, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { QUEUE_EVENTS } from '@medqueue/shared';
import { REDIS } from '../../infra/redis/redis.module';
import { TokenService, type AccessPayload } from '../auth/token.service';
import { QueueStateService } from './queue-state.service';
import { QueueEvents, type QueueStateChangedPayload } from './queue.events';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface AuthedSocket extends Socket {
  data: { user: AccessPayload };
}

/**
 * Namespace /queue. Rooms:
 *   session:{id}          — everyone watching a session (gets queue.state)
 *   user:{id}:{sessionId} — the patient's own sockets (gets queue.you)
 *
 * Auth: short-lived access JWT in handshake.auth.token; unauthenticated
 * connections are rejected. Re-subscribing after reconnect resends full
 * state, so resync is idempotent.
 */
@WebSocketGateway({ namespace: '/queue', cors: { origin: true, credentials: true } })
export class QueueGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(QueueGateway.name);

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly tokens: TokenService,
    private readonly state: QueueStateService,
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  afterInit(namespace: Namespace): void {
    const pub = this.redis.duplicate();
    const sub = this.redis.duplicate();
    namespace.server.adapter(createAdapter(pub, sub));

    namespace.use((socket, next) => {
      try {
        const token =
          (socket.handshake.auth as { token?: string }).token ??
          socket.handshake.headers.authorization?.replace(/^Bearer /, '');
        if (!token) return next(new Error('unauthorized'));
        (socket as AuthedSocket).data.user = this.tokens.verifyAccessToken(token);
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  handleConnection(socket: AuthedSocket): void {
    this.logger.debug(`socket connected user=${socket.data.user.sub}`);
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { sessionId: string },
  ): Promise<void> {
    const { sessionId } = body ?? {};
    if (!sessionId) return;
    const user = socket.data.user;

    await socket.join(`session:${sessionId}`);
    await socket.join(`user:${user.sub}:${sessionId}`);

    // Full resync on every (re)subscribe.
    socket.emit(QUEUE_EVENTS.state, await this.state.getState(sessionId));

    const appt = await this.prisma.appointment.findFirst({
      where: {
        sessionId,
        patientId: user.sub,
        status: { in: ['BOOKED', 'IN_CONSULT', 'NO_SHOW'] },
      },
      orderBy: { tokenNumber: 'desc' },
    });
    if (appt) {
      socket.emit(
        QUEUE_EVENTS.you,
        await this.state.youFor(sessionId, appt.tokenNumber, appt.status),
      );
    }
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { sessionId: string },
  ): Promise<void> {
    if (!body?.sessionId) return;
    await socket.leave(`session:${body.sessionId}`);
    await socket.leave(`user:${socket.data.user.sub}:${body.sessionId}`);
  }

  @OnEvent(QueueEvents.QueueAdvanced)
  onQueueChanged(payload: QueueStateChangedPayload): void {
    const { state, you } = payload;
    this.server.to(`session:${state.sessionId}`).emit(QUEUE_EVENTS.state, state);
    for (const target of you) {
      this.server
        .to(`user:${target.patientId}:${state.sessionId}`)
        .emit(QUEUE_EVENTS.you, target.you);
    }
  }
}
