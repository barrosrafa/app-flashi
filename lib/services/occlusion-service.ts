import { createClient } from '../supabase/client';

/** Coordinates are always canonical percentages: 30 means 30%, not 0.3%. */
export type OcclusionMask = {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  cloze_ordinal?: number;
};

export type OcclusionMaskInput = OcclusionMask & { unit?: 'percent' | 'fraction' };
export type OcclusionCreationResult = {
  cards: Array<{ card_id: string; cloze_ordinal: number }>;
  assetId?: string;
  noteId: string;
  deckId?: string;
  masks: OcclusionMask[];
  status: string;
  code: string;
  requestId: string;
};

export class OcclusionRpcError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;
  readonly details?: string;
  readonly hint?: string;

  constructor(message: string, metadata: { code: string; status: number; requestId: string; details?: string; hint?: string; cause?: unknown }) {
    super(message, { cause: metadata.cause });
    this.name = 'OcclusionRpcError';
    this.code = metadata.code;
    this.status = metadata.status;
    this.requestId = metadata.requestId;
    this.details = metadata.details;
    this.hint = metadata.hint;
  }
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `occlusion-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorField(error: unknown, key: string): unknown {
  return error && typeof error === 'object' ? (error as Record<string, unknown>)[key] : undefined;
}

function extractRequestId(error: unknown, fallback: string) {
  const direct = errorField(error, 'requestId') ?? errorField(error, 'request_id');
  if (typeof direct === 'string' && direct) return direct;
  const details = errorField(error, 'details');
  const match = typeof details === 'string' ? details.match(/request_id[=:]([\w-]+)/i) : null;
  return match?.[1] ?? fallback;
}

function rpcError(error: unknown, fallbackRequestId: string) {
  const code = typeof errorField(error, 'code') === 'string' ? String(errorField(error, 'code')) : 'OCCLUSION_RPC_FAILED';
  const rawStatus = errorField(error, 'status') ?? errorField(error, 'statusCode') ?? errorField(error, 'httpStatus');
  const status = typeof rawStatus === 'number' ? rawStatus : code === 'AUTH_REQUIRED' ? 401 : 400;
  const details = typeof errorField(error, 'details') === 'string' ? String(errorField(error, 'details')) : undefined;
  const hint = typeof errorField(error, 'hint') === 'string' ? String(errorField(error, 'hint')) : undefined;
  const rawMessage = typeof errorField(error, 'message') === 'string' ? String(errorField(error, 'message')) : 'Não foi possível criar os cartões de oclusão.';
  return new OcclusionRpcError(rawMessage, { code, status, requestId: extractRequestId(error, fallbackRequestId), details, hint, cause: error });
}

function percent(value: unknown, field: string, unit: 'percent' | 'fraction' = 'percent') {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`OCCLUSION_${field.toUpperCase()}_INVALID`);
  // Fraction conversion is explicit for legacy callers; the default is percent.
  const canonical = unit === 'fraction' ? number * 100 : number;
  return Math.round(canonical * 1000) / 1000;
}

export function normalizeMask(mask: OcclusionMaskInput): OcclusionMask {
  const unit = mask.unit ?? 'percent';
  return {
    x: percent(mask.x, 'x', unit),
    y: percent(mask.y, 'y', unit),
    w: percent(mask.w, 'width', unit),
    h: percent(mask.h, 'height', unit),
    label: mask.label,
    cloze_ordinal: mask.cloze_ordinal,
  };
}

export function normalizeMasks(masks: OcclusionMaskInput[]) {
  if (!masks.length) throw new Error('OCCLUSION_INPUT_REQUIRED');
  return masks.map((input, index) => {
    const mask = normalizeMask(input);
    if (mask.x < 0 || mask.y < 0 || mask.w <= 0 || mask.h <= 0 || mask.x + mask.w > 100 || mask.y + mask.h > 100) {
      throw new Error('OCCLUSION_BOXES_MUST_BE_PERCENTAGES');
    }
    return {
      ...mask,
      cloze_ordinal: mask.cloze_ordinal ?? index + 1,
    };
  });
}

function toMask(row: { x_pos: number; y_pos: number; width_pct: number; height_pct: number; label_text: string | null; cloze_ordinal: number }): OcclusionMask {
  return normalizeMask({
    x: Number(row.x_pos),
    y: Number(row.y_pos),
    w: Number(row.width_pct),
    h: Number(row.height_pct),
    label: row.label_text ?? undefined,
    cloze_ordinal: row.cloze_ordinal,
  });
}

export function actionableOcclusionError(error: unknown) {
  if (!(error instanceof OcclusionRpcError)) return error instanceof Error ? error.message : 'Não foi possível criar os cartões de oclusão.';
  const messages: Record<string, string> = {
    OCCLUSION_NOTE_OR_DECK_NOT_OWNED: 'A nota não existe ou não pertence a este deck. Confirme a nota e o deck selecionados.',
    OCCLUSION_ASSET_NOT_FOUND_OR_NOT_OWNED: 'O upload não está mais disponível para esta conta. Envie a imagem novamente.',
    OCCLUSION_MASKS_MUST_BE_PERCENTAGES: 'Revise as caixas: posição e tamanho devem estar entre 0 e 100% e caber na imagem.',
    OCCLUSION_MASKS_REQUIRED: 'Desenhe pelo menos uma caixa antes de criar os cartões.',
    AUTH_REQUIRED: 'Sua sessão expirou. Entre novamente e tente criar os cartões.',
  };
  const base = messages[error.code] ?? error.message;
  return `${base} (código ${error.code}, status ${error.status}, requestId ${error.requestId})`;
}

export const occlusionService = {
  async createNote(params: { noteId: string; masks: OcclusionMaskInput[]; deckId?: string; assetId?: string; requestId?: string }): Promise<OcclusionCreationResult> {
    const masks = normalizeMasks(params.masks);
    if (!params.noteId) throw new Error('OCCLUSION_INPUT_REQUIRED');
    const correlationId = params.requestId ?? requestId();
    const boxes = masks.map((mask) => ({
      cloze_ordinal: mask.cloze_ordinal,
      label_text: mask.label ?? null,
      x_pos: mask.x,
      y_pos: mask.y,
      width_pct: mask.w,
      height_pct: mask.h,
      metadata: {},
    }));
    try {
      const client = createClient();
      if (params.deckId && params.assetId) {
        const { data, error } = await client.rpc('create_image_occlusion_note', {
          p_asset_id: params.assetId,
          p_boxes: boxes,
          p_deck_id: params.deckId,
          p_note_id: params.noteId,
          p_request_id: correlationId,
        });
        if (error) throw rpcError(error, correlationId);
        const rows = (data ?? []) as Array<{ card_id: string; cloze_ordinal: number; asset_id: string; note_id: string; deck_id: string; status: string; code: string; request_id: string }>;
        return {
          cards: rows.map(({ card_id, cloze_ordinal }) => ({ card_id, cloze_ordinal })),
          assetId: rows[0]?.asset_id ?? params.assetId,
          noteId: rows[0]?.note_id ?? params.noteId,
          deckId: rows[0]?.deck_id ?? params.deckId,
          masks,
          status: rows[0]?.status ?? 'created',
          code: rows[0]?.code ?? 'OCCLUSION_CARDS_CREATED',
          requestId: rows[0]?.request_id ?? correlationId,
        };
      }
      const { data, error } = await (client as any).rpc('create_image_occlusion_note', { p_note_id: params.noteId, p_boxes: boxes });
      if (error) throw rpcError(error, correlationId);
      const rows = (data ?? []) as Array<{ card_id: string; cloze_ordinal: number }>;
      return { cards: rows, noteId: params.noteId, masks, status: 'created', code: 'OCCLUSION_CARDS_CREATED', requestId: correlationId };
    } catch (error) {
      throw error instanceof OcclusionRpcError ? error : rpcError(error, correlationId);
    }
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

export async function createImageOcclusionNote(noteId: string, masks: OcclusionMaskInput[], context?: { deckId?: string; assetId?: string; requestId?: string }) {
  return occlusionService.createNote({ noteId, masks, ...context });
}
