import { createClient, type Tables } from '../supabase/client';
import type { Database } from '../../src/types/database';

export type ExamPriority = Database['public']['Enums']['exam_priority_level'];
export type DeckExam = Tables<'deck_exams'>;
export type StudyQueueItem =
  Database['public']['Functions']['get_due_cards_with_exam_schedule']['Returns'][number];

export async function createDeckExam(
  deckId: string,
  examName: string,
  targetDate: string,
  priorityLevel: ExamPriority,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('AUTH_REQUIRED');

  const payload = {
    deck_id: deckId,
    exam_name: examName,
    target_date: targetDate,
    priority_level: priorityLevel,
    status: 'active',
    user_id: user.id,
  } satisfies Database['public']['Tables']['deck_exams']['Insert'];

  const { data, error } = await supabase
    .from('deck_exams')
    .insert(payload)
    .select('id,deck_id,exam_name,target_date,priority_level,status,user_id,created_at,updated_at,usn')
    .single();

  if (error) throw error;
  return data;
}

export async function listDeckExams() {
  const { data, error } = await createClient()
    .from('deck_exams')
    .select('id,deck_id,exam_name,target_date,priority_level,status,user_id,created_at,updated_at,usn')
    .eq('status', 'active')
    .order('target_date', { ascending: true })
    .limit(50);

  if (error) throw error;
  return data;
}

export async function getStudyQueueWithExamSchedule(
  deckId: string | null,
  limit = 40,
) {
  const params = {
    ...(deckId ? { p_deck_id: deckId } : {}),
    p_limit: limit,
  } satisfies Database['public']['Functions']['get_due_cards_with_exam_schedule']['Args'];

  const { data, error } = await createClient().rpc(
    'get_due_cards_with_exam_schedule',
    params,
  );

  if (error) throw error;
  return data ?? [];
}
