import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

type OfflineListener = (userId: number) => void;

@Injectable()
export class PresenceService {
  private readonly socketsByUser = new Map<number, Set<string>>();
  private readonly offlineListeners: OfflineListener[] = [];
  private readonly pendingOfflineTimers = new Map<number, NodeJS.Timeout>();
  private readonly offlineGraceMs = 3500;

  onUserOffline(listener: OfflineListener) {
    this.offlineListeners.push(listener);
  }

  register(client: Socket, userId: number) {
    client.data.userId = userId;
    void client.join(`user:${userId}`);

    const pending = this.pendingOfflineTimers.get(userId);
    if (pending) {
      clearTimeout(pending);
      this.pendingOfflineTimers.delete(userId);
    }

    let sockets = this.socketsByUser.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.socketsByUser.set(userId, sockets);
    }

    const becameOnline =
      sockets.size === 0 && !this.pendingOfflineTimers.has(userId);
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
      const existing = this.pendingOfflineTimers.get(userId);
      if (existing) {
        clearTimeout(existing);
      }
      const timer = setTimeout(() => {
        this.pendingOfflineTimers.delete(userId);
        if ((this.socketsByUser.get(userId)?.size ?? 0) > 0) {
          return;
        }
        for (const listener of this.offlineListeners) {
          listener(userId);
        }
      }, this.offlineGraceMs);
      this.pendingOfflineTimers.set(userId, timer);
    }

    return { userId, wentOffline };
  }

  isOnline(userId: number) {
    return (
      (this.socketsByUser.get(userId)?.size ?? 0) > 0 ||
      this.pendingOfflineTimers.has(userId)
    );
  }

  getOnlineUserIds() {
    return [...this.socketsByUser.keys()];
  }
}
