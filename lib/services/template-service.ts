import { createClient } from '../supabase/client';
import type { Json } from '../../src/types/database';
import type { CardTemplate } from '../types/card-template';
import { hasBrowserSession } from '../supabase/guards';
function rows(data: unknown): CardTemplate[] { return (data ?? []) as CardTemplate[]; }
export function templateEditPath(id: string): string { return `/templates/${encodeURIComponent(id)}/edit`; }
export const templateService = {
  async list() { if (!(await hasBrowserSession())) throw new Error('AUTH_REQUIRED'); const { data, error } = await createClient().from('card_templates').select('*').order('name'); if (error) throw error; return rows(data); },
  async get(id: string) { if (!(await hasBrowserSession())) throw new Error('AUTH_REQUIRED'); const { data, error } = await createClient().from('card_templates').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data as CardTemplate | null; },
  async create(input: Pick<CardTemplate, 'name' | 'field_definitions' | 'card_generation'>) { const { data: { user } } = await createClient().auth.getUser(); if (!user) throw new Error('AUTH_REQUIRED'); const { data, error } = await createClient().from('card_templates').insert({ name: input.name, field_definitions: input.field_definitions as unknown as Json, card_generation: input.card_generation as unknown as Json, user_id: user.id, is_system: false }).select('*').single(); if (error) throw error; return data as CardTemplate; },
  async update(id: string, patch: Partial<Pick<CardTemplate, 'name' | 'field_definitions' | 'card_generation'>>): Promise<CardTemplate> { const { data, error } = await createClient().from('card_templates').update({ ...patch, field_definitions: patch.field_definitions as unknown as Json | undefined, card_generation: patch.card_generation as unknown as Json | undefined }).eq('id', id).select('*').single(); if (error) throw error; return data as CardTemplate; },
  async remove(id: string) { const { error } = await createClient().from('card_templates').delete().eq('id', id); if (error) throw error; },
};
