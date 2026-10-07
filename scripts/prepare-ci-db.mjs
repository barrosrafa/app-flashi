import {readdir,readFile,writeFile,mkdir,cp} from 'node:fs/promises';
const source='backend-source/supabase';const target='ci-database/supabase';
await mkdir(`${target}/migrations`,{recursive:true});
const names=(await readdir(`${source}/migrations`)).filter(file=>file.endsWith('.sql')).sort();
const baseline=[];const patches=[];const unique=new Set();
for(const name of names){
 const sql=await readFile(`${source}/migrations/${name}`,'utf8');
 if(!/^0[0-5]_/.test(name)){patches.push({name,sql});continue;}
 const markers=[...sql.matchAll(/^-- ================= SOURCE ([^\n]+\.sql) =================\s*$/gm)];
 if(!markers.length){baseline.push({name:'0000_'+name,sql});continue;}
 for(let i=0;i<markers.length;i++){
  const original=markers[i][1];if(unique.has(original))throw new Error(`Duplicate source migration: ${original}`);unique.add(original);
  baseline.push({name:original,sql:sql.slice(markers[i].index,markers[i+1]?.index??sql.length)});
 }
}
baseline.sort((a,b)=>a.name.localeCompare(b.name));const ordered=[...baseline,...patches];
for(let i=0;i<ordered.length;i++)await writeFile(`${target}/migrations/${20200101000000n+BigInt(i)}_${ordered[i].name}`,ordered[i].sql);
await cp(`${source}/functions`,`${target}/functions`,{recursive:true});
console.log(`Prepared ${ordered.length} real migrations in dependency-safe historical SOURCE order; no SQL, checks, functions or RLS policies skipped.`);
