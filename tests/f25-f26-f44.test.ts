import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpExternalClient, mcpClient, validateMcpEndpoint } from '../lib/services/mcp-client';

const collaborationUi = readFileSync(resolve(process.cwd(), 'components/decks/CollaboratorManager.tsx'), 'utf8');
const collaborationService = readFileSync(resolve(process.cwd(), 'lib/services/collaborator-service.ts'), 'utf8');

describe('F25/F44 colaboração segura', () => {
  it('coleta email/nome/contexto e usa convite pendente sem solicitar UUID', () => {
    expect(collaborationUi).toContain('collaborator-email');
    expect(collaborationUi).toContain('collaborator-name');
    expect(collaborationUi).toContain('collaborator-context');
    expect(collaborationUi).toContain('Nenhum email foi enviado');
    expect(collaborationUi).not.toContain('UUID do usuário');
    expect(collaborationService).toContain("create_deck_collaboration_invite");
    expect(collaborationService).not.toContain(".upsert({ deck_id: deckId, user_id");
  });
});

describe('F26 MCP externo', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    'http://public.example/mcp',
    'https://localhost/mcp',
    'https://127.0.0.1/mcp',
    'https://192.168.1.10/mcp',
    'https://[::1]/mcp',
    'https://user:password@public.example/mcp',
  ])('rejeita endpoint não seguro: %s', (endpoint) => {
    expect(() => validateMcpEndpoint(endpoint)).toThrow(/^MCP_ENDPOINT_/);
  });

  it('executa initialize, handshake e tools/list usando o token apenas no header', async () => {
    const calls: Array<{ method: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      calls.push({ method: String(body.method), headers, body });
      if (body.method === 'notifications/initialized') return new Response(null, { status: 204 });
      const result = body.method === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: {} } : { tools: [{ name: 'remote_search', description: 'Remote search', inputSchema: { type: 'object' } }] };
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { headers: { 'content-type': 'application/json' } });
    }));

    const tools = await new McpExternalClient('https://mcp.example.test/mcp', 'secret-token').listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['remote_search']);
    expect(calls.map((call) => call.method)).toEqual(['initialize', 'notifications/initialized', 'tools/list']);
    expect(calls[0].headers.authorization).toBe('Bearer secret-token');
    expect(calls[1].body).not.toHaveProperty('id');
  });

  it('não repassa corpo sensível do servidor em erros HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ secret: 'do-not-expose' }), { status: 502 })));
    await expect(new McpExternalClient('https://mcp.example.test/mcp', 'secret-token').listTools()).rejects.toThrow('MCP_EXTERNAL_HTTP_ERROR');
  });

  it('mantém ferramentas internas separadas do catálogo externo', () => {
    expect(mcpClient.listTools().map((tool) => tool.name)).toEqual(['search_notes', 'create_note']);
  });
});
