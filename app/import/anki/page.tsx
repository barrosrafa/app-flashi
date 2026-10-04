'use client';

import { AppShell, Topbar } from '../../../components/AppShell';
import { isFeatureEnabled } from '../../../lib/feature-flags';
import { useAnkiImport } from '../../../lib/hooks/useAnkiImport';

export default function AnkiPage() {
  const { importApkg, busy, progress, error, result } = useAnkiImport();

  if (!isFeatureEnabled('anki_io')) {
    return <AppShell><Topbar title="Importar do Anki" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  }

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await importApkg(file); }
    catch { /* o hook expõe o erro para a UI */ }
    finally { event.target.value = ''; }
  }

  return (
    <AppShell>
      <Topbar title="Importar do Anki" subtitle="O pacote .apkg é validado, enviado ao bucket privado e materializado no deck de destino." />
      <section className="card">
        <label className="btn secondary" htmlFor="apkg">
          {busy ? `Enviando… ${Math.round(progress * 100)}%` : 'Selecionar ficheiro .apkg'}
          <input id="apkg" type="file" accept=".apkg" hidden onChange={pick} disabled={busy} />
        </label>
        {error && <p className="notice error" role="alert">{error}</p>}
        {result && <p className="status-text" role="status">Importação concluída: {result.imported_notes ?? 0} notas, {result.imported_cards ?? 0} cartões, {result.uploaded_media ?? 0} mídias e {result.skipped_notes ?? 0} notas já existentes ignoradas.</p>}
        {result?.deck_id && <a className="link-button" href={`/decks/${result.deck_id}/cards`}>Ver cartões do deck importado</a>}
      </section>
    </AppShell>
  );
}
