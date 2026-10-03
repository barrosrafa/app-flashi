'use client';
import { useEffect, useState } from 'react';
import { edgeErrorBus } from '../lib/services/http/event-bus';
import { RateLimitError } from '../lib/services/http/errors';
export function EdgeErrorNotice() {
  const [message, setMessage] = useState('');
  useEffect(() => edgeErrorBus.subscribe(({ error, fn }) => setMessage(error instanceof RateLimitError ? `Limite atingido em ${fn}. Tente novamente em ${error.retryAfterSec || 1}s.` : `Não foi possível concluir ${fn}. Tente novamente.`)), []);
  if (!message) return null;
  return <div className="notice error" role="alert" onClick={() => setMessage('')}>{message}</div>;
}
