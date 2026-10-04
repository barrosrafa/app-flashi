import { privatePageMetadata } from '../../lib/private-page-metadata';
import ClientPage from './client-page';

export const metadata = privatePageMetadata('Estudar');

export default function Page() {
  return <ClientPage />;
}
