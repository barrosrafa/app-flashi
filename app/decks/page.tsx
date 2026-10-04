import { AppShell, Topbar } from '../../components/AppShell';
import DeckLibrary from '../../components/DeckLibrary';
import { privatePageMetadata } from '../../lib/private-page-metadata';

export const metadata = privatePageMetadata('Meus decks');

export default function Decks(){return <AppShell><Topbar title="Meus decks" subtitle="Organize seu conhecimento em pequenos espaços."/><DeckLibrary/></AppShell>}
