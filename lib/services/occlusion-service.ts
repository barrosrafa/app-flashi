import { createClient, type Json } from '../supabase/client';
import type { CardMedia } from './media-service';
import { mediaService } from './media-service';
import { noteService } from './note-service';

export type OcclusionMask = { x: number; y: number; w: number; h: number; label?: string; cloze_ordinal?: number };

export type OcclusionCard = { card_id: string; cloze_ordinal: number };
export type OcclusionCreateResult = { cards: OcclusionCard[]; media: CardMedia[] };

export class OcclusionMediaAssociationError extends Error {
  constructor(readonly cardsCreated: number, readonly mediaAttached: number, options?: ErrorOptions) {
    super(`OCCLUSION_MEDIA_PARTIAL:${cardsCreated}:${mediaAttached}`, options);
    this.name = 'OcclusionMediaAssociationError';
  }
}

function toBoxes(masks: OcclusionMask[]): Json[] {
  return masks.map((mask, index) => {
    if (
      !Number.isFinite(mask.x) || !Number.isFinite(mask.y) ||
      !Number.isFinite(mask.w) || !Number.isFinite(mask.h) ||
      mask.x < 0 || mask.y < 0 || mask.w <= 0 || mask.h <= 0 ||
      mask.x + mask.w > 100 || mask.y + mask.h > 100
    ) throw new Error('OCCLUSION_BOXES_MUST_BE_PERCENTAGES');
    return {
      cloze_ordinal: mask.cloze_ordinal ?? index + 1,
      label_text: mask.label?.trim() || null,
      x_pos: mask.x,
      y_pos: mask.y,
      width_pct: mask.w,
      height_pct: mask.h,
      metadata: {},
    } as Json;
  });
}

export const occlusionService = {
  async createForDeck(params: { deckId: string; noteId: string; masks: OcclusionMask[]; imageFile: File }): Promise<OcclusionCreateResult> {
    if (!params.deckId || !params.noteId || !params.masks.length) throw new Error('OCCLUSION_INPUT_REQUIRED');
    if (!params.imageFile.size || !params.imageFile.type.startsWith('image/')) throw new Error('OCCLUSION_IMAGE_REQUIRED');
    const note = await noteService.get(params.noteId);
    if (!note) throw new Error('NOTE_NOT_FOUND');
    if (note.deck_id !== params.deckId) throw new Error('NOTE_NOT_IN_DECK');

    const { data, error } = await createClient().rpc('create_image_occlusion_note', {
      p_note_id: params.noteId,
      p_boxes: toBoxes(params.masks),
    });
    if (error) throw error;
    const cards = (data ?? []) as OcclusionCard[];
    if (!cards.length) throw new Error('OCCLUSION_EMPTY_RESULT');

    const media: CardMedia[] = [];
    try {
      for (const card of cards) {
        const uploaded = await mediaService.upload(params.imageFile, undefined, card.card_id, 'Front');
        if (!('storage_path' in uploaded)) throw new Error('OCCLUSION_MEDIA_NOT_PERSISTED');
        media.push(uploaded as CardMedia);
      }
    } catch (cause) {
      // The existing RPC commits cards before media upload; report partial success accurately.
      throw new OcclusionMediaAssociationError(cards.length, media.length, {
        cause: cause instanceof Error ? cause : undefined,
      });
    }
    return { cards, media };
  },

  async createNote(params: { noteId: string; masks: OcclusionMask[] }) {
    if (!params.noteId || !params.masks.length) throw new Error('OCCLUSION_INPUT_REQUIRED');
    const boxes = toBoxes(params.masks);
    const { data, error } = await createClient().rpc('create_image_occlusion_note', { p_note_id: params.noteId, p_boxes: boxes });
    if (error) throw error;
    return (data ?? []) as OcclusionCard[];
  },
  async listMasks(noteId: string): Promise<OcclusionMask[]> {
    const { data, error } = await createClient()
      .from('note_image_occlusion_boxes')
      .select('x_pos,y_pos,width_pct,height_pct,label_text,cloze_ordinal')
      .eq('note_id', noteId)
      .order('cloze_ordinal', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      x: Number(row.x_pos), y: Number(row.y_pos), w: Number(row.width_pct), h: Number(row.height_pct),
      label: row.label_text ?? undefined, cloze_ordinal: row.cloze_ordinal,
    }));
  },
};

export async function createImageOcclusionNote(noteId: string, masks: OcclusionMask[]) {
  return occlusionService.createNote({ noteId, masks });
}
