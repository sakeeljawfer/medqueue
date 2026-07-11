import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/** Records request duration labelled by route pattern (not raw URL — bounded cardinality). */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const route = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
    const end = this.metrics.httpDuration.startTimer({ method: req.method, route });

    return next.handle().pipe(
      tap({
        next: () => end({ status: context.switchToHttp().getResponse<Response>().statusCode }),
        error: (err: { status?: number }) => end({ status: err.status ?? 500 }),
      }),
    );
  }
}
