'use client';
/* eslint-disable @next/next/no-img-element -- Private signed media must not be proxied/cached by an image optimizer; occlusion uses exact image geometry. */


import { useRef, useState, type PointerEvent } from 'react';
import { normalizeMask, type OcclusionMask } from '../lib/services/occlusion-service';

type Point = { x: number; y: number };
type DragMode = 'create' | 'move' | 'resize';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function OcclusionEditor({
  imageUrl,
  value,
  onChange,
}: {
  imageUrl: string;
  value: OcclusionMask[];
  onChange: (masks: OcclusionMask[]) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<OcclusionMask | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const start = useRef<Point | null>(null);
  const mode = useRef<DragMode>('create');
  const origin = useRef<OcclusionMask | null>(null);

  function point(event: PointerEvent<HTMLDivElement>): Point | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  function hitTest(position: Point) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const mask = value[index];
      if (
        position.x >= mask.x && position.x <= mask.x + mask.w &&
        position.y >= mask.y && position.y <= mask.y + mask.h
      ) return index;
    }
    return -1;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const position = point(event);
    if (!position) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = position;
    const index = hitTest(position);

    if (index >= 0) {
      const mask = value[index];
      setSelected(index);
      origin.current = mask;
      const nearBottomRight = position.x >= mask.x + mask.w - 4 && position.y >= mask.y + mask.h - 4;
      mode.current = nearBottomRight ? 'resize' : 'move';
      return;
    }

    setSelected(null);
    origin.current = null;
    mode.current = 'create';
    setDraft({ x: position.x, y: position.y, w: 0, h: 0, cloze_ordinal: value.length + 1 });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const position = point(event);
    if (!position) return;

    if (mode.current === 'create') {
      const first = start.current;
      setDraft((current) => current ? {
        ...current,
        x: Math.min(first.x, position.x),
        y: Math.min(first.y, position.y),
        w: Math.abs(position.x - first.x),
        h: Math.abs(position.y - first.y),
      } : current);
      return;
    }

    if (selected === null || !origin.current) return;
    const original = origin.current;
    const dx = position.x - start.current.x;
    const dy = position.y - start.current.y;
    const next = normalizeMask(mode.current === 'resize'
      ? {
          ...original,
          w: clamp(original.w + dx, 1, 100 - original.x),
          h: clamp(original.h + dy, 1, 100 - original.y),
        }
      : {
          ...original,
          x: clamp(original.x + dx, 0, 100 - original.w),
          y: clamp(original.y + dy, 0, 100 - original.h),
        });
    onChange(value.map((mask, index) => index === selected ? next : mask));
    start.current = position;
    origin.current = next;
  }

  function finishPointer() {
    if (draft && draft.w >= 1 && draft.h >= 1) {
      onChange([...value, normalizeMask({ ...draft, cloze_ordinal: value.length + 1 })]);
      setSelected(value.length);
    }
    start.current = null;
    origin.current = null;
    setDraft(null);
  }

  function addRegion() {
    const offset = (value.length * 7) % 45;
    const region: OcclusionMask = {
      x: 10 + offset,
      y: 10 + offset,
      w: 25,
      h: 20,
      cloze_ordinal: value.length + 1,
    };
    onChange([...value, normalizeMask(region)]);
    setSelected(value.length);
  }

  function updateRegion(index: number, patch: Partial<Pick<OcclusionMask, 'x' | 'y' | 'w' | 'h'>>) {
    const current = value[index];
    if (!current) return;
    const x = clamp(patch.x ?? current.x, 0, 99);
    const y = clamp(patch.y ?? current.y, 0, 99);
    const w = clamp(patch.w ?? current.w, 1, 100 - x);
    const h = clamp(patch.h ?? current.h, 1, 100 - y);
    onChange(value.map((mask, itemIndex) => itemIndex === index
      ? normalizeMask({ ...mask, x, y, w, h })
      : normalizeMask(mask)));
  }

  function deleteRegion(index: number) {
    const next = value
      .filter((_, itemIndex) => itemIndex !== index)
      .map((mask, itemIndex) => ({ ...mask, cloze_ordinal: itemIndex + 1 }));
    onChange(next);
    setSelected(next.length ? Math.min(index, next.length - 1) : null);
  }

  const visibleMasks = [...value.map((mask) => normalizeMask(mask)), ...(draft ? [normalizeMask(draft)] : [])];
  const selectedMask = selected === null ? undefined : normalizeMask(value[selected]);

  return (
    <section className="occlusion-editor" aria-label="Editor de regiões de oclusão">
      <p className="occlusion-editor__help" id="occlusion-editor-help">
        Arraste sobre a imagem para criar, mover ou redimensionar uma região. Os valores abaixo são percentuais reais: 30 significa 30%.
      </p>
      <div
        ref={canvasRef}
        className="occlusion-editor__canvas"
        aria-describedby="occlusion-editor-help"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        {/* The user-provided image is meaningful content; its surrounding instructions name the task. */}
        <img src={imageUrl} alt="Imagem onde as regiões de oclusão serão posicionadas" draggable={false} />
        {visibleMasks.map((mask, index) => {
          const isDraft = index === value.length;
          const isSelected = index === selected;
          return (
            <div
              key={`${mask.cloze_ordinal ?? index + 1}-${index}`}
              className={`occlusion-editor__mask${isDraft ? ' is-draft' : ''}${isSelected ? ' is-selected' : ''}`}
              aria-hidden="true"
              style={{ left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.w}%`, height: `${mask.h}%` }}
            />
          );
        })}
      </div>

      <div className="occlusion-editor__region-heading">
        <h3>Regiões</h3>
        <button className="btn secondary" type="button" onClick={addRegion}>Adicionar região</button>
      </div>
      {value.length === 0 ? (
        <p className="muted" role="status">Nenhuma região adicionada. Use o botão ou desenhe sobre a imagem.</p>
      ) : (
        <ul className="occlusion-editor__regions">
          {value.map((mask, index) => (
            <li className="occlusion-editor__region" key={`${mask.cloze_ordinal ?? index + 1}-${index}`}>
              <button
                className={`occlusion-editor__select-region${selected === index ? ' active' : ''}`}
                type="button"
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                Caixa {index + 1}
              </button>
              <span className="status-text">{mask.x}%, {mask.y}% · {mask.w} × {mask.h}%</span>
              <button className="link-button" type="button" onClick={() => deleteRegion(index)}>
                Excluir caixa {index + 1}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedMask && selected !== null && (
        <fieldset className="occlusion-editor__coordinates" key={selected}>
          <legend>Posição e tamanho da caixa {selected + 1}</legend>
          <label htmlFor={`occlusion-x-${selected}`}>Esquerda (%)</label>
          <input id={`occlusion-x-${selected}`} type="number" min="0" max={100 - selectedMask.w} step="0.5" value={selectedMask.x} onChange={(event) => updateRegion(selected, { x: Number(event.target.value) })} />
          <label htmlFor={`occlusion-y-${selected}`}>Topo (%)</label>
          <input id={`occlusion-y-${selected}`} type="number" min="0" max={100 - selectedMask.h} step="0.5" value={selectedMask.y} onChange={(event) => updateRegion(selected, { y: Number(event.target.value) })} />
          <label htmlFor={`occlusion-w-${selected}`}>Largura (%)</label>
          <input id={`occlusion-w-${selected}`} type="number" min="1" max={100 - selectedMask.x} step="0.5" value={selectedMask.w} onChange={(event) => updateRegion(selected, { w: Number(event.target.value) })} />
          <label htmlFor={`occlusion-h-${selected}`}>Altura (%)</label>
          <input id={`occlusion-h-${selected}`} type="number" min="1" max={100 - selectedMask.y} step="0.5" value={selectedMask.h} onChange={(event) => updateRegion(selected, { h: Number(event.target.value) })} />
        </fieldset>
      )}
    </section>
  );
}
