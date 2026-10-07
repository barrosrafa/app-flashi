import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upload, getUser } = vi.hoisted(() => ({
  upload: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('../lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: (...args: unknown[]) => getUser(...args) },
    storage: { from: () => ({ upload: (...args: unknown[]) => upload(...args) }) },
  }),
}));
vi.mock('../lib/services/http/edge-client', () => ({ invokeEdge: vi.fn() }));

import { ankiService } from '../lib/services/anki-service';

describe('ankiService F14 file contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects collection.anki21b with an actionable unsupported message before upload', async () => {
    const file = new File([new Uint8Array([1, 2])], 'collection.anki21b');
    await expect(ankiService.importApkg({ file })).rejects.toThrow('ANKI21B_UNSUPPORTED');
    expect(upload).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('continues requiring the supported .apkg extension', async () => {
    const file = new File([new Uint8Array([1, 2])], 'collection.zip');
    await expect(ankiService.importApkg({ file })).rejects.toThrow('APKG_REQUIRED');
    expect(upload).not.toHaveBeenCalled();
  });
});
