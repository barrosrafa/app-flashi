import type { EdgeError } from './errors';
const listeners = new Set<(error: EdgeError) => void>();
const clearListeners = new Set<() => void>();
export const edgeErrorBus = { emit(error: EdgeError) { listeners.forEach((listener) => listener(error)); }, clear() { clearListeners.forEach((listener) => listener()); }, subscribe(listener: (error: EdgeError) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, subscribeClear(listener: () => void) { clearListeners.add(listener); return () => { clearListeners.delete(listener); }; } };
