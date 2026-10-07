'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { isEnabled } from '../../../lib/config/feature-flags';
import { McpExternalClient, mcpClient, type McpTool } from '../../../lib/services/mcp-client';
import { listMcpAudit, type McpAudit } from '../../../lib/services/mcp-audit-service';
import { listDecks, type Deck } from '../../../lib/services/deck-service';

function safeMcpMessage(error: unknown) {
  return error instanceof Error && error.message.startsWith('MCP_') ? error.message : 'MCP_EXTERNAL_ERROR';
}

export default function McpToolsPage() {
  const [internalTools] = useState<McpTool[]>(() => mcpClient.listTools());
  const [externalTools, setExternalTools] = useState<McpTool[]>([]);
  const [audit, setAudit] = useState<McpAudit[]>([]);
  const [selected, setSelected] = useState('search_notes');
  const [query, setQuery] = useState('');
  const [deckId, setDeckId] = useState('');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [limit, setLimit] = useState('10');
  const [result, setResult] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [externalStatus, setExternalStatus] = useState('');

  useEffect(() => { void listMcpAudit().then(setAudit).catch(() => undefined); void listDecks().then(setDecks).catch(() => undefined); }, []);
  if (!isEnabled('mcp')) return <AppShell><Topbar title="Ferramentas MCP" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;

  async function connectExternal() {
    setBusy(true);
    setResult('');
    setExternalStatus('');
    try {
      const client = new McpExternalClient(endpoint, token);
      const tools = await client.listTools();
      setExternalTools(tools);
      setExternalStatus(`Handshake concluído; ${tools.length} ferramenta(s) recebida(s) por tools/list.`);
      setResult(JSON.stringify({ endpointConfigured: true, tokenConfigured: true, toolCount: tools.length, tools: tools.map((tool) => tool.name) }, null, 2));
    } catch (error) {
      setExternalTools([]);
      setExternalStatus(safeMcpMessage(error));
      setResult(JSON.stringify({ error: safeMcpMessage(error) }, null, 2));
    } finally {
      setBusy(false);
    }
  }

  async function callInternal() {
    setBusy(true);
    setResult('');
    try {
      const value = await mcpClient.callTool(selected, selected === 'search_notes' ? { query, limit: Number(limit), mode: 'lexical' } : { deck_id: deckId, fields: { Front: front, Back: back }, card_definitions: [{ card_kind: 'basic', front, back }] });
      setResult(JSON.stringify(value, null, 2));
      setAudit(await listMcpAudit());
    } catch (error) {
      setResult(JSON.stringify({ error: error instanceof Error ? error.message : 'MCP_ERROR' }, null, 2));
    } finally {
      setBusy(false);
    }
  }

  return <AppShell>
    <Topbar title="Ferramentas MCP" subtitle="Ferramentas internas Flashi e conexão separada com um servidor MCP externo." />
    <section className="card form">
      <h2>Servidor MCP externo</h2>
      <p className="subtitle">A conexão executa initialize, notifications/initialized e tools/list de verdade. Endpoint e token ficam apenas nesta sessão.</p>
      <label htmlFor="mcp-endpoint">Endpoint HTTPS</label><input id="mcp-endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://mcp.exemplo.com/mcp" autoComplete="off" />
      <label htmlFor="mcp-token">Token (não persistido)</label><input id="mcp-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token do servidor externo" autoComplete="new-password" />
      <button className="btn secondary" type="button" onClick={() => void connectExternal()} disabled={busy || !endpoint.trim() || !token.trim()}>{busy ? 'Conectando…' : 'Conectar e listar tools'}</button>
      {externalStatus && <p className="notice" role="status">{externalStatus}</p>}
      {externalTools.length > 0 && <div><h3>Tools anunciadas pelo servidor externo</h3><ul>{externalTools.map((tool) => <li key={tool.name}><strong>{tool.name}</strong>{tool.description ? ` — ${tool.description}` : ''}</li>)}</ul></div>}
    </section>
    <section className="card form">
      <h2>Ferramentas internas Flashi</h2>
      <p className="subtitle">Estas ferramentas usam a sessão Flashi e não são o servidor MCP externo acima.</p>
      <label htmlFor="mcp-tool">Ferramenta</label><select id="mcp-tool" value={selected} onChange={(e) => setSelected(e.target.value)}>{internalTools.map((tool) => <option key={tool.name} value={tool.name}>{tool.name}</option>)}</select>
      {selected === 'search_notes' && <><label htmlFor="mcp-query">Consulta</label><input id="mcp-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Termo de pesquisa" /><label htmlFor="mcp-limit">Limite</label><input id="mcp-limit" type="number" min="1" max="100" value={limit} onChange={(e) => setLimit(e.target.value)} /></>}
      {selected === 'create_note' && <><label htmlFor="mcp-deck">Deck de destino</label><select id="mcp-deck" value={deckId} onChange={(e) => setDeckId(e.target.value)}><option value="">Selecione um deck</option>{decks.map((deck)=><option data-user-content="" key={deck.id} value={deck.id}>{deck.name}</option>)}</select><label htmlFor="mcp-front">Frente</label><input id="mcp-front" value={front} onChange={(e) => setFront(e.target.value)} /><label htmlFor="mcp-back">Verso</label><textarea id="mcp-back" value={back} onChange={(e) => setBack(e.target.value)} /></>}
      <button className="btn" type="button" onClick={() => void callInternal()} disabled={busy || (selected === 'search_notes' ? query.trim().length < 1 : !deckId || !front.trim() || !back.trim())}>{busy ? 'A executar…' : 'Executar ferramenta interna'}</button>
      <pre aria-live="polite">{result}</pre>
    </section>
    <section className="card"><div className="section-head"><div><h2>Auditoria MCP interna</h2><p className="subtitle">Chamadas recentes registradas pelo backend para esta conta; token e payload não são registrados.</p></div><button className="btn ghost" type="button" onClick={() => void listMcpAudit().then(setAudit)}>Atualizar</button></div>{!audit.length ? <p className="muted">Nenhuma chamada registrada.</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Ferramenta</th><th>Resultados</th><th>Data</th><th>Request</th></tr></thead><tbody>{audit.map((item) => <tr key={item.id}><td>{item.tool_name}</td><td>{item.result_count ?? '—'}</td><td>{new Date(item.created_at).toLocaleString('pt-BR')}</td><td>{item.request_id ?? '—'}</td></tr>)}</tbody></table></div>}</section>
  </AppShell>;
}
