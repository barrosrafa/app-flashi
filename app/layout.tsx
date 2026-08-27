import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flashi — Estudo que fica',
  description: 'Flashcards offline-first com repetição espaçada FSRS-6.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
