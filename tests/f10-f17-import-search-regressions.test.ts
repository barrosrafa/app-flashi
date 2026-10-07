import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeEdge } = vi.hoisted(() => ({ invokeEdge: vi.fn() }));
vi.mock('../lib/services/http/edge-client', () => ({ invokeEdge: (...args: unknown[]) => invokeEdge(...args) }));
vi.mock('../lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) },
  }),
}));

import { EdgeError } from '../lib/services/http/errors';
import { importDeckService } from '../lib/services/import-deck-service';

const searchWorkspace = readFileSync(new URL('../components/SearchWorkspace.tsx', import.meta.url), 'utf8');
const importPage = readFileSync(new URL('../app/import/deck/client-page.tsx', import.meta.url), 'utf8');

describe('F10 search regressions', () => {
  it('uses one workspace for both search routes and guards stale responses', () => {
    const main = readFileSync(new URL('../app/search/client-page.tsx', import.meta.url), 'utf8');
    const study = readFileSync(new URL('../app/study/search/client-page.tsx', import.meta.url), 'utf8');
    expect(main).toContain('SearchWorkspace');
    expect(study).toContain('SearchWorkspace');
    expect(searchWorkspace).toContain('if (id !== request.current) return;');
    expect(searchWorkspace).toContain('setResult(null);');
    expect(searchWorkspace).toContain('Tentar novamente');
  });
});

describe('F12 importer state and copy regressions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the primary import copy free of CORS and storage implementation details', () => {
    expect(importPage).not.toContain('CORS');
    expect(importPage).not.toContain('bucket');
    expect(importPage).toContain('fileDeckId');
    expect(importPage).toContain('urlDeckId');
    expect(importPage).toContain('fileFormat');
    expect(importPage).toContain('urlFormat');
  });
});

describe('F13 URL import error regressions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps HTTP, redirect and SSRF responses to user-actionable categories', async () => {
    invokeEdge.mockRejectedValueOnce(new EdgeError('import-deck', 422, 'request failed', { error: 'Import URL returned HTTP 404' }));
    await expect(importDeckService.fromUrl({ url: 'https://example.com/cards.csv', deckId: 'deck-1', format: 'csv' })).rejects.toThrow('URL_IMPORT_HTTP_404');
    invokeEdge.mockRejectedValueOnce(new EdgeError('import-deck', 422, 'request failed', { error: 'Import URL redirect is invalid' }));
    await expect(importDeckService.fromUrl({ url: 'https://example.com/cards.csv', deckId: 'deck-1', format: 'csv' })).rejects.toThrow('URL_IMPORT_REDIRECT');
    invokeEdge.mockRejectedValueOnce(new EdgeError('import-deck', 400, 'request failed', { error: 'URL host must resolve only to public addresses' }));
    await expect(importDeckService.fromUrl({ url: 'https://example.com/cards.csv', deckId: 'deck-1', format: 'csv' })).rejects.toThrow('URL_IMPORT_SSRF');
  });

});

describe('F17 import operation regressions', () => {
  it('does not share controls or busy state between file and URL imports', () => {
    expect(importPage).toContain('fileBusy');
    expect(importPage).toContain('urlBusy');
    expect(importPage).toContain('disabled={!file || !fileDeckId || fileBusy}');
    expect(importPage).toContain('disabled={!url || !urlDeckId || urlBusy}');
    expect(importPage).not.toContain('disabled={!file || !deckId || busy}');
    expect(importPage).not.toContain('disabled={!url || !deckId || busy}');
  });
});
