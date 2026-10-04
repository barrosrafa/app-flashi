'use client';
import { useEffect } from 'react';
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Erro de renderização do Flashi:', error); }, [error]);
  return <main className="auth"><section className="card auth-card"><p className="eyebrow">Algo não saiu como esperado</p><h1>Não foi possível abrir esta página.</h1><p className="subtitle">Tente carregar novamente. Se continuar acontecendo, volte ao início e retome por lá.</p><button className="btn" type="button" onClick={() => reset()}>Tentar novamente</button></section></main>;
}
