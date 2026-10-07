import { expect,test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient,type SupabaseClient } from '@supabase/supabase-js';
const fixturePath=process.env.CI_FIXTURE_PATH??'tests/.ci-fixture.json';
const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
if(!fixture.url||!fixture.anonKey||!fixture.password)throw new Error('Critical QA fixture is required. This suite must never be skipped.');
let userA:SupabaseClient;let userB:SupabaseClient;let deckId='';let cardId='';

test.beforeAll(async()=>{
 userA=createClient(fixture.url,fixture.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 userB=createClient(fixture.url,fixture.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const [a,b]=await Promise.all([userA.auth.signInWithPassword({email:fixture.userA,password:fixture.password}),userB.auth.signInWithPassword({email:fixture.userB,password:fixture.password})]);
 expect(a.error).toBeNull();expect(b.error).toBeNull();
});

test('F48 login -> create deck/card -> browser review -> persisted backend -> idempotent replay',async({page})=>{
 await page.goto('/login');await page.locator('input[type=email]').fill(fixture.userA);
 const passwordInput=page.locator('input[type=password]');await passwordInput.waitFor();
 await passwordInput.evaluate((element,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));},fixture.password);
 await page.locator('form button[type=submit]').click();await expect(page).toHaveURL(/dashboard/);
 const name=`QA critical ${randomUUID()}`;
 await page.goto('/decks/new');await page.getByLabel('Nome do deck',{exact:true}).fill(name);await page.getByRole('button',{name:'Criar deck',exact:true}).click();
 await expect.poll(async()=>{const result=await userA.from('decks').select('id').eq('name',name).is('deleted_at',null);if(result.error)throw result.error;deckId=result.data?.[0]?.id??'';return result.data?.length??0;}).toBe(1);
 await page.goto(`/decks/${deckId}/cards`);
 await page.getByLabel('Frente',{exact:true}).fill('QA persisted question');await page.getByLabel('Verso',{exact:true}).fill('QA persisted answer');
 await page.locator('form').filter({has:page.getByLabel('Frente',{exact:true})}).locator('button[type=submit]').click();
 await expect.poll(async()=>{const result=await userA.from('cards').select('id,note_id').eq('deck_id',deckId).is('deleted_at',null);if(result.error)throw result.error;cardId=result.data?.[0]?.id??'';return result.data?.length??0;}).toBe(1);
 await page.goto(`/study/${deckId}`);await page.getByRole('button',{name:/Revelar resposta/}).click();await expect(page.getByText('QA persisted answer',{exact:true})).toBeVisible();await page.context().setOffline(true);await page.getByRole('button',{name:'Bom',exact:true}).click();
 await expect(page.getByText('Sessão concluída.',{exact:true})).not.toBeVisible();
 await expect(page.getByText(/avaliação.*aguardando confirmação/).first()).toBeVisible();
 const offlineCount=await userA.from('review_logs').select('id',{count:'exact',head:true}).eq('card_id',cardId);expect(offlineCount.count).toBe(0);
 await page.context().setOffline(false);
 await expect(page.getByText('Sessão concluída.',{exact:true})).toBeVisible({timeout:30000});
 const result=await userA.from('review_logs').select('id,client_review_id,session_id').eq('card_id',cardId);expect(result.error).toBeNull();expect(result.data).toHaveLength(1);const review=result.data![0];expect(review.client_review_id).toBeTruthy();
 const xp=await userA.from('gamification_xp_sessions').select('review_count,xp_awarded').eq('session_id',review.session_id);expect(xp.error).toBeNull();expect(xp.data).toHaveLength(1);expect(xp.data![0].review_count).toBe(1);expect(xp.data![0].xp_awarded).toBeGreaterThan(0);
 const before=await userA.from('card_learning_state').select('usn,due_at,state').eq('card_id',cardId).single();expect(before.error).toBeNull();
 const replayBody={card_id:cardId,rating:'good',client_review_id:review.client_review_id,session_id:review.session_id};
 const [first,second]=await Promise.all([userA.functions.invoke('fsrs-review',{body:replayBody}),userA.functions.invoke('fsrs-review',{body:replayBody})]);expect(first.error).toBeNull();expect(second.error).toBeNull();expect(first.data.review_id).toBe(review.id);expect(second.data.review_id).toBe(review.id);
 const after=await userA.from('card_learning_state').select('usn,due_at,state').eq('card_id',cardId).single();expect(after.data).toEqual(before.data);
 const replayCount=await userA.from('review_logs').select('id',{count:'exact',head:true}).eq('client_review_id',review.client_review_id);expect(replayCount.count).toBe(1);
});

test('F37 real authenticated RLS: user B cannot read or mutate user A deck/card/review',async()=>{
 expect(deckId).toBeTruthy();expect(cardId).toBeTruthy();
 const [deck,card,reviews]=await Promise.all([userB.from('decks').select('id').eq('id',deckId),userB.from('cards').select('id').eq('id',cardId),userB.from('review_logs').select('id').eq('card_id',cardId)]);
 expect(deck.error).toBeNull();expect(card.error).toBeNull();expect(reviews.error).toBeNull();expect(deck.data).toEqual([]);expect(card.data).toEqual([]);expect(reviews.data).toEqual([]);
 const mutation=await userB.from('cards').update({fields:{Front:'unauthorized'}}).eq('id',cardId).select('id');expect(mutation.data??[]).toEqual([]);
 const owned=await userA.from('cards').select('fields').eq('id',cardId).single();expect((owned.data?.fields as any).Front).not.toBe('unauthorized');
});
