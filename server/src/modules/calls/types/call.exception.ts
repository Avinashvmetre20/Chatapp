import { CallErrorCode } from './call.types';

export class CallException extends Error {
  constructor(
    readonly code: CallErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CallException';
  }
}
