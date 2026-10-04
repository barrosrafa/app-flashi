import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeEdge, upload, remove, getUser } = vi.hoisted(() => ({
  invokeEdge: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock('../lib/services/http/edge-client', () => ({ invokeEdge: (...args: unknown[]) => invokeEdge(...args) }));
vi.mock('../lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: (...args: unknown[]) => getUser(...args) },
    storage: { from: () => ({ upload: (...args: unknown[]) => upload(...args), remove: (...args: unknown[]) => remove(...args) }) },
  }),
}));

import { importDeckService } from '../lib/services/import-deck-service';

describe('importDeckService URL contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeEdge.mockResolvedValue({ job_id: 'job-1', status: 'completed', notes_count: 1, cards_count: 1 });
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('browser fetch must not be used'); }));
  });

  it('sends HTTPS URL to import-deck for server-side download', async () => {
    const result = await importDeckService.fromUrl({ url: 'https://example.org/study.csv', deckId: 'deck-1', format: 'csv' });
    expect(result).toMatchObject({ status: 'completed', notes_count: 1 });
    expect(invokeEdge).toHaveBeenCalledWith('import-deck', {
      body: { deck_id: 'deck-1', format: 'csv', url: 'https://example.org/study.csv' },
      timeoutMs: 60_000,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects HTTP, embedded credentials, missing deck and oversized URLs before calling the backend', async () => {
    await expect(importDeckService.fromUrl({ url: 'http://example.org/file.csv', deckId: 'deck-1', format: 'csv' })).rejects.toThrow('URL_IMPORT_PROTOCOL');
    await expect(importDeckService.fromUrl({ url: 'https://user:pass@example.org/a.csv', deckId: 'deck-1', format: 'csv' })).rejects.toThrow('URL_IMPORT_CREDENTIALS');
    await expect(importDeckService.fromUrl({ url: 'https://example.org/a.csv', deckId: '', format: 'csv' })).rejects.toThrow('DECK_REQUIRED');
    await expect(importDeckService.fromUrl({ url: `https://example.org/${'a'.repeat(2050)}`, deckId: 'deck-1', format: 'csv' })).rejects.toThrow('URL_IMPORT_INVALID');
    expect(invokeEdge).not.toHaveBeenCalled();
  });
});
