import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {Readable} from 'node:stream'
import {apply,saveTik,loadTik} from '../index.js'
const require=createRequire(import.meta.url), shared=require('../aa-shared.cjs')
const root=path.resolve(import.meta.dirname,'../..')
function box(t){const home=fs.mkdtempSync(path.join(os.homedir(),'aa-shared-test-'));t.mock.method(os,'homedir',()=>home);t.after(()=>fs.rmSync(home,{recursive:true,force:true}));return home;}
function dshRoute(){const routes=new Map();apply({inject(deps,cb){if(deps.includes('webServer'))cb({effect:fn=>fn(),webServer:{register:r=>{routes.set(r.path,r.handler);return()=>{}}}})},get(){},logger:{warn(){},info(){}}});return routes.get('/plugins/rtl/aa-shared');}
async function req(route,cwd,body,sid='dsh-chat') {const r=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);Object.assign(r,{method:body?'POST':'GET',url:'/plugins/rtl/aa-shared?cwd='+encodeURIComponent(cwd)+'&sessionId='+sid,headers:{host:'127.0.0.1','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});let data='';const res={setHeader(){},end(s){data+=s||''}};await route(r,res);const out=JSON.parse(data);assert.equal(out.ok,true,JSON.stringify(out));return out;}
function host(){const old=process.env.CRTL_HOST_TEST;process.env.CRTL_HOST_TEST='1';require(path.join(root,'claude-host-hook.js'));process.env.CRTL_HOST_TEST=old||'';return global.__crtlHost;}
test('real host adapters: Claude folder Aa→DSH; DSH→Claude, inheritance and native data retained',async t=>{
 const home=box(t),cwd=path.join(home,'work');fs.mkdirSync(cwd);const h=host(),route=dshRoute();
 const legacy=path.join(home,'.claude-rtl-sizes.json');fs.writeFileSync(legacy,'{"native":"keep"}');
 h.aaPrefs({type:'crtl-aa-save',scope:'sarasari',patch:{aaTaze:true,opacity:40}},cwd);
 h.aaPrefs({type:'crtl-aa-save',scope:'poshe',patch:{aaTaze:false,commands:[{label:'حافظه',text:'/remember',send:false}]}},cwd);
 const a=await req(route,cwd);assert.equal(a.values.aaTaze,false);assert.equal(a.layers.global.opacity,40);assert.equal(a.values.commands[0].label,'حافظه');
 await req(route,cwd,{scope:'poshe',cwd,sessionId:'dsh-chat',patch:{aaTaze:true,opacity:81}});
 const b=h.aaPrefs({type:'crtl-aa-read'},cwd);assert.equal(b.values.aaTaze,true);assert.equal(b.values.opacity,81);
 h.aaPrefs({type:'crtl-aa-save',scope:'chat',sid:'cc-chat',patch:{aaTaze:false}},cwd);
 assert.equal(h.aaPrefs({type:'crtl-aa-read',sid:'cc-chat'},cwd).values.aaTaze,false);assert.equal((await req(route,cwd)).values.aaTaze,true);
 h.aaPrefs({type:'crtl-aa-save',scope:'poshe',patch:{},unset:['aaTaze']},cwd);assert.equal((await req(route,cwd)).values.aaTaze,true);
 assert.equal(fs.readFileSync(legacy,'utf8'),'{"native":"keep"}');assert.equal(fs.existsSync(path.join(home,'.claude','aa_shared.json')),true);
});
test('real Python tick adapter↔DSH: حافظه in folder, other folders and builtins isolated',t=>{
 const home=box(t),cwd=path.join(home,'work');fs.mkdirSync(cwd);const store=path.join(home,'.claude','tik_ha.json');fs.mkdirSync(path.dirname(store),{recursive:true});fs.writeFileSync(store,JSON.stringify({kooch:1,sarasari:{abzar:{Bash:true}},poshe:{},chat:{}}));
 const env={...process.env,HOME:home,TIK_HA:store,CRTL_AA_SHARED:shared.file(home)};
 const python=(code)=>JSON.parse(execFileSync('python3',['-c',`import sys,json;sys.path.insert(0,${JSON.stringify(path.join(root,'abzar'))});import tik_ha as t;${code}`],{env,encoding:'utf8'}));
 python(`print(json.dumps(t.sabt({'sath':'poshe','cwd':${JSON.stringify(cwd)},'taghir':[{'kind':'mcp','name':'hafeze','on':False}]})))`);
 assert.equal(loadTik(home).poshe[cwd].mcp.hafeze,false);
 saveTik({home,sath:'poshe',cwd,changes:[{kind:'mcp',name:'hafeze',on:true},{kind:'abzar_dsh',name:'web_search',on:false}]});
 const a=python('print(json.dumps(t.anbar()))');assert.equal(a.poshe[cwd].mcp.hafeze,true);assert.equal(a.sarasari.abzar.Bash,true);assert.equal(a.poshe['/other'],undefined);
});
// حبیب ۱۷ نوامبر ۰۴:۳۰: «تنظیمات رو درست کن که خودم هر جا خواستم بگذارمشون» — پیش از این
// «جا»ی هر دکمه هنگامِ ذخیرهٔ مشترک حذف می‌شد و همه بی‌صدا به ستونِ چپ می‌افتادند.
test('جای دکمه (بالا/چپ/راست) در انبار مشترک می‌ماند',t=>{
 const home=box(t),cwd=path.join(home,'work');fs.mkdirSync(cwd);
 shared.save(home,'prefs','sarasari',cwd,'',{commands:[
  {label:'بالایی',text:'متن',send:false,side:'top'},
  {label:'راستی',text:'متن',send:true,side:'right'},
  {label:'بی‌جا',text:'متن',send:false},
  {label:'خراب',text:'متن',send:false,side:'چپ‌وراست'}
 ]});
 const by=Object.fromEntries(shared.view(home,'prefs',cwd,'').values.commands.map(c=>[c.label,c.side]));
 assert.equal(by['بالایی'],'top');assert.equal(by['راستی'],'right');
 assert.equal(by['بی‌جا'],undefined,'جای حدسی نباید به انبار اضافه شود');
 assert.equal(by['خراب'],undefined,'مقدارِ ناشناخته باید رد شود');
});
