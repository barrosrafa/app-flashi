export class EdgeError extends Error {
  constructor(public fn: string, public status: number, message: string, public payload?: unknown) {
    super(`[${fn}] ${status || 'network'}: ${message}`);
    this.name = 'EdgeError';
  }
}

export class RateLimitError extends EdgeError {
  constructor(fn: string, public retryAfterSec: number, payload?: unknown) {
    super(fn, 429, `RATE_LIMITED — tente novamente em ${retryAfterSec}s`, payload);
    this.name = 'RateLimitError';
  }
}

export class AuthRequiredError extends EdgeError {
  constructor(fn: string) {
    super(fn, 401, 'AUTH_REQUIRED');
    this.name = 'AuthRequiredError';
  }
}

export class PermissionDeniedError extends EdgeError {
  constructor(fn: string, payload?: unknown) {
    super(fn, 403, 'FORBIDDEN — sua conta não tem permissão para esta operação.', payload);
    this.name = 'PermissionDeniedError';
  }
}

export class UnavailableError extends EdgeError {
  constructor(fn: string, message: string, payload?: unknown) {
    super(fn, 503, message, payload);
    this.name = 'UnavailableError';
  }
}

export class EdgeTimeoutError extends EdgeError {
  constructor(fn: string, timeoutMs: number) {
    super(fn, 408, `Tempo limite excedido após ${timeoutMs}ms`);
    this.name = 'EdgeTimeoutError';
  }
}
