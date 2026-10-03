import type { EdgeError } from './errors';
const listeners = new Set<(error: EdgeError) => void>();
export const edgeErrorBus = { emit(error: EdgeError) { listeners.forEach((listener) => listener(error)); }, subscribe(listener: (error: EdgeError) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
