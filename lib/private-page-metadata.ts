import type { Metadata } from 'next';

export function privatePageMetadata(title: string): Metadata {
  const description = `${title} no Flashi. Entre na sua conta para acessar esta área de estudo.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: `${title} | Flashi`, description, type: 'website', siteName: 'Flashi' },
  };
}
