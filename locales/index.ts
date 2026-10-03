import ptBR from './pt-BR.json';
import en from './en.json';
import es from './es.json';

export const locales = {
  'pt-BR': ptBR,
  en,
  es,
} as const;

export type SupportedLocale = keyof typeof locales;
export type Dictionary = typeof ptBR;
export const defaultLocale: SupportedLocale = 'pt-BR';
export const supportedLocales = Object.keys(locales) as SupportedLocale[];

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value != null && value in locales;
}

type EnsureSameShape<T, U> = T extends U ? true : false;
type _EnCheck = EnsureSameShape<typeof en, typeof ptBR>;
type _EsCheck = EnsureSameShape<typeof es, typeof ptBR>;
void (0 as unknown as _EnCheck);
void (0 as unknown as _EsCheck);
