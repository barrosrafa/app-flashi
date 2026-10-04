import { privatePageMetadata } from '../../lib/private-page-metadata';
import ClientPage from './client-page';

export const metadata = privatePageMetadata('Metas de estudo');

export default function Page() {
  return <ClientPage />;
}
