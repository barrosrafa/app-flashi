import DashboardClient from '../../components/DashboardClient';
import { privatePageMetadata } from '../../lib/private-page-metadata';

export const metadata = privatePageMetadata('Hoje');
export default function DashboardPage() { return <DashboardClient />; }
