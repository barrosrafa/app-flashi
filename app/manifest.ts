import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Flashi — Estudo que fica',
    short_name: 'Flashi',
    description: 'Flashcards offline-first com repetição espaçada.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f7fb',
    theme_color: '#151827',
    lang: 'pt-BR',
    categories: ['education', 'productivity'],
    icons: [],
    shortcuts: [
      { name: 'Estudar agora', short_name: 'Estudar', url: '/study/demo' },
      { name: 'Meus decks', short_name: 'Decks', url: '/decks' },
    ],
  };
}
