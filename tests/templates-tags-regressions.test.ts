import { describe, expect, it } from 'vitest';
import { templateEditPath } from '../lib/services/template-service';
import { claimSubmission, normalizeTagName, releaseSubmission, tagErrorMessage } from '../lib/services/tag-service';
import { renderCard } from '../lib/services/template-renderer';
import { validateTemplate } from '../lib/validation-template-schema';

describe('F22 - criação de template usa o registro persistido', () => {
  it('monta a rota de edição com o ID retornado pelo backend', () => {
    expect(templateEditPath('template-42')).toBe('/templates/template-42/edit');
  });
});

describe('F23 - preview fiel e validação de placeholders', () => {
  it('renderiza frente e verso de todas as gerações com o renderer real', () => {
    expect(renderCard({ field_definitions: [{ name: 'Front' }, { name: 'Back' }], card_generation: [{ name: 'normal', front: '{{Front}}', back: '{{Back}}' }, { name: 'reverse', front: '{{Back}}', back: '{{Front}}' }] }, { Front: 'A', Back: 'B' })).toEqual([
      { name: 'normal', front: 'A', back: 'B' },
      { name: 'reverse', front: 'B', back: 'A' },
    ]);
  });

  it('rejeita placeholder desconhecido e token incompleto sem alterar a geração válida', () => {
    const errors = validateTemplate({ name: 'Básico', field_definitions: [{ name: 'Front' }], card_generation: [{ front: '{{Missing}}', back: '{{Front' }] });
    expect(errors).toContain('Campo "Missing" referenciado na regra não existe');
    expect(errors.some((error) => error.includes('Placeholder inválido'))).toBe(true);
  });
});

describe('F24 - tags canônicas e mensagens acionáveis', () => {
  it('normaliza Unicode, espaços e caixa antes do upsert', () => {
    expect(normalizeTagName('  React\u00a0  Avançado  ')).toBe('react avançado');
  });

  it('traduz erros conhecidos de tag sem esconder a possibilidade de retry', () => {
    expect(tagErrorMessage(new Error('TAG_NAME_REQUIRED'))).toBe('Informe um nome para a tag.');
    expect(tagErrorMessage(new Error('UNKNOWN'))).toContain('Tente novamente');
  });
});

describe('F43 - submissões simultâneas são bloqueadas sincronicamente', () => {
  it('recusa a segunda tentativa antes de qualquer await e libera o retry após erro', () => {
    const ref = { current: false };
    expect(claimSubmission(ref)).toBe(true);
    expect(claimSubmission(ref)).toBe(false);
    releaseSubmission(ref);
    expect(claimSubmission(ref)).toBe(true);
  });
});
