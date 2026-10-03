'use client';
import { useEffect, useState } from 'react';
export function RateLimitBanner({ retryAfterSec, onExpire }: { retryAfterSec: number; onExpire?: () => void }) { const [left, setLeft] = useState(Math.max(0, retryAfterSec)); useEffect(() => { if (left <= 0) { onExpire?.(); return; } const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [left, onExpire]); if (left <= 0) return null; return <div className="notice" role="alert">Limite de uso atingido. Tente novamente em <strong>{left}s</strong>.</div>; }
