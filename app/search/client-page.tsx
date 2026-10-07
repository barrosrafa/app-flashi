'use client';
import { AppShell, Topbar } from '../../components/AppShell';
import { SearchWorkspace } from '../../components/SearchWorkspace';
import { isEnabled } from '../../lib/config/feature-flags';

export default function SearchPage() {
  if (!isEnabled('semantic_search')) {
    return <AppShell><Topbar title="Busca" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  }
  return <SearchWorkspace title="Busca semântica" subtitle="Encontre notas pelo significado." />;
}
