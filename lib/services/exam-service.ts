import { createClient, type Tables } from '../supabase/client';
import type { Database, Json } from '../../src/types/database';
import { hasBrowserSession } from '../supabase/guards';

export type ExamPriority = Database['public']['Enums']['exam_priority_level'];
export type DeckExam = Tables<'deck_exams'>;
export type ExamStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type DeckExamPatch = Partial<Pick<DeckExam, 'exam_name' | 'deck_id' | 'target_date' | 'priority_level'>> & {
  status?: ExamStatus;
};
export type StudyQueueItem = {
  card_id: string; deck_id: string; fields: Json;
  state: Database['public']['Enums']['card_state']; due_at: string; interval_days: number;
  exam_id: string | null; exam_name: string | null; target_date: string | null; days_remaining: number | null; scheduling_factor: number | null;
};

const pendingExamIds = new Map<string, string>();

export const examService = {
  async list(userId?: string, activeOnly = true) {
    if (!(await hasBrowserSession())) throw new Error('AUTH_REQUIRED');
    let query = createClient().from('deck_exams').select('*').order('target_date', { ascending: true });
    if (userId) query = query.eq('user_id', userId);
    if (activeOnly) query = query.eq('status', 'active');
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
  async create(input: { id?: string; user_id: string; deck_id: string; exam_name: string; target_date: string; priority_level: ExamPriority }) {
    const { data, error } = await createClient().from('deck_exams').upsert({ ...input, status: 'active' }, { onConflict: 'id' }).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: DeckExamPatch) {
    if (!(await hasBrowserSession())) throw new Error('AUTH_REQUIRED');
    const { data, error } = await createClient().rpc('update_deck_exam', {
      p_exam_id: id,
      p_exam_name: patch.exam_name ?? undefined,
      p_deck_id: patch.deck_id ?? undefined,
      p_target_date: patch.target_date ?? undefined,
      p_priority_level: patch.priority_level ?? undefined,
      p_status: patch.status ?? undefined,
    });
    if (error) throw error;
    return data as unknown as DeckExam;
  },
  async remove(id: string) {
    if (!(await hasBrowserSession())) throw new Error('AUTH_REQUIRED');
    const { error } = await createClient().from('deck_exams').delete().eq('id', id);
    if (error) throw error;
  },
  async schedule(deckId: string | null, limit = 50) {
    const params = { ...(deckId ? { p_deck_id: deckId } : {}), p_limit: limit } satisfies Database['public']['Functions']['get_due_cards_with_exam_schedule']['Args'];
    const { data, error } = await createClient().rpc('get_due_cards_with_exam_schedule', params);
    if (error) throw error;
    return (data ?? []) as StudyQueueItem[];
  },
};

export async function createDeckExam(deckId: string, examName: string, targetDate: string, priorityLevel: ExamPriority) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const key = JSON.stringify([user.id,deckId,examName.trim(),targetDate,priorityLevel]);
  const id = pendingExamIds.get(key) ?? crypto.randomUUID();
  pendingExamIds.set(key,id);
  const result = await examService.create({ id, user_id: user.id, deck_id: deckId, exam_name: examName.trim(), target_date: targetDate, priority_level: priorityLevel });
  pendingExamIds.delete(key);
  return result;
}
export async function listDeckExams(activeOnly = false) { return examService.list(undefined, activeOnly); }
export async function updateDeckExam(id: string, patch: DeckExamPatch) { return examService.update(id, patch); }
export async function pauseDeckExam(id: string) { return examService.update(id, { status: 'paused' }); }
export async function completeDeckExam(id: string) { return examService.update(id, { status: 'completed' }); }
export async function cancelDeckExam(id: string) { return examService.update(id, { status: 'cancelled' }); }
export async function reactivateDeckExam(id: string, priorityLevel: ExamPriority = 'currently_studying') {
  return examService.update(id, { status: 'active', priority_level: priorityLevel === 'paused' ? 'currently_studying' : priorityLevel });
}
export async function removeDeckExam(id: string) { return examService.remove(id); }
export async function getStudyQueueWithExamSchedule(deckId: string | null, limit = 40) { return examService.schedule(deckId, limit); }
