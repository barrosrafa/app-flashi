'use client';
import { useCallback, useEffect, useState } from 'react';
import { collaboratorService } from '../lib/services/collaborator-service';
import type { CollaborationInvite, CollaborationInviteInput, DeckCollaborator, DeckRole } from '../lib/types/collaborator';
export function useDeckCollaborators(deckId: string) {
  const [items, setItems] = useState<DeckCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const reload = useCallback(async () => {
    try { setLoading(true); setItems(await collaboratorService.list(deckId)); setError(null); }
    catch (e) { setError(e as Error); }
    finally { setLoading(false); }
  }, [deckId]);
  useEffect(() => { void reload(); }, [reload]);
  return {
    items, loading, error, reload,
    createInvite: async (input: CollaborationInviteInput): Promise<CollaborationInvite> => collaboratorService.createInvite(deckId, input),
    updateRole: async (userId: string, role: DeckRole) => { await collaboratorService.updateRole(deckId, userId, role); await reload(); },
    remove: async (userId: string) => { await collaboratorService.remove(deckId, userId); await reload(); },
  };
}
