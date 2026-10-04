import { describe, expect, it } from 'vitest';
import { createImageOcclusionNote } from '../lib/services/occlusion-service';
import { parseFeatureFlag } from '../lib/feature-flags';
import { ENTITY_TABLE_MAP } from '../lib/db/sync-engine';
describe('occlusion contract', () => {
  it('rejects pixel coordinates and missing note ids', async () => {
    await expect(createImageOcclusionNote('note', [{ x: 200, y: 0, w: .2, h: .2 }])).rejects.toThrow('PERCENTAGES');
    await expect(createImageOcclusionNote('', [{ x: .1, y: .1, w: .2, h: .2 }])).rejects.toThrow('INPUT_REQUIRED');
  });
  it('rejects non-finite percentages', async () => {
    await expect(createImageOcclusionNote('note', [{ x: Number.NaN, y: 0, w: 1, h: 1 }])).rejects.toThrow('PERCENTAGES');
  });
});

describe('feature flags', () => {
  it('parses only explicit enabled values', () => {
    expect(parseFeatureFlag('1')).toBe(true);
    expect(parseFeatureFlag('true')).toBe(true);
    expect(parseFeatureFlag('TRUE')).toBe(true);
    expect(parseFeatureFlag('0')).toBe(false);
    expect(parseFeatureFlag(undefined)).toBe(false);
  });
});

describe('incremental sync entity contract', () => {
  it('maps only backend aliases and does not accept client store names as aliases', () => {
    expect(ENTITY_TABLE_MAP.deck).toBe('decks');
    expect(ENTITY_TABLE_MAP.note_image_occlusion_box).toBe('note_image_occlusion_boxes');
    expect(ENTITY_TABLE_MAP.field_definitions).toBeUndefined();
    expect(ENTITY_TABLE_MAP.profile).toBeUndefined();
  });
});
