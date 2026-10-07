'use client';
import { AppShell, Topbar } from '../../../components/AppShell';
import { SearchWorkspace } from '../../../components/SearchWorkspace';
import { isFeatureEnabled } from '../../../lib/feature-flags';

export default function SemanticSearchPage() {
  if (!isFeatureEnabled('semantic')) {
    return <AppShell><Topbar title="Busca semântica" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  }
  return <SearchWorkspace title="Busca semântica" subtitle="Encontre notas pelo significado, não apenas por palavras exatas." />;
}
