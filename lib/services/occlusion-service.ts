import { enqueueMutation } from '../db/outbox-queue';
export type OcclusionMask = { x: number; y: number; w: number; h: number; label?: string };
export async function createImageOcclusionNote(noteId: string, boxes: OcclusionMask[]) {
  if (!noteId || !boxes.length) throw new Error('OCCLUSION_INPUT_REQUIRED');
  if (boxes.some((box) => [box.x, box.y, box.w, box.h].some((value) => value < 0 || value > 1))) throw new Error('OCCLUSION_BOXES_MUST_BE_PERCENTAGES');
  return enqueueMutation('notes', 'rpc', { p_note_id: noteId, p_boxes: boxes }, { rpc_name: 'create_image_occlusion_note', transport: 'rpc' });
}
