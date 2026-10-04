import { privatePageMetadata } from '../../../lib/private-page-metadata';
import ClientPage from './client-page';

export const metadata = privatePageMetadata('Exportar para Anki');

export default function Page() {
  return <ClientPage />;
}
