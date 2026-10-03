'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
export function RateLimitBanner({ retryAfterSec, onExpire }: { retryAfterSec: number; onExpire?: () => void }) {
  const { locale } = useTranslation();
  const [left, setLeft] = useState(Math.max(0, retryAfterSec));
  useEffect(() => { if (left <= 0) { onExpire?.(); return; } const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [left, onExpire]);
  if (left <= 0) return null;
  const english = locale === 'en'; const spanish = locale === 'es';
  return <div className="notice" role="alert">{english ? 'Usage limit reached. Try again in ' : spanish ? 'Se alcanzó el límite de uso. Inténtalo de nuevo en ' : 'Limite de uso atingido. Tente novamente em '}<strong>{left}s</strong>.</div>;
}
