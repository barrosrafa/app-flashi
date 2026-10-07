'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, isSupabaseConfigured } from '../lib/supabase/client';
import { defaultLocale, isSupportedLocale, locales, type Dictionary, type SupportedLocale } from '../locales';
import { translateUiText } from './autoTranslations';

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

type TranslatedValue = { source: string; output: string };
const translatedTexts = new WeakMap<Text, TranslatedValue>();
const translatedAttributes = new WeakMap<Element, Map<string, TranslatedValue>>();

function translateTextNode(text: Text, locale: SupportedLocale) {
  const parent = text.parentElement;
  if (!parent || parent.closest('script, style, noscript,input,textarea,[contenteditable="true"],[translate="no"],[data-no-translate],[data-user-content]')) return;
  const current = text.nodeValue ?? '';
  if (!current.trim()) return;
  const previous = translatedTexts.get(text);
  const source = previous && current === previous.output ? previous.source : current;
  const output = translateUiText(source, locale);
  translatedTexts.set(text, { source, output });
  if (current !== output) text.nodeValue = output;
}

function translateAttribute(element: Element, name: string, locale: SupportedLocale) {
  if(element.closest('[translate="no"],[data-no-translate],[data-user-content]'))return;
  const current = element.getAttribute(name);
  if (!current) return;
  const attributes = translatedAttributes.get(element) ?? new Map<string, TranslatedValue>();
  const previous = attributes.get(name);
  const source = previous && current === previous.output ? previous.source : current;
  const output = translateUiText(source, locale);
  attributes.set(name, { source, output });
  translatedAttributes.set(element, attributes);
  if (current !== output) element.setAttribute(name, output);
}

function translateSubtree(root: Node, locale: SupportedLocale) {
  if (typeof document === 'undefined') return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }
  const rootElement = root.nodeType === Node.ELEMENT_NODE ? root as Element : null;
  if (rootElement?.matches('script, style, noscript')) return;

  const elements: Element[] = [];
  if (rootElement) elements.push(rootElement);
  if (rootElement) elements.push(...rootElement.querySelectorAll('[aria-label], [placeholder], [title]'));
  else if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    elements.push(...(root as DocumentFragment).querySelectorAll('[aria-label], [placeholder], [title]'));
  }
  for (const element of elements) {
    for (const name of ['aria-label', 'placeholder', 'title']) translateAttribute(element, name, locale);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) translateTextNode(node as Text, locale);
}

function translateDocument(locale: SupportedLocale) {
  if (typeof document !== 'undefined' && document.body) translateSubtree(document.body, locale);
}

export function shouldApplySyncedLocale({
  syncGeneration,
  latestSyncGeneration,
  preferenceGeneration,
  latestPreferenceGeneration,
  committedPreferenceGeneration,
  requestStartedWhileSaving,
  hasPendingPreference,
}: {
  syncGeneration: number;
  latestSyncGeneration: number;
  preferenceGeneration: number;
  latestPreferenceGeneration: number;
  committedPreferenceGeneration: number;
  requestStartedWhileSaving: boolean;
  hasPendingPreference: boolean;
}) {
  return syncGeneration === latestSyncGeneration
    && preferenceGeneration === latestPreferenceGeneration
    && preferenceGeneration === committedPreferenceGeneration
    && !requestStartedWhileSaving
    && !hasPendingPreference;
}

function writeBrowserLocale(locale: SupportedLocale) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, locale);
  document.cookie = `${COOKIE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
}

async function persistLocale(locale: SupportedLocale) {
  writeBrowserLocale(locale);
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('profiles').update({ language: locale }).eq('id', user.id);
  if (error) throw error;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);
  const localeRef = useRef<SupportedLocale>(defaultLocale);
  const syncGenerationRef = useRef(0);
  const preferenceGenerationRef = useRef(0);
  const committedPreferenceGenerationRef = useRef(0);
  const pendingPreferenceGenerationRef = useRef<number | null>(null);

  const applyLocale = useCallback((nextLocale: SupportedLocale) => {
    localeRef.current = nextLocale;
    setLocaleState(nextLocale);
    if (typeof document !== 'undefined') document.documentElement.lang = nextLocale;
  }, []);

  useEffect(() => {
    let observer: MutationObserver | undefined;
    const frame = window.requestAnimationFrame(() => {
      translateDocument(locale);
      observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === 'characterData' && record.target.nodeType === Node.TEXT_NODE) {
            translateTextNode(record.target as Text, locale);
          } else if (record.type === 'attributes' && record.target.nodeType === Node.ELEMENT_NODE && record.attributeName) {
            translateAttribute(record.target as Element, record.attributeName, locale);
          } else if (record.type === 'childList') {
            for (const addedNode of record.addedNodes) translateSubtree(addedNode, locale);
          }
        }
      });
      if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder', 'title'] });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [locale]);

  useEffect(() => {
    const initial = readStoredLocale();
    applyLocale(initial);
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const syncProfileLocale = async () => {
      const syncGeneration = ++syncGenerationRef.current;
      const preferenceGeneration = preferenceGenerationRef.current;
      const requestStartedWhileSaving = pendingPreferenceGenerationRef.current !== null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile, error } = await supabase.from('profiles').select('language').eq('id', user.id).maybeSingle();
      if (!error && profile && isSupportedLocale(profile.language)
        && shouldApplySyncedLocale({
          syncGeneration,
          latestSyncGeneration: syncGenerationRef.current,
          preferenceGeneration,
          latestPreferenceGeneration: preferenceGenerationRef.current,
          committedPreferenceGeneration: committedPreferenceGenerationRef.current,
          requestStartedWhileSaving,
          hasPendingPreference: pendingPreferenceGenerationRef.current !== null,
        })) {
        applyLocale(profile.language);
        writeBrowserLocale(profile.language);
      }
    };
    void syncProfileLocale();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void syncProfileLocale();
    });
    return () => subscription.unsubscribe();
  }, [applyLocale]);

  const setLocale = useCallback(async (nextLocale: SupportedLocale) => {
    const previousLocale = localeRef.current;
    if (!locales[nextLocale] || nextLocale === previousLocale) return;
    const preferenceGeneration = ++preferenceGenerationRef.current;
    pendingPreferenceGenerationRef.current = preferenceGeneration;
    applyLocale(nextLocale);
    try {
      await persistLocale(nextLocale);
    } catch (error) {
      if (pendingPreferenceGenerationRef.current === preferenceGeneration) {
        pendingPreferenceGenerationRef.current = null;
        committedPreferenceGenerationRef.current = preferenceGeneration;
        applyLocale(previousLocale);
        writeBrowserLocale(previousLocale);
      }
      throw error;
    }
    if (pendingPreferenceGenerationRef.current === preferenceGeneration) {
      pendingPreferenceGenerationRef.current = null;
      committedPreferenceGenerationRef.current = preferenceGeneration;
    }
  }, [applyLocale]);

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
