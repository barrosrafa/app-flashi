import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  estimateDashboardMinutes,
  loadDashboardSection,
  selectNextDashboardDeck,
  type DueCard,
} from '../lib/services/dashboard-service';
import { getDeckLibraryViewState } from '../components/DeckLibrary';
import type { Deck } from '../lib/services/deck-service';

const deck = (id: string, name: string): Deck => ({
  id,
  user_id: 'user-1',
  name,
  description: null,
  visibility: 'private',
  parent_deck_id: null,
  deleted_at: null,
  is_archived: false,
  cardCount: 4,
  newCount: 1,
  reviewCount: 3,
  progress: 75,
});

const dueCard = (deckId: string): DueCard => ({
  card_id: `card-${deckId}`,
  deck_id: deckId,
  state: 'review',
  due_at: new Date().toISOString(),
  fields: {},
  interval_days: 1,
});

describe('F09 - dashboard com carregamento e erros por seção', () => {
  it('preserva resultados de biblioteca e plano quando a fila falha', async () => {
    const [library, queue, plan] = await Promise.all([
      loadDashboardSection(async () => [deck('library-1', 'Biblioteca')] as Deck[]),
      loadDashboardSection(async () => { throw new Error('fila indisponível'); }),
      loadDashboardSection(async () => ({ goal: 'exam' })),
    ]);

    expect(library).toMatchObject({ status: 'success', data: [expect.objectContaining({ id: 'library-1' })] });
    expect(queue).toMatchObject({ status: 'error', error: { kind: 'unknown' } });
    expect(plan).toMatchObject({ status: 'success', data: { goal: 'exam' } });
  });

  it('mantém a próxima sessão derivada da fila e da biblioteca independentes', () => {
    expect(selectNextDashboardDeck([deck('a', 'A'), deck('b', 'B')], [dueCard('b'), dueCard('b'), dueCard('a')])?.id).toBe('b');
    expect(estimateDashboardMinutes(10, 600000, 5)).toBe(5);
  });
});

describe('F33 - estados completos da DeckLibrary', () => {
  it('não apresenta empty enquanto a busca ainda está em loading', () => {
    expect(getDeckLibraryViewState({ loading: true, decks: [], error: '' })).toBe('loading');
  });

  it('representa empty, success, error e not-found de forma distinta', () => {
    expect(getDeckLibraryViewState({ loading: false, decks: [], error: '' })).toBe('empty');
    expect(getDeckLibraryViewState({ loading: false, decks: [deck('one', 'Um')], error: '' })).toBe('success');
    expect(getDeckLibraryViewState({ loading: false, decks: [], error: 'falhou' })).toBe('error');
    expect(getDeckLibraryViewState({ loading: false, decks: [], error: 'não encontrado', notFound: true })).toBe('not-found');
  });
});

describe('F34 - detalhe do deck prioriza resumo e conteúdo', () => {
  it('mantém Estudar agora e conteúdo antes dos painéis secundários', () => {
    const source = readFileSync(new URL('../components/decks/DeckDetailClient.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Estudar agora');
    expect(source).toContain('Conteúdo do deck');
    expect(source).toContain('<CardBrowser deckId={deckId} />');
    expect(source).toContain('<NoteWorkspace deckId={deckId} />');
    expect(source).toContain('<summary>Mídia e anexos</summary>');
    expect(source).toContain('<summary>Configurações do deck</summary>');
    expect(source).toContain('<summary>Compartilhamento</summary>');
    expect(source.indexOf('Conteúdo do deck')).toBeLessThan(source.indexOf('<summary>Mídia e anexos</summary>'));
  });
});
