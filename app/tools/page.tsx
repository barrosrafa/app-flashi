'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { listDecks, type Deck } from '../../lib/services/deck-service';
import { searchNotes, type SearchMode, type SearchResponse } from '../../lib/services/search-service';
import { createIngestionJob, listIngestionJobs, type IngestionJob, type IngestionSource } from '../../lib/services/ingestion-service';
import { getFsrsOptimizationStatus, listFsrsOptimizationRuns, requestFsrsOptimization, type OptimizationRun } from '../../lib/services/optimizer-service';
import { exportAnkiPackage, importAnkiPackage } from '../../lib/services/anki-service';

const ingestionSources: IngestionSource[] = ['raw_text_block', 'web_page', 'youtube_url', 'pdf_document'];

function textFields(value: SearchResponse['results'][number]['fields']) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).filter((item): item is string => typeof item === 'string').join(' · ');
  }
  return String(value ?? '');
}

export default function Tools() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [search, setSearch] = useState<SearchResponse | null>(null);
  const [searchMessage, setSearchMessage] = useState('');
  const [ingestionJobs, setIngestionJobs] = useState<IngestionJob[]>([]);
  const [optimizationRuns, setOptimizationRuns] = useState<OptimizationRun[]>([]);
  const [optimizationStatus, setOptimizationStatus] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([listDecks(), listIngestionJobs(), listFsrsOptimizationRuns()])
      .then(([deckRows, jobs, runs]) => {
        setDecks(deckRows);
        setIngestionJobs(jobs);
        setOptimizationRuns(runs);
      })
      .catch(() => setMessage('Entre na sua conta para usar as ferramentas avançadas.'));
  }, []);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSearchMessage('Buscando…');
    try {
      const result = await searchNotes(String(form.get('query') ?? ''), String(form.get('mode') ?? 'semantic') as SearchMode);
      setSearch(result);
      setSearchMessage(`${result.results.length} resultado(s) em modo ${result.mode}.`);
    } catch (reason: unknown) {
      setSearchMessage(reason instanceof Error ? reason.message : 'Não foi possível buscar.');
    }
  }

  async function submitIngestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const job = await createIngestionJob({
        deckId: String(form.get('deck_id') ?? ''),
        sourceType: String(form.get('source_type') ?? '') as IngestionSource,
        content: String(form.get('content') ?? '').trim() || undefined,
        storagePath: String(form.get('storage_path') ?? '').trim() || undefined,
      });
      setMessage(`Job de ingestão criado: ${job.job_id ?? 'aguardando processamento'}.`);
      setIngestionJobs(await listIngestionJobs());
      event.currentTarget.reset();
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível criar o job.');
    }
  }

  async function optimize() {
    try {
      const result = await requestFsrsOptimization();
      setMessage(`Otimização solicitada: ${result.run_id}.`);
      setOptimizationStatus(JSON.stringify(await getFsrsOptimizationStatus()));
      setOptimizationRuns(await listFsrsOptimizationRuns());
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível solicitar otimização.');
    }
  }

  async function importAnki(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await importAnkiPackage(file);
      setMessage(`Importação enviada: ${result.job_id}.`);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível importar o pacote.');
    }
  }

  async function exportAnki(deckId: string) {
    try {
      const result = await exportAnkiPackage(deckId);
      window.open(result.signed_url, '_blank', 'noopener,noreferrer');
      setMessage(`Exportação pronta: ${result.total_cards} cards.`);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível exportar o deck.');
    }
  }

  return <AppShell>
    <Topbar title="Ferramentas avançadas" subtitle="Integrações reais do backend Flashi, com jobs e fallbacks explícitos." />
    {message && <div className="notice" role="status">{message}</div>}
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 }}>
      <section className="card"><div className="eyebrow">Busca</div><h2>Buscar nas suas notas</h2><form className="form" onSubmit={submitSearch}><div className="field"><label htmlFor="query">Consulta</label><input id="query" name="query" required maxLength={8000} placeholder="Ex.: sincronização offline" /></div><div className="field"><label htmlFor="mode">Modo</label><select id="mode" name="mode" defaultValue="semantic"><option value="semantic">Semântico</option><option value="lexical">Lexical</option></select></div><button className="btn" type="submit">Buscar</button></form>{searchMessage && <p className="subtitle">{searchMessage}</p>}{search?.results.map((result) => <div className="notice" key={result.note_id}><strong>{Math.round(result.similarity * 100)}%</strong> · {result.match_type}<br />{textFields(result.fields)}</div>)}</section>
      <section className="card"><div className="eyebrow">Ingestão por IA</div><h2>Criar job de fonte</h2><form className="form" onSubmit={submitIngestion}><div className="field"><label htmlFor="ingest-deck">Deck</label><select id="ingest-deck" name="deck_id" required defaultValue="">{decks.length ? <><option value="" disabled>Selecione um deck</option>{decks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}</> : <option value="">Nenhum deck</option>}</select></div><div className="field"><label htmlFor="source-type">Tipo de fonte</label><select id="source-type" name="source_type" defaultValue="raw_text_block">{ingestionSources.map((source) => <option value={source} key={source}>{source}</option>)}</select></div><div className="field"><label htmlFor="content">Conteúdo ou referência</label><textarea id="content" name="content" maxLength={2000} placeholder="Texto, URL ou referência validada pelo backend" /></div><button className="btn" type="submit" disabled={!decks.length}>Criar job queued</button></form><p className="subtitle">{ingestionJobs.length} job(s) visível(is) para sua conta.</p></section>
      <section className="card"><div className="eyebrow">FSRS</div><h2>Otimização personalizada</h2><p className="subtitle">Solicite a execução do job publicado; o worker agendado processa a fila com credencial de serviço.</p><button className="btn" onClick={() => void optimize}>Solicitar otimização</button><p className="subtitle">{optimizationRuns.length} execução(ões) registrada(s).</p>{optimizationStatus && <pre style={{ whiteSpace: 'pre-wrap' }}>{optimizationStatus}</pre>}</section>
      <section className="card"><div className="eyebrow">Anki</div><h2>Importar ou exportar `.apkg`</h2><label className="btn secondary" htmlFor="anki-file">Selecionar pacote<input id="anki-file" type="file" accept=".apkg" hidden onChange={importAnki} /></label>{decks.map((deck) => <button className="btn ghost" style={{ marginTop: 8, width: '100%' }} key={deck.id} onClick={() => void exportAnki(deck.id)}>Exportar {deck.name}</button>)}</section>
    </div>
  </AppShell>;
}
