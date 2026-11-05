// The question window fills the chat's width in the real extension CSS, and the typing box keeps its limit.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const js=fs.readFileSync(process.env.UI_JS||__dirname+'/claude-ui-buttons.js','utf8');
const rules=[...js.matchAll(/^\s*'((?:\[class\*="(?:inputContainer|permissionsContainer|permissionRequestContainer|questionsContainer|withPreview)_"\]|html:has\(\[class\*="questionsContainer_"\]\)).*)',$/gm)].map(m=>m[1]).join('\n');
const dir=path.join(os.homedir(),'.vscode/extensions');
const ext=fs.readdirSync(dir).filter(d=>d.startsWith('anthropic.claude-code-')).sort().pop();
const base=fs.readFileSync(path.join(dir,ext,'webview/index.css.backup'),'utf8');
const page=q=>`<!doctype html><style>${base}</style><style>${rules}</style><body style="margin:0;height:800px;width:1000px">
<div id=c class=chatContainer_07S1Yg style="height:800px"><div id=i class=inputContainer_07S1Yg>${q?'<div class=permissionsContainer_07S1Yg><div id=p class=permissionRequestContainer_qlaBag><div class=withPreview_hONcXw><div class=questionsContainer_hONcXw>q</div><div class=previewPane_hONcXw>p</div></div></div></div>':'<div>typing</div>'}</div></div><div id=crtl-amar>a</div>`;
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const p=await b.newPage({viewport:{width:1000,height:800}});
await p.setContent(page(true));
assert.ok((await p.locator('#p').boundingBox()).width>=970,'the question window fills the width');
assert.equal(await p.locator('#crtl-amar').isVisible(),false,'the count table hides under a question');
await p.setContent(page(false));
assert.ok((await p.locator('#i').boundingBox()).width<=680,'the typing box keeps its limit');
assert.equal(await p.locator('#crtl-amar').isVisible(),true,'the count table comes back');
await b.close();console.log('ask width: all checks passed')})().catch(e=>{console.error(e.message);process.exit(1)});
