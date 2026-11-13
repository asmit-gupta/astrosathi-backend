/**
 * Errors carry a stable machine code. Apps map codes to Hindi/English strings,
 * so no user-facing copy is hard-coded here; `message` is for developers and logs.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(400, code, message, details);
export const unauthorized = (code = 'UNAUTHORIZED', message = 'Authentication required') =>
  new AppError(401, code, message);
export const forbidden = (code = 'FORBIDDEN', message = 'Not allowed') => new AppError(403, code, message);
export const notFound = (code = 'NOT_FOUND', message = 'Not found') => new AppError(404, code, message);
export const tooManyRequests = (code: string, message: string, retryAfterSeconds: number) =>
  new AppError(429, code, message, { retryAfterSeconds });
