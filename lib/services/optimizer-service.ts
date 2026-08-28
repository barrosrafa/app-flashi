import { createClient, type Tables } from '../supabase/client';
import type { Database } from '../../src/types/database';
import { invokeUserFunction } from './edge-service';

export type OptimizationRun = Tables<'fsrs_optimization_runs'>;
export type OptimizationRequest = { mode: 'request' | 'run'; run_id?: string };

export async function requestFsrsOptimization() {
  return invokeUserFunction<{ run_id: string; status: string }>('fsrs-optimize', {
    mode: 'request',
  });
}

export async function runFsrsOptimization(runId: string) {
  if (!runId) throw new Error('RUN_ID_REQUIRED');
  return invokeUserFunction<{ run_id: string; status: string }>('fsrs-optimize', {
    mode: 'run',
    run_id: runId,
  });
}

export async function getFsrsOptimizationStatus() {
  const { data, error } = await createClient().rpc('get_fsrs_optimization_status');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function listFsrsOptimizationRuns() {
  const { data, error } = await createClient()
    .from('fsrs_optimization_runs')
    .select('id,user_id,status,requested_at,started_at,completed_at,error_message,source_review_count,old_loss,new_loss,old_weights,new_weights,usn')
    .order('requested_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export type OptimizationStatus =
  Database['public']['Functions']['get_fsrs_optimization_status']['Returns'][number];
