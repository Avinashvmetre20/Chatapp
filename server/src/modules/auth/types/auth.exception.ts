export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_IN_USE = 'EMAIL_IN_USE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  RESET_TOKEN_INVALID = 'RESET_TOKEN_INVALID',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
}

export class AuthException extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    readonly status = 401,
  ) {
    super(message);
    this.name = 'AuthException';
  }
}
