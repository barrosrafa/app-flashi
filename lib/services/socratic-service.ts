import { createClient } from '../supabase/client';
import type { SocraticSession, SocraticStatus } from '../types/socratic';
import { hasBrowserSession } from '../supabase/guards';
export const socraticService = {
  async list(): Promise<SocraticSession[]> { if (!(await hasBrowserSession())) throw new Error('AUTH_REQUIRED'); const { data, error } = await createClient().from('socratic_remediation_sessions').select('*').order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as SocraticSession[]; },
  async get(id: string): Promise<SocraticSession | null> { if (!(await hasBrowserSession())) throw new Error('AUTH_REQUIRED'); const { data, error } = await createClient().from('socratic_remediation_sessions').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data as SocraticSession | null; },
  async updateStatus(id: string, status: SocraticStatus) { const { error } = await createClient().from('socratic_remediation_sessions').update({ status, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; },
  async resolve(id: string): Promise<SocraticSession> { const { data, error } = await createClient().rpc('resolve_socratic_remediation', { p_session_id: id }); if (error) throw error; return data as SocraticSession; },
};
