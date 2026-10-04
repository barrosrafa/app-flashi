'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { getAuthErrorMessage } from '../../../lib/auth-messages';
import { createClient, isSupabaseConfigured } from '../../../lib/supabase/client';
export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setSuccess(false);
    if (password !== confirmation) { setMessage('As senhas não são iguais. Confira e tente novamente.'); return; }
    setBusy(true);
    try {
      if (!isSupabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setMessage('Senha atualizada. Agora você já pode entrar com sua nova senha.'); setSuccess(true);
    } catch (error: unknown) { setMessage(getAuthErrorMessage(error, 'reset')); }
    finally { setBusy(false); }
  }
  return <main className="auth"><section className="card auth-card">
    <Link className="brand auth-brand" href="/" aria-label="Flashi, página inicial">flash<span>i</span></Link>
    <p className="eyebrow">Nova senha</p><h1>Escolha uma senha nova.</h1><p className="subtitle">Use pelo menos 8 caracteres e confirme para concluir a recuperação.</p>
    <form className="form auth-form" onSubmit={submit} aria-busy={busy}><div className="field"><label htmlFor="new-password">Nova senha</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div><div className="field"><label htmlFor="confirm-password">Confirmar senha</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div><button className="btn" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Atualizar senha'}</button>{message && <p className={`notice ${success ? 'success' : 'error'}`} role={success ? 'status' : 'alert'}>{message}</p>}{success && <Link className="btn secondary" href="/login">Ir para entrar</Link>}</form>
  </section></main>;
}
