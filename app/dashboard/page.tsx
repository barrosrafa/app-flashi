import type { Metadata } from 'next';
import DashboardClient from '../../components/DashboardClient';
export const metadata: Metadata = { title: 'Hoje', robots: { index: false, follow: false } };
export default function DashboardPage() { return <DashboardClient />; }
