import { createClient, type Tables } from '../supabase/client';
import type { Database, Json } from '../../src/types/database';
import { hasBrowserSession } from '../supabase/guards';

export type ExamPriority = Database['public']['Enums']['exam_priority_level'];
export type DeckExam = Tables<'deck_exams'>;
export type StudyQueueItem = {
  card_id: string; deck_id: string; fields: Json;
  state: Database['public']['Enums']['card_state']; due_at: string; interval_days: number;
  exam_id: string | null; exam_name: string | null; target_date: string | null; days_remaining: number | null; scheduling_factor: number | null;
};

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
  async create(input: { user_id: string; deck_id: string; exam_name: string; target_date: string; priority_level: ExamPriority }) {
    const { data, error } = await createClient().from('deck_exams').insert({ ...input, status: 'active' }).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: Partial<DeckExam>) {
    const { data, error } = await createClient().from('deck_exams').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string) {
    const { error } = await createClient().from('deck_exams').update({ status: 'completed' }).eq('id', id);
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
  return examService.create({ user_id: user.id, deck_id: deckId, exam_name: examName, target_date: targetDate, priority_level: priorityLevel });
}
export async function listDeckExams() { return examService.list(undefined, true); }
export async function getStudyQueueWithExamSchedule(deckId: string | null, limit = 40) { return examService.schedule(deckId, limit); }
