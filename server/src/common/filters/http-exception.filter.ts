import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthException } from '../../modules/auth/types/auth.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AuthException) {
      response.status(exception.status).json({
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : Array.isArray((body as { message?: string | string[] }).message)
            ? (body as { message: string[] }).message.join(', ')
            : ((body as { message?: string }).message ?? exception.message);

      response.status(status).json({
        success: false,
        error: {
          code: status === 401 ? 'UNAUTHORIZED' : 'REQUEST_FAILED',
          message,
        },
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.message : 'Unhandled error',
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      },
    });
  }
}
