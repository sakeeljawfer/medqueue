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
import {
  LoginDto,
  RegisterDoctorDto,
  RegisterPatientDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';

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
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string; role: string; name: string | null; isNew: boolean; accessToken: string }> {
    const { user, tokens, isNew } = await this.auth.login(dto.identifier, dto.password);
    this.setCookies(res, tokens);
    return { id: user.id, role: user.role, name: user.name, isNew, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('register/patient')
  @HttpCode(201)
  async registerPatient(
    @Body() dto: RegisterPatientDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string; role: string; name: string | null; isNew: boolean; accessToken: string }> {
    const { user, tokens, isNew } = await this.auth.registerPatient(dto);
    this.setCookies(res, tokens);
    return { id: user.id, role: user.role, name: user.name, isNew, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('register/doctor')
  @HttpCode(201)
  async registerDoctor(
    @Body() dto: RegisterDoctorDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string; role: string; name: string | null; isNew: boolean; accessToken: string }> {
    const { user, tokens, isNew } = await this.auth.registerDoctor(dto);
    this.setCookies(res, tokens);
    return { id: user.id, role: user.role, name: user.name, isNew, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('otp/request')
  @HttpCode(202)
  async requestOtp(
    @Body() dto: RequestOtpDto,
    @Ip() ip: string,
  ): Promise<{ sent: true; code?: string }> {
    const code = await this.auth.requestOtp(dto.phone, ip);
    return {
      sent: true,
      ...(this.env.SMS_PROVIDER === 'CONSOLE' ? { code } : {}),
    };
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string; role: string; name: string | null; isNew: boolean; accessToken: string }> {
    const { user, tokens, isNew } = await this.auth.verifyOtp(dto);
    this.setCookies(res, tokens);
    return { id: user.id, role: user.role, name: user.name, isNew, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ refreshed: true; accessToken: string }> {
    const presented = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!presented) throw new UnauthorizedException('missing_refresh_token');
    const rotated = await this.tokens.rotate(presented);
    this.setCookies(res, rotated);
    return { refreshed: true, accessToken: rotated.accessToken };
  }

  /**
   * Short-lived token for the Socket.IO handshake — the browser cannot read
   * the httpOnly access cookie, so it exchanges it here.
   */
  @Post('socket-token')
  @HttpCode(200)
  socketToken(@Req() req: Request): { token: string } {
    const user = (req as Request & { user: { sub: string; role: never } }).user;
    return { token: this.tokens.signAccessToken({ sub: user.sub, role: user.role }) };
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
