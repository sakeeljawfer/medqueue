import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TokenService, type AccessPayload } from '../../modules/auth/token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const ACCESS_COOKIE = 'mq_access';
export const REFRESH_COOKIE = 'mq_refresh';

export interface AuthedRequest extends Request {
  user: AccessPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    const bearer = req.headers.authorization?.replace(/^Bearer /, '');
    const token = cookieToken ?? bearer;
    if (!token) throw new UnauthorizedException('missing_access_token');

    req.user = this.tokens.verifyAccessToken(token);
    return true;
  }
}
