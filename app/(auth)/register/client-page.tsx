'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { getAuthErrorMessage } from '../../../lib/auth-messages';
import { createClient } from '../../../lib/supabase/client';
export default function Register() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage('Criando sua conta…');
    setSuccess(false);
    try {
      const { error } = await createClient().auth.signUp({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        options: { data: { full_name: String(form.get('name') ?? '') } },
      });
      setMessage(error ? getAuthErrorMessage(error, 'register') : 'Conta criada. Verifique seu e-mail para confirmar o acesso.');
      setSuccess(!error);
    } catch (error: unknown) {
      setMessage(getAuthErrorMessage(error, 'register'));
    } finally {
      setLoading(false);
    }
  }
  return <main className="auth"><div className="card auth-card">
    <Link className="brand auth-brand" href="/" aria-label="Flashi, ir para a página inicial">flash<span>i</span></Link>
    <div className="eyebrow">Comece sua jornada</div>
    <h1>Aprenda algo hoje.</h1>
    <p className="subtitle">Crie sua conta e leve seus cartões com você, até quando estiver offline.</p>
    <form onSubmit={submit} aria-busy={loading}>
      <div className="field"><label htmlFor="register-name">Nome</label><input id="register-name" name="name" required placeholder="Seu nome" autoComplete="name" /></div>
      <div className="field"><label htmlFor="register-email">E-mail</label><input id="register-email" name="email" type="email" required placeholder="voce@email.com" autoComplete="email" /></div>
      <div className="field"><label htmlFor="register-password">Senha</label><input id="register-password" name="password" type="password" minLength={6} required placeholder="Mínimo de 6 caracteres" autoComplete="new-password" /><span className="status-text">Use pelo menos 6 caracteres.</span></div>
      <button className="btn" type="submit" disabled={loading}>{loading ? 'Criando conta…' : 'Criar conta'}</button>
      {message && <div className={`notice ${success ? 'success' : message === 'Criando sua conta…' ? '' : 'error'}`} role={success || message === 'Criando sua conta…' ? 'status' : 'alert'} aria-live="polite">{message}</div>}
    </form>
    <p className="subtitle auth-switch">Já tem conta? <Link href="/login" className="inline-link">Entrar</Link></p>
  </div></main>;
}
