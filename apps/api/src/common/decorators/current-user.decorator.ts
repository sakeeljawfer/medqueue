import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from '../guards/jwt-auth.guard';
import type { AccessPayload } from '../../modules/auth/token.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessPayload => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user;
  },
);
