import { createClient } from '../supabase/client';
/** Cached identity is only for local queued writes. Remote delivery always requires getUser(). */
export async function requireLocalIdentity(requireRemote=false) {
 const client=createClient();
 if(!requireRemote && typeof client.auth.getSession==='function') {
  const {data}=await client.auth.getSession();
  if(data.session?.user)return data.session.user;
 }
 const {data,error}=await client.auth.getUser();
 if(error||!data.user)throw new Error('AUTH_REQUIRED');
 return data.user;
}
