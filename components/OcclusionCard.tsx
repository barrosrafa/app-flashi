'use client';
import { useState } from 'react';
import type { OcclusionMask } from '../lib/services/occlusion-service';
export function OcclusionCard({ imageUrl, masks, revealAll = false, onRevealAll }: { imageUrl: string; masks: OcclusionMask[]; revealAll?: boolean; onRevealAll?: () => void }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  return <div className="relative" style={{ position: 'relative' }}><img src={imageUrl} alt="Cartão com oclusão" className="block w-full" style={{ width: '100%', display: 'block' }} />{masks.map((mask, index) => { const isRevealed = revealAll || revealed.has(index); return <button type="button" key={index} aria-label={`Revelar oclusão ${index + 1}`} onClick={() => { if (onRevealAll && revealAll) onRevealAll(); setRevealed((old) => { const next = new Set(old); isRevealed ? next.delete(index) : next.add(index); return next; }); }} className={`absolute border border-white ${isRevealed ? 'bg-transparent' : 'bg-black/85'}`} style={{ position: 'absolute', left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.w}%`, height: `${mask.h}%` }}>{isRevealed && mask.label ? mask.label : ''}</button>; })}</div>;
}
