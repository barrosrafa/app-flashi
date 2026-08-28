import type { Metadata } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';

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
  return <html lang="pt-BR"><body><ServiceWorkerRegister />{children}</body></html>;
}
