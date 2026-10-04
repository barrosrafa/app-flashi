import { createClient, type Tables } from '../supabase/client';
import { hasBrowserSession } from '../supabase/guards';
export type McpAudit = Tables<'mcp_tool_audit'>;
export async function listMcpAudit(limit = 50): Promise<McpAudit[]> { if (!(await hasBrowserSession())) throw new Error('AUTH_REQUIRED'); const { data, error } = await createClient().from('mcp_tool_audit').select('*').order('created_at', { ascending: false }).limit(limit); if (error) throw error; return data ?? []; }
