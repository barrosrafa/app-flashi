'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { getAuthErrorMessage } from '../../../lib/auth-messages';
import { createClient, isSupabaseConfigured } from '../../../lib/supabase/client';
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setSuccess(false);
    try {
      if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setMessage('Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'); setSuccess(true);
    } catch (error: unknown) { setMessage(getAuthErrorMessage(error, 'recovery')); }
    finally { setBusy(false); }
  }
  return <main className="auth"><section className="card auth-card">
    <Link className="brand auth-brand" href="/" aria-label="Flashi, página inicial">flash<span>i</span></Link>
    <p className="eyebrow">Recuperação de acesso</p><h1>Vamos recuperar sua conta.</h1><p className="subtitle">Informe o e-mail usado no cadastro. Se houver uma conta, enviaremos as instruções.</p>
    <form className="form auth-form" onSubmit={submit} aria-busy={busy}><div className="field"><label htmlFor="recovery-email">E-mail</label><input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><button className="btn" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar instruções'}</button>{message && <p className={`notice ${success ? 'success' : 'error'}`} role={success ? 'status' : 'alert'}>{message}</p>}</form>
    <p className="subtitle auth-switch"><Link className="inline-link" href="/login">Voltar para entrar</Link></p>
  </section></main>;
}
