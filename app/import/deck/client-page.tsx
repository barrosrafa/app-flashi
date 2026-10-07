'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { ImportJobMonitor } from '../../../components/ImportJobMonitor';
import { importDeckService, type ImportFormat } from '../../../lib/services/import-deck-service';
import { listDecks, type Deck } from '../../../lib/services/deck-service';

const formats: ImportFormat[] = ['csv', 'markdown', 'quizlet', 'remnote'];

function importErrorMessage(kind: 'file' | 'url', reason: unknown): string {
  const code = reason instanceof Error ? reason.message : '';
  if (code.includes('DECK_REQUIRED')) return 'Escolha um deck de destino.';
  if (code.includes('AUTH_REQUIRED')) return 'Entre na sua conta para importar conteúdo.';
  if (kind === 'url') {
    if (code.includes('URL_IMPORT_INVALID')) return 'Insira uma URL completa, por exemplo: https://exemplo.com/conteudo.csv.';
    if (code.includes('URL_IMPORT_PROTOCOL')) return 'Use um endereço HTTPS (começando por https://).';
    if (code.includes('URL_IMPORT_CREDENTIALS')) return 'Remova o usuário e a senha do endereço.';
    if (code.includes('URL_IMPORT_REDIRECT')) return 'O endereço redirecionou para um destino inválido. Confira o link e tente novamente.';
    if (code.includes('URL_IMPORT_SSRF')) return 'Este endereço não pode ser acessado por segurança. Use uma URL HTTPS pública.';
    const httpStatus = code.match(/URL_IMPORT_HTTP_(\d{3})/)?.[1];
    if (httpStatus) return `A fonte respondeu com HTTP ${httpStatus}. Confira o endereço e tente novamente.`;
    return 'Não foi possível baixar este endereço. Confira o link e tente novamente.';
  }
  if (code.includes('IMPORT_EMPTY')) return 'Escolha um arquivo que não esteja vazio.';
  if (code.includes('IMPORT_TOO_LARGE')) return 'O arquivo deve ter no máximo 15 MiB.';
  if (code.includes('IMPORT_EXTENSION_INVALID')) return 'Escolha um arquivo compatível com o formato selecionado.';
  return 'Não foi possível importar o arquivo. Confira o formato e tente novamente.';
}

function deckOptions(decks: Deck[]) {
  return decks.length
    ? decks.map((deck) => <option data-user-content="" key={deck.id} value={deck.id}>{deck.name}</option>)
    : <option value="">Nenhum deck disponível</option>;
}

