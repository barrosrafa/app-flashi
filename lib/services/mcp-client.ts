import { createClient, type Json } from '../supabase/client';
import { searchNotes, type SearchResponse } from './search-service';

export type McpTool = { name: string; description: string; parameters: Record<string, unknown> };
export type McpRequest = { jsonrpc: '2.0'; id: string; method: 'tools/list' | 'tools/call'; params?: { name?: string; arguments?: Record<string, unknown> } };
export type McpResponse<T = unknown> = { jsonrpc: '2.0'; id: string; result?: T; error?: { code: number; message: string } };

type ExternalJsonRpcResponse = {
  jsonrpc?: unknown;
  id?: unknown;
  result?: unknown;
  error?: unknown;
};

export const INTERNAL_MCP_TOOLS: McpTool[] = [
  { name: 'search_notes', description: 'Busca notas do utilizador por texto ou similaridade semântica.', parameters: { query: 'string', limit: 'number', mode: 'semantic | lexical' } },
  { name: 'create_note', description: 'Cria uma nota e os seus cartões de forma transacional.', parameters: { deck_id: 'string', fields: 'object', card_definitions: 'array', template_id: 'string?' } },
];

const MCP_PROTOCOL_VERSION = '2025-06-18';
const MAX_ENDPOINT_LENGTH = 2048;
const MAX_RESPONSE_BYTES = 1_000_000;
const DEFAULT_TIMEOUT_MS = 8_000;

function requestId() { return crypto.randomUUID(); }

function safeError(code: string) { return new Error(code); }

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 192 && b === 0 || a === 192 && b === 2 || a === 198 && (b === 18 || b === 19 || b === 51) || a === 203 && b === 0 || a >= 224;
}

function isPrivateIpv6(hostname: string) {
  const value = hostname.toLowerCase();
  return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:') || value.startsWith('::ffff:');
}

/** Validate an external MCP URL before the browser ever sends credentials. */
export function validateMcpEndpoint(endpoint: string): URL {
  if (!endpoint.trim() || endpoint.length > MAX_ENDPOINT_LENGTH) throw safeError('MCP_ENDPOINT_REQUIRED');
  let url: URL;
  try { url = new URL(endpoint); } catch { throw safeError('MCP_ENDPOINT_INVALID'); }
  if (url.protocol !== 'https:') throw safeError('MCP_ENDPOINT_HTTPS_REQUIRED');
  if (url.username || url.password) throw safeError('MCP_ENDPOINT_CREDENTIALS_IN_URL');
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.home.arpa') || isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) throw safeError('MCP_ENDPOINT_PRIVATE_HOST');
  url.username = '';
  url.password = '';
  return url;
}

function parseTool(value: unknown): McpTool | null {
  if (!value || typeof value !== 'object') return null;
  const tool = value as Record<string, unknown>;
  if (typeof tool.name !== 'string' || !tool.name || tool.name.length > 200) return null;
  const schema = tool.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema as Record<string, unknown> : {};
  return { name: tool.name, description: typeof tool.description === 'string' ? tool.description : '', parameters: schema };
}

function parseTools(result: unknown): McpTool[] {
  if (!result || typeof result !== 'object' || !Array.isArray((result as { tools?: unknown }).tools)) throw safeError('MCP_EXTERNAL_TOOLS_INVALID');
  return (result as { tools: unknown[] }).tools.map(parseTool).filter((tool): tool is McpTool => tool !== null);
}

export class McpExternalClient {
  private readonly endpoint: URL;
  private readonly token: string;
  private readonly timeoutMs: number;
  private sessionId: string | null = null;

  constructor(endpoint: string, token: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.endpoint = validateMcpEndpoint(endpoint);
    this.token = token.trim();
    this.timeoutMs = Math.min(Math.max(timeoutMs, 1_000), 15_000);
    if (!this.token) throw safeError('MCP_TOKEN_REQUIRED');
    if (this.token.length > 4_096) throw safeError('MCP_TOKEN_INVALID');
  }

