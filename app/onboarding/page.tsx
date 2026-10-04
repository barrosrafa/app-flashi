import type { Metadata } from 'next';
import OnboardingClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Seu plano de estudo',
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingClientPage />;
}
