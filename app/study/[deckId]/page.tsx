import { privatePageMetadata } from '../../../lib/private-page-metadata';
import ClientPage from './client-page';

export const metadata = privatePageMetadata('Sessão de estudo');

type Props = { params: Promise<{ deckId: string }> };

export default function Page({ params }: Props) {
  return <ClientPage params={params} />;
}
