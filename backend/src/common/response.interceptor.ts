import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (this.hasStructuredPayload(data)) {
          return {
            success: true,
            message: data.message,
            data: data.data,
          };
        }

        return {
          success: true,
          message: this.resolveMessage(context),
          data,
        };
      }),
    );
  }

  private hasStructuredPayload(
    data: unknown,
  ): data is { message: string; data: unknown } {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const payload = data as Record<string, unknown>;
    return typeof payload.message === 'string' && 'data' in payload;
  }

  private resolveMessage(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest<{ method?: string }>();

    if (request.method === 'POST') {
      return 'Request processed successfully';
    }

    return 'Request successful';
  }
}
