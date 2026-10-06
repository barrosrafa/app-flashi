'use client';

import { useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { isEnabled } from '../../../lib/config/feature-flags';
import { importDeckService, type ImportFormat, type ImportDeckResult } from '../../../lib/services/import-deck-service';

const formats: ImportFormat[] = ['csv', 'markdown', 'quizlet', 'remnote'];
function importErrorMessage(reason: unknown) {
  const code = reason instanceof Error ? reason.message : '';
  if (code.includes('URL_IMPORT_INVALID')) return 'Insira uma URL completa, por exemplo: https://exemplo.com/conteudo.csv.';
  if (code.includes('URL_IMPORT_PROTOCOL')) return 'Use um endereço HTTPS (começando por https://) para importar com segurança.';
  return reason instanceof Error ? reason.message : 'Falha na importação. Tente novamente.';
}

export default function ImportUrlPage() {
  const [url, setUrl] = useState('');
  const [deckId, setDeckId] = useState('');
  const [format, setFormat] = useState<ImportFormat>('csv');
  const [result, setResult] = useState<ImportDeckResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isEnabled('import_url')) {
    return <AppShell><Topbar title="Importar por URL" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  }

  async function run() {
    setResult(null);
    setError('');
    setBusy(true);
    try {
      setResult(await importDeckService.fromUrl({ url, deckId, format }));
    } catch (reason) {
      setError(importErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <Topbar title="Importar por URL" subtitle="O backend baixa a fonte HTTPS com limites e validação do destino, e materializa o lote no deck." />
      <section className="card form">
        <label htmlFor="import-url">URL HTTPS<input id="import-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></label>
        <label htmlFor="import-url-deck">Deck ID<input id="import-url-deck" value={deckId} onChange={(event) => setDeckId(event.target.value)} /></label>
        <label htmlFor="import-url-format">Formato<select id="import-url-format" value={format} onChange={(event) => setFormat(event.target.value as ImportFormat)}>{formats.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button className="btn" type="button" onClick={() => void run()} disabled={!url || !deckId || busy}>{busy ? 'Importando…' : 'Importar'}</button>
        {error && <p className="notice error" role="alert">{error}</p>}
        {result && <p role="status">{result.notes_count} nota(s) e {result.cards_count} cartão(ões) importado(s).</p>}
        {result && <a className="link-button" href={`/decks/${deckId}/cards`}>Ver cartões importados</a>}
      </section>
    </AppShell>
  );
}
