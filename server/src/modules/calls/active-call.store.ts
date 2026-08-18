export abstract class ActiveCallStore {
  abstract getCallId(userId: number): string | undefined;
  abstract setUserCall(userId: number, callId: string): void;
  abstract deleteUser(userId: number): void;
  abstract clearCall(callId: string): void;
  abstract getUserIds(callId: string): number[];
}
