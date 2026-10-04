import type { Metadata } from 'next';
import { AppShell, Topbar } from '../../../components/AppShell';
import { LearningPlanPreferences } from '../../../components/profile/LearningPlanPreferences';
import { privatePageMetadata } from '../../../lib/private-page-metadata';

export const metadata: Metadata = privatePageMetadata('Meta de estudo');

export default function LearningPlanPage() {
  return <AppShell><Topbar title="Sua meta de estudo" subtitle="Defina um objetivo flexível e ajuste-o quando sua rotina mudar." /><LearningPlanPreferences /></AppShell>;
}
