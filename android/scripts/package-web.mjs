import {readFile, writeFile, mkdir, rm, readdir, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const out = 'android/app/src/main/assets/beltrix';
await rm(out, {recursive:true, force:true}); await mkdir(out, {recursive:true});
const html = await readFile('public/index.html', 'utf8');
assert.ok(html.startsWith('<!doctype html>') && html.trim().endsWith('</html>'), 'Complete source HTML required');
assert.equal((html.match(/<head>/g)||[]).length, 1);
assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>\s*[^<]/i.test(html), 'Inline JavaScript would violate packaged CSP');
assert.ok(!html.includes('android-adapter.js'), 'Do not package twice');
// Change the packaged COPY only. Never rewrite the production web source.
for(const name of await readdir('public')) {
  if(!/^[A-Za-z0-9._-]+$/.test(name)||! /\.(?:html|js|css|svg|png|webmanifest)$/.test(name) || name === 'sw.js') continue;
  await copyFile('public/'+name,out+'/'+name);
}
await writeFile(out+'/index.html', html.replace('<head>','<head>\n<script src="./android-adapter.js"></script>'));
await copyFile('android/web/android-adapter.js',out+'/android-adapter.js');
// Reuse the existing BELTRIX symbol, rather than proposing a new design.
const symbol=await readFile('web/beltrix-symbol.svg','utf8');
const paths=[...symbol.matchAll(/<path[^>]*d="([^"]+)"/g)].map(m=>m[1]);
const box=symbol.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
if(paths.length && box){
 const scale=Math.min(52/Number(box[1]),58/Number(box[2]));
 const x=(108-Number(box[1])*scale)/2,y=(108-Number(box[2])*scale)/2;
 await writeFile('android/app/src/main/res/drawable/ic_launcher_foreground.xml',`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><group android:translateX="${x}" android:translateY="${y}" android:scaleX="${scale}" android:scaleY="${scale}"><path android:fillColor="#E6BE72" android:pathData="${paths.join(" ")}" /></group></vector>\n`);
}
const files=[];
for(const name of (await readdir(out)).sort()){const bytes=await readFile(out+'/'+name);files.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
let source = process.env.GITHUB_SHA; if(!source) {try{source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{source='local'}}
const manifest={app:'BELTRIX Android Preview',version:'0.1.0-preview',source,packagedAt:new Date().toISOString(),mode:'packaged-read-only-with-external-wallet-handoff',files};
await writeFile(out+'/android-build.json',JSON.stringify(manifest,null,2));
await mkdir('android-evidence',{recursive:true});await writeFile('android-evidence/packaged-assets.json',JSON.stringify(manifest,null,2));
assert.ok(files.some(f=>f.name==='usdt.bundle.js'));assert.ok(files.some(f=>f.name==='trade-simple.css'));
console.log('Packaged',files.length,'assets; source',source);
