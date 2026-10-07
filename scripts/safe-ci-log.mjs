import {readFileSync} from 'node:fs';
const file=process.argv[2];if(!file)throw new Error('CI log path required');
let text=readFileSync(file,'utf8').replace(/\u001b\[[0-9;]*m/g,'');
text=text.split('\n').filter(line=>!/\b(?:ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|SECRET_KEY|PUBLISHABLE_KEY|PASSWORD|ACCESS_TOKEN)\s*[:=]/i.test(line)).join('\n');
text=text.replace(/Bearer\s+[^\s"']+/gi,'Bearer [redacted]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted JWT]').replace(/\b(?:sb_secret_|sb_publishable_|sbp_|ghp_|gho_|ghs_|sk-)[A-Za-z0-9_-]+/g,'[redacted key]').replace(/postgres(?:ql)?:\/\/[^@\s]+@/g,'postgresql://[redacted]@');
console.log(text.split('\n').slice(-55).join('\n'));
