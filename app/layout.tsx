import type { Metadata } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import { SyncWorkerRegister } from '../components/SyncWorkerRegister';
import { EdgeErrorNotice } from '../components/EdgeErrorNotice';
import { ThemeProvider } from '../lib/theme/ThemeProvider';
import { LanguageProvider } from '../contexts/LanguageContext';

export const metadata: Metadata = {
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
  return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('flashi-theme')||'system';var d=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){}})()` }} /></head><body><ThemeProvider><LanguageProvider><ServiceWorkerRegister /><SyncWorkerRegister /><EdgeErrorNotice />{children}</LanguageProvider></ThemeProvider></body></html>;
}
