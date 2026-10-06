'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../contexts/LanguageContext';
import { translateUiText } from '../contexts/autoTranslations';
import { edgeErrorBus } from '../lib/services/http/event-bus';
import { RateLimitError } from '../lib/services/http/errors';
export function EdgeErrorNotice() {
  const { locale } = useTranslation();
  const pathname = usePathname();
  const [message, setMessage] = useState('');
  useEffect(() => { setMessage(''); }, [pathname]);
  useEffect(() => { const unsubscribeError = edgeErrorBus.subscribe((error) => { const payload = error.payload; const requestId = typeof payload === 'object' && payload !== null && 'request_id' in payload ? String((payload as { request_id?: unknown }).request_id ?? '') : ''; const suffix = requestId ? ` Código de atendimento: ${requestId.slice(0, 24)}.` : ''; setMessage(error instanceof RateLimitError ? `Limite atingido em ${error.fn}. Tente novamente em ${error.retryAfterSec}s.${suffix}` : error.status === 401 ? 'Inicie sessão para continuar.' : `Não foi possível concluir ${error.fn}.${suffix}`); }); const unsubscribeClear = edgeErrorBus.subscribeClear(() => setMessage('')); return () => { unsubscribeError(); unsubscribeClear(); }; }, []);
  if (!message) return null;
  return <div className="notice error" role="alert" onClick={() => setMessage('')}>{translateUiText(message, locale)}</div>;
}
