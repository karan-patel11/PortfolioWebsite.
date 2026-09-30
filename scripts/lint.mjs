import {readdirSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const dir of ['scripts','src']) for(const name of readdirSync(dir)){
 if(!/\.(?:mjs|js)$/.test(name))continue;
 const file=`${dir}/${name}`;
 const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 if(run.status!==0||run.stderr){process.stderr.write(run.stderr||`Syntax check failed: ${file}\n`);process.exitCode=1}
}
JSON.parse(readFileSync('content/portfolio.json','utf8'));
if(!process.exitCode)console.log('Lint passed: JavaScript syntax and content JSON.');
