'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {AppShell,Topbar} from '../../components/AppShell';
import {isEnabled} from '../../lib/config/feature-flags';
import {listDecks,type Deck} from '../../lib/services/deck-service';
export default function OcclusionPage(){
 const [decks,setDecks]=useState<Deck[]>([]);const [deckId,setDeckId]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{void listDecks().then(setDecks).catch(()=>setError('Não foi possível carregar seus decks. Tente novamente.')).finally(()=>setLoading(false));},[]);
 return <AppShell><Topbar title="Oclusão de imagem" subtitle="Escolha o deck, selecione uma nota e desenhe regiões visíveis sobre a imagem."/>{!isEnabled('occlusion')?<div className="card empty-state">Esta funcionalidade está desativada.</div>:<section className="card form">{loading?<p role="status">Carregando decks…</p>:<><label htmlFor="occlusion-deck">Deck de destino</label><select id="occlusion-deck" value={deckId} onChange={e=>setDeckId(e.target.value)}><option value="">Selecione um deck</option>{decks.map(deck=><option data-user-content="" key={deck.id} value={deck.id}>{deck.name}</option>)}</select>{decks.length===0&&!error&&<p>Crie um deck antes de preparar a oclusão. <Link href="/decks/new">Criar deck</Link></p>}{deckId&&<Link className="btn" href={`/decks/${deckId}/occlusion/new`}>Abrir editor visual</Link>}<p className="muted">As coordenadas e tamanhos são percentuais: 30 significa 30%. O upload é associado à nota e aos cartões após a confirmação.</p></>}{error&&<p role="alert">{error}</p>}</section>}</AppShell>;
}
