import { describe, expect, it } from 'vitest';
import { createImageOcclusionNote } from '../lib/services/occlusion-service';
describe('occlusion contract', () => {
  it('rejects pixel coordinates and missing note ids', async () => {
    await expect(createImageOcclusionNote('note', [{ x: 200, y: 0, w: .2, h: .2 }])).rejects.toThrow('PERCENTAGES');
    await expect(createImageOcclusionNote('', [{ x: .1, y: .1, w: .2, h: .2 }])).rejects.toThrow('INPUT_REQUIRED');
  });
});
