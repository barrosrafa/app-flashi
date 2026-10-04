import { describe, expect, it } from 'vitest';
import { isAuthRequiredError, loginHref, requestedReturnTo, safeReturnTo } from '../lib/auth/navigation';

describe('navegação após autenticação', () => {
  it('preserva o caminho solicitado e sua query', () => {
    expect(safeReturnTo('/decks/abc/cards?tab=recent')).toBe('/decks/abc/cards?tab=recent');
    expect(requestedReturnTo('?next=%2Fstudy%2Fdeck-1%3Fmode%3Ddue')).toBe('/study/deck-1?mode=due');
  });

  it('usa Home quando o destino é ausente, externo ou malformado', () => {
    expect(safeReturnTo(null)).toBe('/');
    expect(safeReturnTo('https://example.com')).toBe('/');
    expect(safeReturnTo('//example.com')).toBe('/');
    expect(safeReturnTo('/\\\\example.com')).toBe('/');
  });

  it('impede loops para as rotas de login e cadastro', () => {
    expect(safeReturnTo('/login?next=%2Fdecks')).toBe('/');
    expect(safeReturnTo('/register')).toBe('/');
  });

  it('codifica o destino na URL de login e identifica somente erros de autenticação', () => {
    expect(loginHref('/decks?tab=cards')).toBe('/login?next=%2Fdecks%3Ftab%3Dcards');
    expect(isAuthRequiredError(new Error('AUTH_REQUIRED'))).toBe(true);
    expect(isAuthRequiredError(new Error('Network request failed'))).toBe(false);
  });
});
