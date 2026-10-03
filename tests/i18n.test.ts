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

  it('translates all reported feature areas and dynamic status messages', () => {
    expect(translateUiText('Priorize seus decks por data-alvo — não são provas geradas por IA.', 'en')).toContain('Prioritize your decks');
    expect(translateUiText('Priorize seus decks por data-alvo — não são provas geradas por IA.', 'es')).toContain('Prioriza tus mazos');
    expect(translateUiText('Acompanhe cada lote sem perder o arquivo original nem o resultado materializado.', 'en')).toBe('Track each batch without losing the original file or the materialized result.');
    expect(translateUiText('O ranking está indisponível no momento.', 'es')).toBe('La clasificación no está disponible en este momento.');
    expect(translateUiText('3 resultado(s) em modo semantic.', 'en')).toBe('3 result(s) in semantic mode.');
    expect(translateUiText('3 resultado(s) em modo semantic.', 'es')).toBe('3 resultado(s) en modo semántico.');
    expect(translateUiText('3 notas e 8 cards importados.', 'es')).toBe('3 notas y 8 tarjetas importadas.');
    expect(translateUiText('Job 123 enviado para processamento. Nada é salvo sem revisão.', 'en')).toBe('Job 123 submitted for processing. Nothing is saved without review.');
    expect(translateUiText('Importação abc concluída: 4 cartões.', 'es')).toBe('Importación abc completada: 4 tarjetas.');
    expect(translateUiText('Limite atingido em search. Tente novamente em 20s.', 'es')).toBe('Se alcanzó el límite en search. Inténtalo de nuevo en 20s.');
    expect(translateUiText('completed', 'es')).toBe('Completado');
  });
});
