import { safeProperties } from '../observability/privacy';
export type TelemetryEvent = 'sync.success' | 'sync.failure' | 'outbox.enqueued' | 'outbox.failure' | 'outbox.flushed';
export type TelemetryRecord = { event: TelemetryEvent; at: string; details: Record<string, unknown> };
const KEY = 'flashi.telemetry';
export function recordTelemetry(event: TelemetryEvent, details: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  try {
    const current = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as TelemetryRecord[];
    current.push({ event, at: new Date().toISOString(), details:safeProperties(details) });
    window.localStorage.setItem(KEY, JSON.stringify(current.slice(-100)));
  } catch { /* Telemetria nunca pode bloquear o fluxo offline-first. */ }
}
export function readTelemetry(): TelemetryRecord[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as TelemetryRecord[]; } catch { return []; }
}
