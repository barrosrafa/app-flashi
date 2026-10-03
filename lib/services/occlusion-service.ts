import { createClient } from '../supabase/client';

export type OcclusionMask = { x: number; y: number; w: number; h: number; label?: string; cloze_ordinal?: number };

function toMask(row: { x_pos: number; y_pos: number; width_pct: number; height_pct: number; label_text: string | null; cloze_ordinal: number }): OcclusionMask {
  return {
    x: Number(row.x_pos),
    y: Number(row.y_pos),
    w: Number(row.width_pct),
    h: Number(row.height_pct),
    label: row.label_text ?? undefined,
    cloze_ordinal: row.cloze_ordinal,
  };
}

export const occlusionService = {
  async createNote(params: { noteId: string; masks: OcclusionMask[] }) {
    if (!params.noteId || !params.masks.length) throw new Error('OCCLUSION_INPUT_REQUIRED');
    const boxes = params.masks.map((mask, index) => {
      if (mask.x < 0 || mask.y < 0 || mask.w <= 0 || mask.h <= 0 || mask.x + mask.w > 100 || mask.y + mask.h > 100) {
        throw new Error('OCCLUSION_BOXES_MUST_BE_PERCENTAGES');
      }
      return {
        cloze_ordinal: mask.cloze_ordinal ?? index + 1,
        label_text: mask.label ?? null,
        x_pos: mask.x,
        y_pos: mask.y,
        width_pct: mask.w,
        height_pct: mask.h,
        metadata: {},
      };
    });
    const { data, error } = await createClient().rpc('create_image_occlusion_note', { p_note_id: params.noteId, p_boxes: boxes });
    if (error) throw error;
    return data as Array<{ card_id: string; cloze_ordinal: number }>;
  },
  async listMasks(noteId: string): Promise<OcclusionMask[]> {
    const { data, error } = await createClient()
      .from('note_image_occlusion_boxes')
      .select('x_pos,y_pos,width_pct,height_pct,label_text,cloze_ordinal')
      .eq('note_id', noteId)
      .order('cloze_ordinal', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toMask);
  },
};

export async function createImageOcclusionNote(noteId: string, masks: OcclusionMask[]) {
  return occlusionService.createNote({ noteId, masks });
}
