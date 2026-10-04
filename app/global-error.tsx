'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return <html lang="pt-BR"><body><main className="auth"><section className="card auth-card"><p className="eyebrow">Flashi</p><h1>Ocorreu um erro inesperado.</h1><p>Tente carregar novamente. O erro foi registrado para análise.</p><button className="btn" type="button" onClick={() => reset()}>Tentar novamente</button></section></main></body></html>;
}
