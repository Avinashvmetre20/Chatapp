import { Injectable } from '@nestjs/common';
import { ActiveCallStore } from './active-call.store';

@Injectable()
export class InMemoryActiveCallStore extends ActiveCallStore {
  private readonly userToCall = new Map<number, string>();
  private readonly callToUsers = new Map<string, Set<number>>();

  getCallId(userId: number) {
    return this.userToCall.get(userId);
  }

  setUserCall(userId: number, callId: string) {
    this.userToCall.set(userId, callId);
    let users = this.callToUsers.get(callId);
    if (!users) {
      users = new Set();
      this.callToUsers.set(callId, users);
    }
    users.add(userId);
  }

  deleteUser(userId: number) {
    const callId = this.userToCall.get(userId);
    this.userToCall.delete(userId);
    if (!callId) {
      return;
    }

    const users = this.callToUsers.get(callId);
    if (!users) {
      return;
    }

    users.delete(userId);
    if (users.size === 0) {
      this.callToUsers.delete(callId);
    }
  }

  clearCall(callId: string) {
    const users = this.callToUsers.get(callId);
    if (users) {
      for (const userId of users) {
        if (this.userToCall.get(userId) === callId) {
          this.userToCall.delete(userId);
        }
      }
    }
    this.callToUsers.delete(callId);
  }

  getUserIds(callId: string) {
    return [...(this.callToUsers.get(callId) ?? [])];
  }
}
