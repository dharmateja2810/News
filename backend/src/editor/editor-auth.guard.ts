import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EditorAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const password = request.headers['x-editor-password'];
    const expected = this.configService.get<string>('EDITOR_PASSWORD');

    if (!expected) {
      throw new UnauthorizedException('EDITOR_PASSWORD not configured');
    }
    if (!password || password !== expected) {
      throw new UnauthorizedException('Invalid editor password');
    }
    return true;
  }
}
