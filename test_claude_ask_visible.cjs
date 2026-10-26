// The question window (AskUserQuestion) and its answer stay in the chat in focus view too: fix-rtl-claude.sh
// makes the fold builder treat an assistant message holding an AskUserQuestion as one that is always shown
// (Habib, 26 Oct 19:27: «یه کاری بکن که همیشه دیده بشه کاری به اون دکمه فوکوس نداشته باش»).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const sh=fs.readFileSync(process.env.FIX_SH||__dirname+'/fix-rtl-claude.sh','utf8');
const m=sh.match(/# An AskUserQuestion[\s\S]*?python3 - "\$ext_dir\/index.js" <<'PYEOF' \|\| true\n([\s\S]*?)\nPYEOF/);
assert.ok(m,'the patch step is in fix-rtl-claude.sh');
// the fold builder's "always shown" test, as the shipped build writes it
const src='function f(J,Z,X,N,j){for(let E=Z;E<X;E++){let I=J[E],v=I.type==="user"?wf(I):Ua0(I)||I.type==="assistant"&&(I.isSynthetic?Kw(I):!bQ(I)&&(Kw(I)||gl(I))&&!A(I,E));if(N.push(v),!v)j.push(E)}}';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ask-')),file=path.join(dir,'index.js');
fs.writeFileSync(file,src);fs.writeFileSync(path.join(dir,'p.py'),m[1]);
execFileSync('python3',[path.join(dir,'p.py'),file]);
const patched=fs.readFileSync(file,'utf8');
const f=new Function('wf','Ua0','Kw','bQ','gl','A',patched+';return f')(()=>true,()=>false,()=>false,()=>false,()=>false,()=>false);
const ask={type:'assistant',content:[{content:{type:'tool_use',name:'AskUserQuestion'}}]};
const bash={type:'assistant',content:[{content:{type:'tool_use',name:'Bash'}}]};
const N=[],j=[];f([ask,bash],0,2,N,j);
const out={shown:N,folded:j};
assert.deepEqual(out,{shown:[true,false],folded:[1]});
console.log(JSON.stringify(out));
