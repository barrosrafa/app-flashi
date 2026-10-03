export class EdgeError extends Error {
  constructor(public fn: string, public status: number, message: string) {
    super(`[${fn}] ${status || 'network'}: ${message}`);
    this.name = 'EdgeError';
  }
}
export class RateLimitError extends EdgeError {
  constructor(public fn: string, public retryAfterSec: number) {
    super(fn, 429, `Rate limit em ${fn} — tente em ${retryAfterSec}s`);
    this.name = 'RateLimitError';
  }
}
export class EdgeTimeoutError extends EdgeError {
  constructor(fn: string, public timeoutMs: number) {
    super(fn, 408, `Tempo limite excedido após ${timeoutMs}ms`);
    this.name = 'EdgeTimeoutError';
  }
}
