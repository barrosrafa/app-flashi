'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { requestedReturnTo, safeReturnTo } from '../../../lib/auth/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [returnTo, setReturnTo] = useState('/');

  useEffect(() => {
    let active = true;
    const destination = requestedReturnTo(window.location.search);
    setReturnTo(destination);
    void createClient().auth.getUser().then(({ data, error }) => {
      if (active && !error && data.user) window.location.replace(destination);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('Entrando…');
    setSuccess(false);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      const destination = safeReturnTo(new URLSearchParams(window.location.search).get('next'));
      setMessage('Login realizado. Redirecionando…');
      setSuccess(true);
      window.location.replace(destination);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth"><div className="card auth-card">
    <Link className="brand auth-brand" href="/" aria-label="Flashi, ir para a página inicial">flash<span>i</span></Link>
    <div className="eyebrow">Bem-vindo de volta</div>
    <h1>Seu próximo cartão começa aqui.</h1>
    <p className="subtitle">Entre para sincronizar seus decks em todos os dispositivos.</p>
    <form onSubmit={submit} aria-busy={loading}>
      <div className="field"><label htmlFor="login-email">E-mail</label><input id="login-email" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" autoComplete="email" /></div>
      <div className="field"><label htmlFor="login-password">Senha</label><input id="login-password" name="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></div>
      <button className="btn" type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
      {message && <div className={`notice ${success ? 'success' : message === 'Entrando…' ? '' : 'error'}`} role={success ? 'status' : 'alert'} aria-live="polite">{message}</div>}
    </form>
    <p className="subtitle auth-switch">Ainda não tem conta? <Link href={`/register?next=${encodeURIComponent(returnTo)}`} className="inline-link">Criar agora</Link></p>
  </div></main>;
}
