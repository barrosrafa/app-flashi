import { privatePageMetadata } from '../../../lib/private-page-metadata';
import ClientPage from './client-page';

export const metadata = privatePageMetadata('Importar do Anki');

export default function Page() {
  return <ClientPage />;
}
