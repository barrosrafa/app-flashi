'use client';

import { useState } from 'react';
import { useDeckCollaborators } from '../../hooks/useDeckCollaborators';
import type { CollaborationInvite, DeckRole } from '../../lib/types/collaborator';

function inviteErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === 'COLLABORATION_INVITE_EMAIL_REQUIRED') return 'Informe um email para criar o convite.';
  if (error instanceof Error && error.message === 'COLLABORATION_INVITE_INPUT_INVALID') return 'Confira o email e os limites de nome/contexto.';
  return 'Não foi possível criar o convite. Verifique se você é o dono do deck.';
}

export function CollaboratorManager({ deckId }: { deckId: string }) {
  const { items, loading, error, createInvite, updateRole, remove } = useDeckCollaborators(deckId);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [context, setContext] = useState('');
  const [role, setRole] = useState<DeckRole>('viewer');
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState<CollaborationInvite | null>(null);
  const [busy, setBusy] = useState(false);

  async function createPendingInvite() {
    setBusy(true);
    setMessage('');
    setInvite(null);
    try {
      const created = await createInvite({ email, displayName, context, role });
      setInvite(created);
      setEmail('');
      setDisplayName('');
      setContext('');
      setMessage('Convite pendente criado. Nenhum email foi enviado.');
    } catch (inviteCreationError) {
      setMessage(inviteErrorMessage(inviteCreationError));
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteToken() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.invite_token);
      setMessage('Token de convite copiado. Compartilhe-o apenas com a pessoa convidada.');
    } catch {
      setMessage('Não foi possível copiar automaticamente; selecione o token pendente.');
    }
  }

  return <section className="card" aria-labelledby="collaborators-heading">
    <div className="section-head"><div><h2 id="collaborators-heading">Colaboradores</h2><p className="subtitle">Crie um convite por email, nome e contexto, sem compartilhar UUIDs.</p></div></div>
    {error && <p className="notice error" role="alert">Não foi possível carregar colaboradores.</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {invite && <div className="notice" role="status">
      <strong>Convite pendente, válido até {new Date(invite.expires_at).toLocaleString('pt-BR')}.</strong>
      <p>Nenhum provedor de email está configurado. Copie o token e envie-o por um canal seguro; ele é de uso único.</p>
      <code style={{ display: 'block', overflowWrap: 'anywhere', margin: '8px 0' }}>{invite.invite_token}</code>
      <button className="btn secondary" type="button" onClick={() => void copyInviteToken()}>Copiar convite</button>
    </div>}
    {loading ? <p className="muted">Carregando…</p> : <ul className="divide-y">{items.map((item, index) => <li key={item.user_id} className="flex items-center justify-between py-2"><span>Colaborador {index + 1}</span><select aria-label={`Permissão do colaborador ${index + 1}`} value={item.role} onChange={(e) => void updateRole(item.user_id, e.target.value as DeckRole)}><option value="viewer">Viewer</option><option value="editor">Editor</option></select><button className="link-button" type="button" onClick={() => void remove(item.user_id)}>Remover</button></li>)}</ul>}
    <div className="form" style={{ marginTop: 16 }}>
      <label htmlFor="collaborator-email">Email<input id="collaborator-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@exemplo.com" required /></label>
      <label htmlFor="collaborator-name">Nome (opcional)<input id="collaborator-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} placeholder="Como identificar a pessoa" /></label>
      <label htmlFor="collaborator-context">Contexto (opcional)<textarea id="collaborator-context" value={context} onChange={(e) => setContext(e.target.value)} maxLength={500} rows={3} placeholder="Ex.: revisão do deck de idiomas" /></label>
      <label htmlFor="collaborator-role">Permissão<select id="collaborator-role" value={role} onChange={(e) => setRole(e.target.value as DeckRole)}><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label>
      <button className="btn" type="button" onClick={() => void createPendingInvite()} disabled={busy || !email.trim()}>{busy ? 'Criando convite…' : 'Criar convite pendente'}</button>
      <small className="status-text">O dono do deck é autorizado no servidor. O backend não verifica nem revela se o email já possui conta.</small>
    </div>
  </section>;
}
