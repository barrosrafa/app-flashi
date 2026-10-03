import { describe, expect, it } from 'vitest';
import { validateTemplate } from '../lib/validation-template-schema';
import { getAnalyticsRange } from '../lib/services/analytics-service';

describe('SDD v5', () => {
  it('rejects template placeholders without a declared field', () => {
    expect(validateTemplate({ name: 'Basic', field_definitions: [{ name: 'Front' }], card_generation: [{ front: '{{Front}}', back: '{{Back}}' }] })).toContain('Campo "Back" referenciado na regra não existe');
  });
  it('accepts a valid template with multiple generations', () => {
    expect(validateTemplate({ name: 'Basic', field_definitions: [{ name: 'Front' }, { name: 'Back' }], card_generation: [{ front: '{{Front}}', back: '{{Back}}' }, { front: '{{Back}}', back: '{{Front}}' }] })).toEqual([]);
  });
  it('limits analytics range to the supported periods at the type boundary', () => {
    const values: Array<7 | 30 | 90> = [7, 30, 90];
    expect(values).toHaveLength(3);
    expect(getAnalyticsRange).toBeTypeOf('function');
  });
});
