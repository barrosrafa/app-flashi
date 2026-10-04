'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { listDecks, type Deck } from '../../lib/services/deck-service';
import { searchNotes, type SearchMode, type SearchResponse } from '../../lib/services/search-service';
import { createIngestionJob, listIngestionJobs, type IngestionJob, type IngestionSource } from '../../lib/services/ingestion-service';
import { getFsrsOptimizationStatus, listFsrsOptimizationRuns, requestFsrsOptimization, type OptimizationRun } from '../../lib/services/optimizer-service';
import { exportAnkiPackage, importAnkiPackage } from '../../lib/services/anki-service';
import { isEnabled } from '../../lib/config/feature-flags';

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
  const [busy, setBusy] = useState<'search' | 'ingestion' | 'optimization' | 'import' | 'export' | null>(null);

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
    setBusy('search');
    setSearchMessage('Buscando nas suas notas…');
    try {
      const result = await searchNotes(String(form.get('query') ?? ''), String(form.get('mode') ?? 'semantic') as SearchMode);
      setSearch(result);
      setSearchMessage(`${result.results.length} resultado(s) em modo ${result.mode}.`);
    } catch (reason: unknown) {
      setSearchMessage(reason instanceof Error ? reason.message : 'Não foi possível buscar.');
    } finally {
      setBusy(null);
    }
  }

  async function submitIngestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy('ingestion');
    setMessage('Criando job de ingestão…');
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
    } finally {
      setBusy(null);
    }
  }

  async function optimize() {
    setBusy('optimization');
    setMessage('Solicitando otimização personalizada…');
    try {
      const result = await requestFsrsOptimization();
      setMessage(`Otimização solicitada: ${result.run_id}.`);
      setOptimizationStatus(JSON.stringify(await getFsrsOptimizationStatus(), null, 2));
      setOptimizationRuns(await listFsrsOptimizationRuns());
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível solicitar otimização.');
    } finally {
      setBusy(null);
    }
  }

  async function importAnki(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy('import');
    setMessage(`Enviando ${file.name}…`);
    try {
      const result = await importAnkiPackage(file);
      setMessage(`Importação enviada: ${result.job_id}.`);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível importar o pacote.');
    } finally {
      setBusy(null);
      event.target.value = '';
    }
  }

  async function exportAnki(deckId: string) {
    setBusy('export');
    setMessage('Preparando exportação…');
    try {
      const result = await exportAnkiPackage(deckId);
      window.open(result.signed_url, '_blank', 'noopener,noreferrer');
      setMessage(`Exportação pronta: ${result.total_cards} cards.`);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível exportar o deck.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <Topbar title="Ferramentas avançadas" subtitle="Use uma ferramenta por vez; cada ação mostra o que aconteceu e o próximo estado." />
      {message && <div className="notice" role="status" aria-live="polite">{message}</div>}
      <div className="grid tool-grid">
        {isEnabled('semantic') && <section className="card tool-card" aria-labelledby="search-title">
          <div className="eyebrow">Encontrar conteúdo</div><h2 id="search-title">Buscar nas suas notas</h2><p className="subtitle">Encontre conceitos sem sair do seu fluxo de estudo.</p>
          <form className="form" onSubmit={submitSearch}>
            <div className="field"><label htmlFor="query">O que você procura?</label><input id="query" name="query" required maxLength={8000} placeholder="Ex.: sincronização offline" /></div>
            <div className="field"><label htmlFor="mode">Tipo de busca</label><select id="mode" name="mode" defaultValue="semantic"><option value="semantic">Semântica — por significado</option><option value="lexical">Literal — por palavras</option></select></div>
            <button className="btn" type="submit" disabled={busy !== null}>{busy === 'search' ? 'Buscando…' : 'Buscar notas'}</button>
          </form>
          {searchMessage && <p className="status-text" role="status">{searchMessage}</p>}
          {search?.results.length ? <div className="result-list" aria-label="Resultados da busca">{search.results.map((result) => <div className="result-item" key={result.note_id}><strong>{Math.round(result.similarity * 100)}%</strong> · {result.match_type}<br />{textFields(result.fields)}</div>)}</div> : null}
        </section>}

        {isEnabled('ai_ingest') && <section className="card tool-card" aria-labelledby="ingestion-title">
          <div className="eyebrow">Transformar fonte</div><h2 id="ingestion-title">Criar job de fonte</h2><p className="subtitle">Envie texto, uma página ou um vídeo para um deck.</p>
          <form className="form" onSubmit={submitIngestion}>
            <div className="field"><label htmlFor="ingest-deck">Deck de destino</label><select id="ingest-deck" name="deck_id" required defaultValue="" disabled={!decks.length}>{decks.length ? <><option value="" disabled>Selecione um deck</option>{decks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}</> : <option value="">Nenhum deck disponível</option>}</select></div>
            <div className="field"><label htmlFor="source-type">Tipo de fonte</label><select id="source-type" name="source_type" defaultValue="raw_text_block">{ingestionSources.map((source) => <option value={source} key={source}>{source.replaceAll('_', ' ')}</option>)}</select></div>
            <div className="field"><label htmlFor="content">Conteúdo ou referência</label><textarea id="content" name="content" maxLength={2000} placeholder="Cole um texto, URL ou referência validada pelo backend" /></div>
            <button className="btn" type="submit" disabled={!decks.length || busy !== null}>{busy === 'ingestion' ? 'Criando job…' : 'Criar job de fonte'}</button>
          </form>
          <p className="status-text">{ingestionJobs.length} job(s) visível(is) para sua conta.</p>
        </section>}

        {isEnabled('fsrs_opt') && <section className="card tool-card" aria-labelledby="fsrs-title">
          <div className="eyebrow">Personalizar revisão</div><h2 id="fsrs-title">Otimização personalizada</h2><p className="subtitle">Ajuste o modelo FSRS usando seu histórico de respostas. O processamento acontece em segundo plano.</p>
          <button className="btn" type="button" onClick={() => void optimize()} disabled={busy !== null}>{busy === 'optimization' ? 'Solicitando…' : 'Solicitar otimização'}</button>
          <p className="status-text">{optimizationRuns.length} execução(ões) registrada(s).</p>
          {optimizationStatus && <pre aria-label="Status da otimização">{optimizationStatus}</pre>}
        </section>}

        {isEnabled('anki_io') && <section className="card tool-card" aria-labelledby="anki-title">
          <div className="eyebrow">Migrar conteúdo</div><h2 id="anki-title">Importar ou exportar Anki</h2><p className="subtitle">Use arquivos `.apkg` para trazer ou levar seus decks.</p>
          <label className="btn secondary" htmlFor="anki-file">{busy === 'import' ? 'Enviando pacote…' : 'Selecionar pacote .apkg'}<input id="anki-file" type="file" accept=".apkg" hidden onChange={importAnki} disabled={busy !== null} /></label>
          <div className="export-list" aria-label="Decks para exportar">{decks.map((deck) => <button className="btn ghost" type="button" style={{ marginTop: 8, width: '100%' }} key={deck.id} onClick={() => void exportAnki(deck.id)} disabled={busy !== null}>Exportar {deck.name}</button>)}</div>
          {!decks.length && <p className="status-text">Crie um deck para habilitar a exportação.</p>}
        </section>}
      </div>
    </AppShell>
  );
}
