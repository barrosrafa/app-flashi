
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftFromFields, mergeNoteFields, normalizeNoteFields } from '../lib/services/note-fields';
import { createExamGoal } from '../lib/services/exam-goal';
import { csvNumbers, parseNumberList, friendlySettingsError } from '../lib/services/settings-input';
import { withSameOriginEdgeProxy } from '../lib/supabase/client';

describe('F01 - entrega das Edge Functions', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  // Mesma resolução de URL usada por lib/supabase/client.ts.
  const edgeBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://fchpvgfjjxjpxfmtsrnc.supabase.co'}/functions/v1/`;

  it('reescreve chamadas de Edge Function para a origem da aplicacao', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' } });
    const seen: string[] = [];
    const base = ((url: string) => { seen.push(url); return Promise.resolve(new Response('{}')); }) as unknown as typeof fetch;
    const proxied = withSameOriginEdgeProxy(base);
    return proxied(`${edgeBase}sync`)
      .then(() => expect(seen[0]).toBe('http://localhost:3000/functions/v1/sync'));
  });

  it('nao interfere em chamadas REST, auth ou storage', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' } });
    const seen: string[] = [];
    const base = ((url: string) => { seen.push(url); return Promise.resolve(new Response('{}')); }) as unknown as typeof fetch;
    const proxied = withSameOriginEdgeProxy(base);
    return proxied('https://projeto.supabase.co/rest/v1/notes')
      .then(() => expect(seen[0]).toBe('https://projeto.supabase.co/rest/v1/notes'));
  });

  it('mantem a chamada original quando nao existe origem de navegador', () => {
    const seen: string[] = [];
    const base = ((url: string) => { seen.push(url); return Promise.resolve(new Response('{}')); }) as unknown as typeof fetch;
    const proxied = withSameOriginEdgeProxy(base);
    return proxied('https://projeto.supabase.co/functions/v1/sync')
      .then(() => expect(seen[0]).toBe('https://projeto.supabase.co/functions/v1/sync'));
  });
});

describe('F06 - campos estruturados da nota', () => {
  it('preserva arrays, objetos e numeros intactos ao salvar sem edicao', () => {
    const original = { Front: 'oi', Back: 'tchau', options: ['a', 'b'], count: 3, nested: { x: 1 }, active: true };
    const drafts = draftFromFields(normalizeNoteFields(original));
    const merged = mergeNoteFields(normalizeNoteFields(original), drafts);
    expect(merged).toEqual(original);
    expect(Array.isArray(merged.options)).toBe(true);
    expect(typeof merged.count).toBe('number');
    expect(typeof merged.active).toBe('boolean');
  });

  it('regrava somente o campo editado e adiciona campos novos', () => {
    const original = { Front: 'oi', options: ['a', 'b'] };
    const drafts = { ...draftFromFields(original), Front: 'novo texto', Extra: 'valor' };
    const merged = mergeNoteFields(original, drafts);
    expect(merged.Front).toBe('novo texto');
    expect(merged.options).toEqual(['a', 'b']);
    expect(merged.Extra).toBe('valor');
  });
});

describe('F07 - meta de estudo', () => {
  it('mantem sucesso quando a limpeza do formulario falha', async () => {
    const onCreated = vi.fn();
    const result = await createExamGoal({ create: async () => ({ id: 'exam-1' }), onCreated, resetForm: () => { throw new Error('reset quebrou'); } });
    expect(result.ok).toBe(true);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('nao cria meta nem limpa formulario quando a persistencia falha', async () => {
    const onCreated = vi.fn();
    const resetForm = vi.fn();
    const result = await createExamGoal({ create: async () => { throw new Error('AUTH_REQUIRED'); }, onCreated, resetForm });
    expect(result.ok).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
    expect(resetForm).not.toHaveBeenCalled();
  });
});

describe('F08 - configuracoes avancadas', () => {
  it('traduz codigos tecnicos para mensagens acionaveis', () => {
    expect(friendlySettingsError('FSRS_WEIGHTS_INVALID')).toContain('21 números');
    expect(friendlySettingsError('FSRS_PARAMS_INVALID')).toContain('JSON');
    expect(friendlySettingsError('CODIGO_DESCONHECIDO')).toBe('CODIGO_DESCONHECIDO');
  });

  it('aceita pesos vazios e rejeita contagem ou formato invalidos', () => {
    expect(csvNumbers('')).toEqual([]);
    expect(csvNumbers('1, 2, 3')).toEqual([1, 2, 3]);
    expect(() => csvNumbers('1,,2')).toThrow('FSRS_WEIGHTS_INVALID');
    expect(() => csvNumbers('a,b')).toThrow('FSRS_WEIGHTS_INVALID');
    expect(() => parseNumberList('x')).toThrow('FSRS_STEPS_INVALID');
  });
});
