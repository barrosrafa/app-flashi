import { createClient } from '../supabase/client';
import type { Tag } from '../types/tag';

export type SubmissionRef = { current: boolean };
export function claimSubmission(ref: SubmissionRef): boolean { if (ref.current) return false; ref.current = true; return true; }
export function releaseSubmission(ref: SubmissionRef): void { ref.current = false; }

export function normalizeTagName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function canonicalTag(tag: Tag): Tag { return { ...tag, name: normalizeTagName(tag.name) }; }
function uniqueTags(tags: Tag[]): Tag[] {
  const seen = new Set<string>();
  return tags.map(canonicalTag).filter((tag) => {
    const key = tag.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function tagErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (message === 'TAG_NAME_REQUIRED') return 'Informe um nome para a tag.';
  if (message === 'AUTH_REQUIRED') return 'Entre na sua conta para gerenciar tags.';
  return 'Não foi possível atualizar as tags. Tente novamente.';
}

export const tagService = {
  async list(): Promise<Tag[]> { const { data, error } = await createClient().from('tags').select('id,user_id,name,color,created_at,usn').order('name'); if (error) throw error; return uniqueTags((data ?? []) as Tag[]); },
  async create(name: string, color?: string): Promise<Tag> { const value = normalizeTagName(name); if (!value) throw new Error('TAG_NAME_REQUIRED'); const { data: { user } } = await createClient().auth.getUser(); if (!user) throw new Error('AUTH_REQUIRED'); const { data, error } = await createClient().from('tags').upsert({ user_id: user.id, name: value, color: color || null }, { onConflict: 'user_id,name' }).select('id,user_id,name,color,created_at,usn').single(); if (error) throw error; return canonicalTag(data as Tag); },
  async remove(tagId: string) { const { error } = await createClient().from('tags').delete().eq('id', tagId); if (error) throw error; },
  async listForCard(cardId: string): Promise<Tag[]> { const { data, error } = await createClient().from('card_tags').select('tag:tags(id,user_id,name,color,created_at,usn)').eq('card_id', cardId); if (error) throw error; return uniqueTags((data ?? []).map((row) => (row as { tag: Tag | null }).tag).filter((tag): tag is Tag => Boolean(tag))); },
  async addToCard(cardId: string, tagId: string) { const { error } = await createClient().from('card_tags').upsert({ card_id: cardId, tag_id: tagId }); if (error) throw error; },
  async removeFromCard(cardId: string, tagId: string) { const { error } = await createClient().from('card_tags').delete().eq('card_id', cardId).eq('tag_id', tagId); if (error) throw error; },
};
