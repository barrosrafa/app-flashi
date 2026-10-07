import { readdir,readFile,writeFile,mkdir,cp } from 'node:fs/promises';
const source='backend-source/supabase'; const target='ci-database/supabase';
await mkdir(`${target}/migrations`,{recursive:true});
const files=(await readdir(`${source}/migrations`)).filter((file)=>file.endsWith('.sql')).sort();
for(let index=0;index<files.length;index++) {
 const version=String(20200101000000n+BigInt(index));
 await writeFile(`${target}/migrations/${version}_${files[index]}`,await readFile(`${source}/migrations/${files[index]}`));
}
await cp(`${source}/functions`,`${target}/functions`,{recursive:true});
console.log(`Prepared ${files.length} isolated migrations and the real backend functions.`);
