'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { defaultLocale, isSupportedLocale, locales, type Dictionary, type SupportedLocale } from '../locales';

type PathInto<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends object ? PathInto<T[K], `${Prefix}${K}.`> : `${Prefix}${K}`;
}[keyof T & string];
export type TranslationKey = PathInto<Dictionary>;

type LanguageContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const STORAGE_KEY = 'flashi_locale';
const COOKIE_KEY = 'NEXT_LOCALE';

function readStoredLocale(): SupportedLocale {
  if (typeof window === 'undefined') return defaultLocale;
  const value = window.localStorage.getItem(STORAGE_KEY) ?? document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/)?.[1];
  return isSupportedLocale(value) ? value : defaultLocale;
}

function lookup(dictionary: Dictionary, key: TranslationKey): string | undefined {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) return (current as Record<string, unknown>)[part];
    return undefined;
  }, dictionary);
  return typeof value === 'string' ? value : undefined;
}

function interpolate(value: string, variables?: Record<string, string | number>) {
  if (!variables) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(variables[name] ?? `{${name}}`));
}

async function persistLocale(locale: SupportedLocale) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.cookie = `${COOKIE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = locale;
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('profiles').update({ language: locale }).eq('id', user.id);
  if (error) throw error;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);

  const applyLocale = useCallback((nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale);
    if (typeof document !== 'undefined') document.documentElement.lang = nextLocale;
  }, []);

  useEffect(() => {
    const initial = readStoredLocale();
    applyLocale(initial);
    const supabase = createClient();
    const syncProfileLocale = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile, error } = await supabase.from('profiles').select('language').eq('id', user.id).maybeSingle();
      if (!error && profile && isSupportedLocale(profile.language)) {
        applyLocale(profile.language);
        window.localStorage.setItem(STORAGE_KEY, profile.language);
        document.cookie = `${COOKIE_KEY}=${profile.language}; Path=/; Max-Age=31536000; SameSite=Lax`;
      }
    };
    void syncProfileLocale();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void syncProfileLocale();
    });
    return () => subscription.unsubscribe();
  }, [applyLocale]);

  const setLocale = useCallback(async (nextLocale: SupportedLocale) => {
    if (!locales[nextLocale] || nextLocale === locale) return;
    applyLocale(nextLocale);
    try {
      await persistLocale(nextLocale);
    } catch (error) {
      console.error('Não foi possível persistir o idioma no Supabase:', error);
    }
  }, [applyLocale, locale]);

  const t = useCallback((key: TranslationKey, variables?: Record<string, string | number>) => {
    const value = lookup(locales[locale], key) ?? lookup(locales[defaultLocale], key) ?? key;
    return interpolate(value, variables);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation must be used within LanguageProvider');
  return context;
}
