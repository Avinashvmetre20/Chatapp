import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

type OfflineListener = (userId: number) => void;

@Injectable()
export class PresenceService {
  private readonly socketsByUser = new Map<number, Set<string>>();
  private readonly offlineListeners: OfflineListener[] = [];

  onUserOffline(listener: OfflineListener) {
    this.offlineListeners.push(listener);
  }

  register(client: Socket, userId: number) {
    client.data.userId = userId;
    void client.join(`user:${userId}`);

    let sockets = this.socketsByUser.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.socketsByUser.set(userId, sockets);
    }

    const becameOnline = sockets.size === 0;
    sockets.add(client.id);
    return { becameOnline };
  }

  unregister(client: Socket) {
    const userId = Number(client.data.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      return { userId: null, wentOffline: false };
    }

    const sockets = this.socketsByUser.get(userId);
    if (!sockets) {
      return { userId, wentOffline: false };
    }

    sockets.delete(client.id);
    const wentOffline = sockets.size === 0;
    if (wentOffline) {
      this.socketsByUser.delete(userId);
      for (const listener of this.offlineListeners) {
        listener(userId);
      }
    }

    return { userId, wentOffline };
  }

  isOnline(userId: number) {
    return (this.socketsByUser.get(userId)?.size ?? 0) > 0;
  }

  getOnlineUserIds() {
    return [...this.socketsByUser.keys()];
  }
}
