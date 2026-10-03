import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Flashi — Estudo que fica',
    short_name: 'Flashi',
    description: 'Flashcards offline-first com repetição espaçada.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#4F46E5',
    lang: 'pt-BR',
    categories: ['education', 'productivity'],
    icons: [],
    shortcuts: [
      { name: 'Estudar agora', short_name: 'Estudar', url: '/study/demo' },
      { name: 'Meus decks', short_name: 'Decks', url: '/decks' },
    ],
  };
}
