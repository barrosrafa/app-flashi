import { privatePageMetadata } from '../../../lib/private-page-metadata';
import ClientPage from './client-page';

export const metadata = privatePageMetadata('Sessão socrática');

type Props = { params: Promise<{ id: string }> };

export default function Page({ params }: Props) {
  return <ClientPage params={params} />;
}
