import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      const err = exception instanceof Error ? exception : undefined;
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status} ${err?.message ?? String(exception)}`,
        err?.stack,
      );
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      res
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : { statusCode: status, ...body },
        );
      return;
    }

    res.status(status).json({
      statusCode: status,
      message: 'Internal server error',
    });
  }
}
