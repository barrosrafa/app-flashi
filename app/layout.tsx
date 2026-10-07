import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import { SyncWorkerRegister } from '../components/SyncWorkerRegister';
import { ThemeProvider } from '../lib/theme/ThemeProvider';
import { LanguageProvider } from '../contexts/LanguageContext';
import { siteUrl } from '../lib/site-url';
import { ObservabilityBridge } from '../components/ObservabilityBridge';
import { Analytics } from '@vercel/analytics/next';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#4F46E5' };
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'Flashi — Estudo que fica',
    template: '%s | Flashi',
  },
  description: 'Flashcards offline-first com repetição espaçada FSRS-6 para estudar com consistência.',
  applicationName: 'Flashi',
  keywords: ['flashcards', 'repetição espaçada', 'FSRS', 'estudo offline'],
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Flashi — Estudo que fica',
    description: 'Organize seus decks e transforme revisão em hábito.',
    type: 'website',
    locale: 'pt_BR',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><head><script data-user-content="" dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('flashi-theme')||'system';var d=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}})()` }} /></head><body><ThemeProvider><LanguageProvider><ObservabilityBridge /><ServiceWorkerRegister /><SyncWorkerRegister />{children}<Analytics /></LanguageProvider></ThemeProvider></body></html>;
}
