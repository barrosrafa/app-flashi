'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.withScope((scope) => { scope.setTag('area', 'app-error-boundary'); if (error.digest) scope.setTag('next_digest', error.digest); Sentry.captureException(error); }); }, [error]);
  return <main className="auth"><section className="card auth-card"><p className="eyebrow">Algo não saiu como esperado</p><h1>Não foi possível abrir esta página.</h1><p className="subtitle">Tente carregar novamente. Se continuar acontecendo, volte ao início e retome por lá.</p><button className="btn" type="button" onClick={() => reset()}>Tentar novamente</button></section></main>;
}
