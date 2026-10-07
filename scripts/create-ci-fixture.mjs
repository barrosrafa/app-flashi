import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const text=await readFile('/tmp/flashi-ci-env','utf8');const env={};
for(const line of text.split('\n')) {const match=line.match(/^([A-Z_]+)="?(.*?)"?$/);if(match)env[match[1]]=match[2];}
if(!env.API_URL||!env.ANON_KEY||!env.SERVICE_ROLE_KEY)throw new Error('CI database credentials are required; critical tests cannot be skipped.');
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const password=randomBytes(30).toString('base64url');
for(const email of ['qa-a@flashi.test','qa-b@flashi.test']) {const {error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw new Error('Could not create isolated QA fixture.');}
await writeFile('tests/.ci-fixture.json',JSON.stringify({url:env.API_URL,anonKey:env.ANON_KEY,password,userA:'qa-a@flashi.test',userB:'qa-b@flashi.test'}),{mode:0o600});
await writeFile('.env.local',`NEXT_PUBLIC_SUPABASE_URL=${env.API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${env.ANON_KEY}\nNEXT_PUBLIC_SENTRY_DSN=\nNEXT_PUBLIC_POSTHOG_ENABLED=0\nNEXT_PUBLIC_APP_COMMIT=${process.env.GITHUB_SHA??'ci'}\n`,{mode:0o600});
console.log('Isolated QA fixture created; no production credentials used.');
