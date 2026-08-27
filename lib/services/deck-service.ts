import {createClient} from '../supabase/client';
export type Deck={id:string;name:string;description?:string|null;visibility?:string|null;};
export const demoDecks:Deck[]=[{id:'idiomas',name:'Inglês para concursos',description:'Vocabulário e gramática',visibility:'private'},{id:'medicina',name:'Fisiologia humana',description:'Bases para revisão',visibility:'private'},{id:'dev',name:'Sistema nervoso',description:'Neuroanatomia',visibility:'private'}];
export async function listDecks(){const {data,error}=await createClient().from('decks').select('id,name,description,visibility').order('name').limit(50);if(error)throw error;return (data??[]) as Deck[]}
export async function createDeck(name:string,description:string){const {data,error}=await createClient().from('decks').insert({name,description,visibility:'private'}).select('id,name,description,visibility').single();if(error)throw error;return data as Deck}
