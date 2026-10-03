'use client';
import { useEffect, useState } from 'react';
import { edgeErrorBus } from '../lib/services/http/event-bus';
import { RateLimitError } from '../lib/services/http/errors';
export function EdgeErrorNotice() { const [message, setMessage] = useState(''); useEffect(() => edgeErrorBus.subscribe((error) => setMessage(error instanceof RateLimitError ? `Limite atingido em ${error.fn}. Tente novamente em ${error.retryAfterSec}s.` : error.status === 401 ? 'Inicie sessão para continuar.' : `Não foi possível concluir ${error.fn}.`)), []); if (!message) return null; return <div className="notice error" role="alert" onClick={() => setMessage('')}>{message}</div>; }
