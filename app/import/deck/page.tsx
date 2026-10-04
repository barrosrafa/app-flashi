'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { ImportJobMonitor } from '../../../components/ImportJobMonitor';
import { importDeckService, type ImportFormat } from '../../../lib/services/import-deck-service';
import { listDecks, type Deck } from '../../../lib/services/deck-service';

const formats: ImportFormat[] = ['csv', 'markdown', 'quizlet', 'remnote'];

export default function ImportDeckPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState('');
  const [format, setFormat] = useState<ImportFormat>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [resultDeckId, setResultDeckId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listDecks().then((rows) => {
      setDecks(rows);
      setDeckId(rows[0]?.id ?? '');
    }).catch(() => setMessage('Entre na sua conta para importar decks.'));
  }, []);

  async function importFile() {
    if (!file || !deckId) return;
    setBusy(true);
    setMessage('Enviando lote para materialização…');
    setResultDeckId('');
    try {
      const result = await importDeckService.fromFile({ file, deckId, format });
      setMessage(`${result.notes_count} notas e ${result.cards_count} cards importados.`);
      setResultDeckId(deckId);
      setFile(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar o arquivo.');
    } finally {
      setBusy(false);
    }
  }

  async function importUrl() {
    if (!url || !deckId) return;
    setBusy(true);
    setMessage('Baixando URL e validando o conteúdo…');
    setResultDeckId('');
    try {
      const result = await importDeckService.fromUrl({ url, deckId, format });
      setMessage(`${result.notes_count} notas e ${result.cards_count} cards importados.`);
      setResultDeckId(deckId);
      setUrl('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar a URL.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <Topbar title="Importar deck" subtitle="Traga conteúdo de CSV, Markdown, Quizlet, RemNote ou URL; o backend valida e materializa cada lote." />
      {message && <div className="notice" role="status">{message}</div>}
      {resultDeckId && <a className="link-button" href={`/decks/${resultDeckId}/cards`}>Ver cartões importados no deck</a>}
      <div className="grid tool-grid">
        <section className="card tool-card">
          <div className="eyebrow">Arquivo</div><h2>Importar pacote</h2>
          <p className="subtitle">Limite de 15 MiB. O arquivo fica no bucket privado do usuário e é removido se o processamento falhar.</p>
          <div className="form">
            <div className="field"><label htmlFor="import-deck">Deck de destino</label><select id="import-deck" value={deckId} onChange={(event) => setDeckId(event.target.value)} disabled={!decks.length}>{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></div>
            <div className="field"><label htmlFor="import-format">Formato</label><select id="import-format" value={format} onChange={(event) => setFormat(event.target.value as ImportFormat)}>{formats.map((item) => <option value={item} key={item}>{item.toUpperCase()}</option>)}</select></div>
            <div className="field"><label htmlFor="import-file">Arquivo</label><input id="import-file" type="file" accept=".csv,.md,.markdown,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
            <button className="btn" type="button" onClick={() => void importFile()} disabled={!file || !deckId || busy}>{busy ? 'Importando…' : 'Importar arquivo'}</button>
          </div>
        </section>
        <section className="card tool-card">
          <div className="eyebrow">URL</div><h2>Importar por URL</h2>
          <p className="subtitle">O backend baixa a URL HTTPS diretamente, evitando CORS e limitando o tamanho e os destinos permitidos.</p>
          <div className="form">
            <div className="field"><label htmlFor="url-deck">Deck de destino</label><select id="url-deck" value={deckId} onChange={(event) => setDeckId(event.target.value)}>{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></div>
            <div className="field"><label htmlFor="url-format">Formato</label><select id="url-format" value={format} onChange={(event) => setFormat(event.target.value as ImportFormat)}>{formats.map((item) => <option value={item} key={item}>{item.toUpperCase()}</option>)}</select></div>
            <div className="field"><label htmlFor="source-url">URL HTTPS</label><input id="source-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://exemplo.com/conteudo.csv" /></div>
            <button className="btn secondary" type="button" onClick={() => void importUrl()} disabled={!url || !deckId || busy}>{busy ? 'Importando…' : 'Importar URL'}</button>
          </div>
        </section>
      </div>
      <ImportJobMonitor />
    </AppShell>
  );
}