  private async request(method: string, params?: Record<string, unknown>, notification = false): Promise<unknown> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
    const id = notification ? undefined : requestId();
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          authorization: `Bearer ${this.token}`,
          ...(this.sessionId ? { 'mcp-session-id': this.sessionId } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw safeError('MCP_EXTERNAL_HTTP_ERROR');
      const responseSessionId = response.headers.get('mcp-session-id');
      if (responseSessionId) this.sessionId = responseSessionId;
      if (notification && (response.status === 202 || response.status === 204)) return undefined;
      const contentLength = Number(response.headers.get('content-length') ?? '0');
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) throw safeError('MCP_EXTERNAL_RESPONSE_TOO_LARGE');
      const text = await response.text();
      if (!text.trim()) {
        if (notification) return undefined;
        throw safeError('MCP_EXTERNAL_RESPONSE_INVALID');
      }
      if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw safeError('MCP_EXTERNAL_RESPONSE_TOO_LARGE');
      let payload: ExternalJsonRpcResponse;
      const contentType = response.headers.get('content-type') ?? '';
      const jsonText = contentType.includes('text/event-stream')
        ? (() => { const events = text.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).filter((line) => line && line !== '[DONE]'); return events[events.length - 1] ?? ''; })()
        : text;
      try { payload = JSON.parse(jsonText) as ExternalJsonRpcResponse; } catch { throw safeError('MCP_EXTERNAL_RESPONSE_INVALID'); }
      if (payload.error) throw safeError('MCP_EXTERNAL_REMOTE_ERROR');
      if (payload.jsonrpc !== '2.0' || (!notification && payload.id !== id)) throw safeError('MCP_EXTERNAL_RESPONSE_INVALID');
      return payload.result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw safeError('MCP_EXTERNAL_TIMEOUT');
      if (error instanceof Error && error.message.startsWith('MCP_')) throw error;
      throw safeError('MCP_EXTERNAL_NETWORK_ERROR');
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  async initialize(): Promise<unknown> {
    return this.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'flashi', version: '1.0.0' },
    });
  }

  async listTools(): Promise<McpTool[]> {
    await this.initialize();
    await this.request('notifications/initialized', undefined, true);
    const result = await this.request('tools/list', {});
    return parseTools(result);
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!name.trim() || name.length > 200) throw safeError('MCP_EXTERNAL_TOOL_INVALID');
    await this.initialize();
    await this.request('notifications/initialized', undefined, true);
    return this.request('tools/call', { name, arguments: args });
  }
}

export const mcpClient = {
  listTools(): McpTool[] { return INTERNAL_MCP_TOOLS; },
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const supabase = createClient();
    if (name === 'search_notes') return searchNotes(String(args.query ?? ''), args.mode === 'lexical' ? 'lexical' : 'semantic', Number(args.limit ?? 20));
    if (name === 'create_note') {
      const fields = args.fields;
      if (!args.deck_id || !fields || typeof fields !== 'object') throw safeError('MCP_CREATE_NOTE_INPUT_REQUIRED');
      const { data, error } = await supabase.rpc('mcp_create_note', { p_deck_id: String(args.deck_id), p_fields: fields as Json, p_template_id: args.template_id ? String(args.template_id) : undefined, p_card_definitions: (args.card_definitions ?? []) as Json, p_source: 'mcp', p_request_id: requestId() });
      if (error) throw error;
      return data;
    }
    throw safeError(`MCP_UNKNOWN_TOOL:${name}`);
  },
  async handle(request: McpRequest): Promise<McpResponse> {
    try {
      if (request.method === 'tools/list') return { jsonrpc: '2.0', id: request.id, result: { tools: INTERNAL_MCP_TOOLS } };
      const name = request.params?.name;
      if (!name) throw safeError('MCP_TOOL_REQUIRED');
      const result = await this.callTool(name, request.params?.arguments ?? {});
      return { jsonrpc: '2.0', id: request.id, result };
    } catch (error) {
      return { jsonrpc: '2.0', id: request.id, error: { code: -32000, message: error instanceof Error ? error.message : 'MCP_ERROR' } };
    }
  },
};

export async function mcpSearchNotes(query: string, limit = 20): Promise<SearchResponse> { return searchNotes(query, 'semantic', limit); }
