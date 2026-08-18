import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthService } from './auth.service';

@Injectable()
export class WsAuthService {
  constructor(private readonly authService: AuthService) {}

  async authenticate(client: Socket) {
    const token = this.readToken(client);
    if (!token) {
      return null;
    }

    try {
      return await this.authService.assertAccessToken(token);
    } catch {
      return null;
    }
  }

  private readToken(client: Socket) {
    const fromAuth = (client.handshake.auth as { token?: unknown } | undefined)
      ?.token;
    if (typeof fromAuth === 'string' && fromAuth) {
      return fromAuth;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }

    return null;
  }
}
