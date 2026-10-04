import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Flashi — Estudo que fica',
    short_name: 'Flashi',
    description: 'Flashcards offline-first com repetição espaçada.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#4F46E5',
    lang: 'pt-BR',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/flashi-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/flashi-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/flashi-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/flashi.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Estudar agora', short_name: 'Estudar', url: '/study/demo' },
      { name: 'Meus decks', short_name: 'Decks', url: '/decks' },
    ],
  };
}
