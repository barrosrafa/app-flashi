import { describe, expect, it } from 'vitest';
import { defaultLocale, isSupportedLocale, locales, supportedLocales } from '../locales';
import { translateUiText } from '../contexts/autoTranslations';

describe('i18n contract', () => {
  it('exposes the three supported locales and pt-BR as default', () => {
    expect(supportedLocales).toEqual(['pt-BR', 'en', 'es']);
    expect(defaultLocale).toBe('pt-BR');
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
  });

  it('keeps the translation shape complete across locales', () => {
    const reference = JSON.stringify(locales['pt-BR'], Object.keys(locales['pt-BR']).sort());
    expect(Object.keys(locales.en)).toEqual(Object.keys(locales['pt-BR']));
    expect(Object.keys(locales.es)).toEqual(Object.keys(locales['pt-BR']));
    expect(reference).toContain('profile');
    expect(locales.en.languages.en).toBe('English');
    expect(locales.es.languages.es).toBe('Español');
  });

  it('translates shared hardcoded UI phrases for every non-default locale', () => {
    expect(translateUiText('Seu perfil', 'en')).toBe('Your profile');
    expect(translateUiText('Seu perfil', 'es')).toBe('Tu perfil');
    expect(translateUiText('Sessão de estudo', 'en')).toBe('Study session');
    expect(translateUiText('Sessão de estudo', 'es')).toBe('Sesión de estudio');
    expect(translateUiText('Seu perfil', 'pt-BR')).toBe('Seu perfil');
  });
});
