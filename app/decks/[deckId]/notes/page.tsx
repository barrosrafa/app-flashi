import { NoteWorkspace } from '../../../../components/notes/NoteWorkspace';
import { AppShell, Topbar } from '../../../../components/AppShell';
import { privatePageMetadata } from '../../../../lib/private-page-metadata';

export const metadata = privatePageMetadata('Notes do deck');

export default async function NotesPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  return (
    <AppShell>
      <Topbar title="Notes do deck" subtitle="CRUD completo de conteúdo estruturado, cloze e referências." />
      <NoteWorkspace deckId={deckId} />
    </AppShell>
  );
}
