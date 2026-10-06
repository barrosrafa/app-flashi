/**
 * F07 — meta de estudo.
 *
 * O formulário de metas fazia `formElement.reset()` dentro do mesmo `try` da
 * persistência. Se o reset falhasse, o usuário via "Não foi possível salvar a
 * meta." mesmo com a meta já gravada. Aqui a limpeza do formulário é uma etapa
 * posterior e isolada: ela nunca pode transformar um sucesso em erro.
 */
export type ExamGoalResult<T> = { ok: true; created: T } | { ok: false; error: unknown };

export async function createExamGoal<T>(options: {
  create: () => Promise<T>;
  onCreated: (created: T) => void;
  resetForm: () => void;
}): Promise<ExamGoalResult<T>> {
  let created: T;
  try {
    created = await options.create();
  } catch (error) {
    return { ok: false, error };
  }

  options.onCreated(created);

  try {
    options.resetForm();
  } catch {
    // F07: a meta já está confirmada no servidor; uma falha de limpeza do
    // formulário é irrelevante para o resultado da operação.
  }

  return { ok: true, created };
}
