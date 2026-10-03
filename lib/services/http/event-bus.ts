import type { EdgeError, RateLimitError } from './errors';
export type EdgeErrorEvent = { error: EdgeError | RateLimitError; fn: string };
const listeners = new Set<(event: EdgeErrorEvent) => void>();
export const edgeErrorBus = {
  emit(event: EdgeErrorEvent) { listeners.forEach((listener) => listener(event)); },
  subscribe(listener: (event: EdgeErrorEvent) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
