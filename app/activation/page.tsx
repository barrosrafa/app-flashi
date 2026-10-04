import type { Metadata } from 'next';
import ActivationClientPage from './client-page';

export const metadata: Metadata = { title: 'Ativação' };

export default function ActivationPage() {
  return <ActivationClientPage />;
}
