import { createClient } from '../supabase/client';
import type { Tag } from '../types/tag';
export const tagService = {
  async list(): Promise<Tag[]> { const { data, error } = await createClient().from('tags').select('id,user_id,name,color,created_at,usn').order('name'); if (error) throw error; return (data ?? []) as Tag[]; },
  async create(name: string, color?: string): Promise<Tag> { const value = name.trim(); if (!value) throw new Error('TAG_NAME_REQUIRED'); const { data: { user } } = await createClient().auth.getUser(); if (!user) throw new Error('AUTH_REQUIRED'); const { data, error } = await createClient().from('tags').upsert({ user_id: user.id, name: value, color: color || null }, { onConflict: 'user_id,name' }).select('id,user_id,name,color,created_at,usn').single(); if (error) throw error; return data as Tag; },
  async remove(tagId: string) { const { error } = await createClient().from('tags').delete().eq('id', tagId); if (error) throw error; },
  async listForCard(cardId: string): Promise<Tag[]> { const { data, error } = await createClient().from('card_tags').select('tag:tags(id,user_id,name,color,created_at,usn)').eq('card_id', cardId); if (error) throw error; return (data ?? []).map((row) => (row as { tag: Tag }).tag).filter(Boolean); },
  async addToCard(cardId: string, tagId: string) { const { error } = await createClient().from('card_tags').upsert({ card_id: cardId, tag_id: tagId }); if (error) throw error; },
  async removeFromCard(cardId: string, tagId: string) { const { error } = await createClient().from('card_tags').delete().eq('card_id', cardId).eq('tag_id', tagId); if (error) throw error; },
};
