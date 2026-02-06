import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Query, 
  HttpCode, 
  HttpStatus, 
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 201, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify user email' })
  @ApiQuery({ name: 'token', required: true })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    await this.authService.verifyEmail(token);
    
    // Redirect to app or success page
    const appScheme = this.configService.get<string>('APP_SCHEME') || 'dailydigest';
    const webUrl = this.configService.get<string>('WEB_URL') || 'http://localhost:8081';
    
    // Try to open the app, fall back to web
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verified - DailyDigest</title>
        <meta http-equiv="refresh" content="3;url=${webUrl}">
        <style>
          body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .card { background: white; padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
          h1 { color: #667eea; margin-bottom: 16px; }
          p { color: #666; }
          .checkmark { font-size: 64px; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="checkmark">✅</div>
          <h1>Email Verified!</h1>
          <p>Your email has been successfully verified.</p>
          <p>You can now close this page and return to the app.</p>
        </div>
        <script>
          // Try to open the app
          window.location.href = '${appScheme}://verified';
        </script>
      </body>
      </html>
    `);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 201, description: 'Verification email sent if user exists' })
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationEmail(email);
  }

  // Google OAuth
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleAuth() {
    // Passport handles the redirect
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.handleGoogleAuth(req.user as any);
    
    // Redirect to app with token
    const appScheme = this.configService.get<string>('APP_SCHEME') || 'dailydigest';
    res.redirect(`${appScheme}://auth?token=${result.token}&user=${encodeURIComponent(JSON.stringify(result.user))}`);
  }

  // Apple OAuth
  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  @ApiOperation({ summary: 'Initiate Apple OAuth flow' })
  appleAuth() {
    // Passport handles the redirect
  }

  @Post('apple/callback')
  @UseGuards(AuthGuard('apple'))
  @ApiOperation({ summary: 'Apple OAuth callback' })
  async appleCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.handleAppleAuth(req.user as any);
    
    // Redirect to app with token
    const appScheme = this.configService.get<string>('APP_SCHEME') || 'dailydigest';
    res.redirect(`${appScheme}://auth?token=${result.token}&user=${encodeURIComponent(JSON.stringify(result.user))}`);
  }

  // Mobile OAuth token exchange (for native OAuth flows)
  @Post('google/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange Google ID token for app token' })
  async googleTokenExchange(@Body('idToken') idToken: string, @Body('user') user: any) {
    // In production, verify the idToken with Google
    // For now, trust the user data from the mobile SDK
    return this.authService.handleGoogleAuth({
      googleId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.photo,
    });
  }

  @Post('apple/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange Apple identity token for app token' })
  async appleTokenExchange(@Body('identityToken') identityToken: string, @Body('user') user: any) {
    // In production, verify the identityToken with Apple
    // For now, trust the user data from the mobile SDK
    return this.authService.handleAppleAuth({
      appleId: user.id,
      email: user.email,
      name: user.fullName ? `${user.fullName.givenName || ''} ${user.fullName.familyName || ''}`.trim() : undefined,
    });
  }
}