export default function ImportDeckPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [fileDeckId, setFileDeckId] = useState('');
  const [urlDeckId, setUrlDeckId] = useState('');
  const [fileFormat, setFileFormat] = useState<ImportFormat>('csv');
  const [urlFormat, setUrlFormat] = useState<ImportFormat>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [fileMessage, setFileMessage] = useState('');
  const [urlMessage, setUrlMessage] = useState('');
  const [fileResultDeckId, setFileResultDeckId] = useState('');
  const [urlResultDeckId, setUrlResultDeckId] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const [urlBusy, setUrlBusy] = useState(false);

  useEffect(() => {
    listDecks().then((rows) => {
      setDecks(rows);
      const firstDeckId = rows[0]?.id ?? '';
      setFileDeckId(firstDeckId);
      setUrlDeckId(firstDeckId);
    }).catch((reason: unknown) => {
      const message = reason instanceof Error && reason.message === 'SUPABASE_NOT_CONFIGURED'
        ? 'Configure a conexão do Supabase para listar seus decks.'
        : 'Entre na sua conta para importar conteúdo.';
      setFileMessage(message);
      setUrlMessage(message);
    });
  }, []);

  async function importFile() {
    if (!file || !fileDeckId || fileBusy) return;
    setFileBusy(true);
    setFileMessage('Importando o arquivo…');
    setFileResultDeckId('');
    try {
      const result = await importDeckService.fromFile({ file, deckId: fileDeckId, format: fileFormat });
      setFileMessage(`${result.notes_count} notas e ${result.cards_count} cartões importados.`);
      setFileResultDeckId(fileDeckId);
      setFile(null);
    } catch (reason) {
      setFileMessage(importErrorMessage('file', reason));
    } finally {
      setFileBusy(false);
    }
  }

  async function importUrl() {
    if (!url || !urlDeckId || urlBusy) return;
    setUrlBusy(true);
    setUrlMessage('Baixando o conteúdo…');
    setUrlResultDeckId('');
    try {
      const result = await importDeckService.fromUrl({ url, deckId: urlDeckId, format: urlFormat });
      setUrlMessage(`${result.notes_count} notas e ${result.cards_count} cartões importados.`);
      setUrlResultDeckId(urlDeckId);
      setUrl('');
    } catch (reason) {
      setUrlMessage(importErrorMessage('url', reason));
    } finally {
      setUrlBusy(false);
    }
  }

  return (
    <AppShell>
      <Topbar title="Importar deck" subtitle="Traga conteúdo de arquivo ou URL para o deck escolhido." />
      <div className="grid tool-grid">
        <section className="card tool-card">
          <div className="eyebrow">Arquivo</div><h2>Importar arquivo</h2>
          <p className="subtitle">CSV, Markdown, Quizlet ou RemNote, com limite de 15 MiB.</p>
          <div className="form">
            <div className="field"><label htmlFor="import-deck">Deck de destino</label><select id="import-deck" value={fileDeckId} onChange={(event) => setFileDeckId(event.target.value)} disabled={!decks.length || fileBusy}>{deckOptions(decks)}</select></div>
            <div className="field"><label htmlFor="import-format">Formato</label><select id="import-format" value={fileFormat} onChange={(event) => setFileFormat(event.target.value as ImportFormat)} disabled={fileBusy}>{formats.map((item) => <option value={item} key={item}>{item.toUpperCase()}</option>)}</select></div>
            <div className="field"><label htmlFor="import-file">Arquivo</label><input id="import-file" type="file" accept=".csv,.md,.markdown,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={fileBusy} /></div>
            <button className="btn" type="button" onClick={() => void importFile()} disabled={!file || !fileDeckId || fileBusy}>{fileBusy ? 'Importando arquivo…' : 'Importar arquivo'}</button>
            {fileMessage && <p className="notice" role="status">{fileMessage}</p>}
            {fileResultDeckId && <a className="link-button" href={`/decks/${fileResultDeckId}/cards`}>Ver cartões importados no deck</a>}
          </div>
        </section>
        <section className="card tool-card">
          <div className="eyebrow">URL</div><h2>Importar por URL</h2>
          <p className="subtitle">Use uma URL HTTPS pública que contenha o conteúdo do deck.</p>
          <div className="form">
            <div className="field"><label htmlFor="url-deck">Deck de destino</label><select id="url-deck" value={urlDeckId} onChange={(event) => setUrlDeckId(event.target.value)} disabled={!decks.length || urlBusy}>{deckOptions(decks)}</select></div>
            <div className="field"><label htmlFor="url-format">Formato</label><select id="url-format" value={urlFormat} onChange={(event) => setUrlFormat(event.target.value as ImportFormat)} disabled={urlBusy}>{formats.map((item) => <option value={item} key={item}>{item.toUpperCase()}</option>)}</select></div>
            <div className="field"><label htmlFor="source-url">URL HTTPS</label><input id="source-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://exemplo.com/conteudo.csv" disabled={urlBusy} /></div>
            <button className="btn secondary" type="button" onClick={() => void importUrl()} disabled={!url || !urlDeckId || urlBusy}>{urlBusy ? 'Importando URL…' : 'Importar URL'}</button>
            {urlMessage && <p className="notice" role="status">{urlMessage}</p>}
            {urlResultDeckId && <a className="link-button" href={`/decks/${urlResultDeckId}/cards`}>Ver cartões importados no deck</a>}
          </div>
        </section>
      </div>
      <ImportJobMonitor />
    </AppShell>
  );
}
