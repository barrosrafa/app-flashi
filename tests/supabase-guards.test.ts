import { describe, expect, it } from 'vitest';
import { isUuid } from '../lib/supabase/guards';

describe('supabase guards', () => {
  it('aceita UUIDs v4 válidos', () => {
    expect(isUuid('0469c2b7-bdc9-44ea-ba67-a4bc98c3d62a')).toBe(true);
  });

  it('rejeita slugs de demonstração e UUIDs malformados', () => {
    expect(isUuid('idiomas')).toBe(false);
    expect(isUuid('demo')).toBe(false);
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(false);
  });
});
