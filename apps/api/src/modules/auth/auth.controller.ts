import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../../config/env';
import { Public } from '../../common/decorators/public.decorator';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { TokenService, type IssuedTokens } from './token.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';

const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private setCookies(res: Response, tokens: IssuedTokens): void {
    const base = {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: ACCESS_COOKIE_MAX_AGE });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...base,
      path: '/auth',
      expires: tokens.refreshExpiresAt,
    });
  }

  @Public()
  @Post('otp/request')
  @HttpCode(202)
  async requestOtp(@Body() dto: RequestOtpDto, @Ip() ip: string): Promise<{ sent: true }> {
    await this.auth.requestOtp(dto.phone, ip);
    return { sent: true };
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string; role: string; name: string | null; isNew: boolean }> {
    const { user, tokens, isNew } = await this.auth.verifyOtp(dto);
    this.setCookies(res, tokens);
    return { id: user.id, role: user.role, name: user.name, isNew };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ refreshed: true }> {
    const presented = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!presented) throw new UnauthorizedException('missing_refresh_token');
    const rotated = await this.tokens.rotate(presented);
    this.setCookies(res, rotated);
    return { refreshed: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const presented = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (presented) await this.tokens.revokeByToken(presented);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }
}
