import { createClient, type Tables } from '../supabase/client';
import { invokeEdge } from './http/edge-client';
export type OptimizationRun = Tables<'fsrs_optimization_runs'>;
export type RunState = 'queued' | 'running' | 'completed' | 'failed';
export type OptimizationStatus = { run_id?: string; state?: RunState; status?: string; weights?: number[]; error?: string; updated_at?: string };
export const optimizerService = { request(deckId?: string) { return invokeEdge<{ run_id: string; status: string }>('fsrs-optimize', { body: { mode: 'request', deck_id: deckId ?? null } }); }, async status(runId: string) { if (!runId) throw new Error('RUN_ID_REQUIRED'); const { data, error } = await createClient().from('fsrs_optimization_runs').select('*').eq('id', runId).maybeSingle(); if (error) throw error; return data as OptimizationStatus | null; }, run(runId: string) { return invokeEdge<{ run_id: string; status: string }>('fsrs-optimize', { body: { mode: 'run', run_id: runId } }); } };
export async function requestFsrsOptimization() { return optimizerService.request(); }
export async function runFsrsOptimization(runId: string) { return optimizerService.run(runId); }
export async function getFsrsOptimizationStatus() { const { data, error } = await createClient().rpc('get_fsrs_optimization_status'); if (error) throw error; return data?.[0] ?? null; }
export async function listFsrsOptimizationRuns() { const { data, error } = await createClient().from('fsrs_optimization_runs').select('*').order('requested_at', { ascending: false }).limit(20); if (error) throw error; return data; }
