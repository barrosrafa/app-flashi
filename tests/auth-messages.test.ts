import { describe, expect, it } from 'vitest';
import { getAuthErrorMessage } from '../lib/auth-messages';

describe('getAuthErrorMessage', () => {
  it('maps invalid credentials without exposing provider wording', () => {
    expect(getAuthErrorMessage(new Error('Invalid login credentials'), 'login'))
      .toContain('E-mail ou senha incorretos');
  });
  it('explains when the Supabase connection is not configured', () => {
    const message = getAuthErrorMessage(new Error('SUPABASE_NOT_CONFIGURED'), 'login');
    expect(message).toContain('A autenticação não está configurada');
    expect(message).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    expect(message).not.toContain('E-mail ou senha incorretos');
  });
  it('provides a cooldown for rate limiting', () => {
    expect(getAuthErrorMessage(new Error('Email rate limit exceeded'), 'register'))
      .toContain('Aguarde alguns minutos');
  });
  it('uses a safe fallback for unknown provider errors', () => {
    expect(getAuthErrorMessage(new Error('internal database details'), 'login'))
      .toBe('Não foi possível entrar agora. Verifique seus dados ou tente novamente em instantes.');
  });
});
