/**
 * F08 — entradas de configuração do perfil.
 *
 * Os códigos técnicos (`FSRS_WEIGHTS_INVALID`, `FSRS_PARAMS_INVALID`, ...) eram
 * exibidos crus na interface. `friendlySettingsError` traduz cada um para uma
 * orientação acionável e `csvNumbers` aceita lista vazia (volta ao padrão).
 */
export function csvNumbers(value: string): number[] {
  const text = value.trim();
  if (!text) return [];
  const tokens = text.split(',').map((item) => item.trim());
  if (tokens.some((item) => !item)) throw new Error('FSRS_WEIGHTS_INVALID');
  const numbers = tokens.map(Number);
  if (numbers.some((item) => !Number.isFinite(item))) throw new Error('FSRS_WEIGHTS_INVALID');
  return numbers;
}

export function parseNumberList(value: string): number[] {
  const text = value.trim();
  if (!text) return [];
  const tokens = text.split(',').map((item) => item.trim());
  if (tokens.some((item) => !item)) throw new Error('FSRS_STEPS_INVALID');
  const numbers = tokens.map(Number);
  if (numbers.some((item) => !Number.isFinite(item))) throw new Error('FSRS_STEPS_INVALID');
  return numbers;
}

export function friendlySettingsError(code: string): string {
  const map: Record<string, string> = {
    FSRS_WEIGHTS_INVALID: 'Os pesos FSRS precisam ser 21 números separados por vírgula (ou ficar vazios para o padrão).',
    FSRS_STEPS_INVALID: 'Use apenas números separados por vírgula nos passos de aprendizagem.',
    FSRS_PARAMS_INVALID: 'Os parâmetros FSRS devem ser um JSON válido, por exemplo {}.',
    FSRS_RETENTION_INVALID: 'A retenção desejada deve ficar entre 0,5 e 0,99.',
    FSRS_WEIGHTS_COUNT: 'A otimização precisa de exatamente 21 pesos FSRS.',
  };
  return map[code] ?? code;
}
