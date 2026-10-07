'use client';
/* eslint-disable @next/next/no-img-element -- Private signed media must not be proxied/cached by an image optimizer; occlusion uses exact image geometry. */


import { useState } from 'react';
import type { OcclusionMask } from '../lib/services/occlusion-service';

export function OcclusionCard({
  imageUrl,
  masks,
  revealAll = false,
  onRevealAll,
}: {
  imageUrl: string;
  masks: OcclusionMask[];
  revealAll?: boolean;
  onRevealAll?: () => void;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  return (
    <div className="occlusion-card">
      <img src={imageUrl} alt="Cartão com oclusões para revisar" />
      {masks.map((mask, index) => {
        const isRevealed = revealAll || revealed.has(index);
        return (
          <button
            type="button"
            key={`${mask.cloze_ordinal ?? index + 1}-${index}`}
            aria-label={`Revelar oclusão ${index + 1}`}
            aria-pressed={isRevealed}
            onClick={() => {
              if (revealAll && onRevealAll) onRevealAll();
              setRevealed((old) => {
                const next = new Set(old);
                if (isRevealed) next.delete(index);
                else next.add(index);
                return next;
              });
            }}
            className={`occlusion-card__mask${isRevealed ? ' is-revealed' : ''}`}
            style={{ left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.w}%`, height: `${mask.h}%` }}
          >
            {isRevealed && mask.label ? mask.label : ''}
          </button>
        );
      })}
    </div>
  );
}
