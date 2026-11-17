#!/usr/bin/env node
// Install only into the active Microsoft VS Code extension. Keep the user's other IDEs untouched.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { patchHistoryWebview } from './history-webview.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const hookEnd = '/* === /CLAUDE-RTL-HOST-HOOK === */'
const hookStart = '/* === CLAUDE-RTL-HOST-HOOK === */'
const historyStart = '/* === DSH-CLAUDE-HISTORY-HOST-V1 === */'
const historyEnd = '/* === /DSH-CLAUDE-HISTORY-HOST-V1 === */'
const buttonsStart = '/* === CLAUDE-RTL-UI-BUTTONS'
const digest = data => createHash('sha256').update(data).digest('hex')

function range(text, start, end) {
  const first = text.indexOf(start), last = text.indexOf(end, first)
  if (first < 0 || last < first || text.lastIndexOf(start) !== first) throw Error('Missing or ambiguous extension insertion point: ' + start)
  return [first, last + end.length]
}

export function patchHistoryHost(source, block) {
  if (!source.includes(historyStart)) {
    const [, afterHook] = range(source, hookStart, hookEnd)
    return source.slice(0, afterHook) + '\n' + block + source.slice(afterHook)
  }
  const [start, end] = range(source, historyStart, historyEnd)
  return source.slice(0, start) + block + source.slice(end)
}

function patchExistingAa(source, hook, buttons) {
  const [hookAt, hookLimit] = range(source, hookStart, hookEnd)
  const [start, end] = range(hook, hookStart, hookEnd)
  let patched = source.slice(0,hookAt) + hook.slice(start,end) + source.slice(hookLimit)
  const buttonAt = patched.indexOf(buttonsStart)
  const buttonEnd = patched.indexOf('</script>', buttonAt)
  if (buttonAt < 0 || buttonAt !== patched.lastIndexOf(buttonsStart) || buttonEnd < 0 ||
      !patched.slice(buttonEnd - 160, buttonEnd).includes('DOMContentLoaded')) {
    throw Error('The previously installed Aa script could not be located')
  }
  // This code is embedded in an HTML script in a JavaScript template literal.
  const encoded = buttons.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')
  patched = patched.slice(0,buttonAt) + encoded + patched.slice(buttonEnd)
  const [hs,he] = range(hook, historyStart, historyEnd)
  patched=patchHistoryHost(patched,hook.slice(hs,he))
  const launch=/\{let crtlC=globalThis\.__crtl_baz_shodan&&globalThis\.__crtl_baz_shodan\(([\w$]+),([\w$]+)\.cwd\);if\(crtlC\)\{[^{}]*?if\(crtlC\.effort\)/;
  const anchor='settings:JSON.stringify(crtlC.settings)}}}';
  const found=patched.match(launch);
  const trust=patched.match(/settingSources:\[\.\.\.([\w$]+)\.kind==="trusted"\?[^\]]+\],\.\.\.\1\.kind==="trusted"/);
  if(!found || !trust || patched.split(anchor).length!==2)throw Error('Claude launch or workspace trust anchor changed');
  const legacy='globalThis.__crtlHistoryLaunch?.('+found[1]+','+found[2]+');';
  const scoped='globalThis.__crtlHistoryLaunch?.('+found[1]+','+found[2]+',undefined,'+trust[1]+'.kind==="trusted");';
  if(!patched.includes(anchor+scoped)) {
    if(patched.includes(legacy)) patched=patched.replace(anchor+legacy,anchor+scoped);
    else patched=patched.replace(anchor,anchor+scoped);
    if(!patched.includes(anchor+scoped))throw Error('Could not bind the session tool server to the trusted launch');
  }
  return patched
}

export async function prepareExtension(extension) {
  const root = path.resolve(extension)
  const pkg = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'))
  if (pkg.publisher?.toLowerCase() !== 'anthropic' || pkg.name !== 'claude-code') throw Error('Selected extension is not Claude Code')
  const hook = await fs.readFile(path.join(here,'../claude-host-hook.js'),'utf8')
  const buttons = await fs.readFile(path.join(here,'../claude-ui-buttons.js'),'utf8')
  const files = []
  for (const relative of ['extension.js','webview/index.js']) {
    const file = path.join(root,relative)
    const before = await fs.readFile(file,'utf8')
    const after = relative === 'extension.js' ? patchExistingAa(before,hook,buttons) : patchHistoryWebview(before)
    const checked = spawnSync(process.execPath,['--input-type',relative === 'extension.js' ? 'commonjs' : 'module','--check'],{input:after,encoding:'utf8',timeout:25000})
    if (checked.status !== 0) throw Error('Syntax check failed in '+relative+': '+(checked.stderr || '').slice(-320))
    files.push({relative,file,before,after})
  }
  return {root,files}
}

async function activeExtension() {
  const code = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
  const result = spawnSync(code,['--locate-extension','anthropic.claude-code'],{encoding:'utf8',timeout:15000})
  if (result.status !== 0) throw Error('Could not locate the active Claude Code extension')
  const root = result.stdout.trim().split('\n').at(-1)
  if (!root.startsWith(path.join(os.homedir(),'.vscode','extensions') + path.sep)) throw Error('Unexpected extension directory')
  return root
}
async function exchange(file, content) {
  const tmp = file+'.'+randomUUID()+'.tmp'
  const mode = (await fs.stat(file)).mode
  try { await fs.writeFile(tmp,content,{flag:'wx',mode}); await fs.rename(tmp,file) }
  finally { await fs.rm(tmp,{force:true}) }
}

async function main() {
  const [mode='--check', arg] = process.argv.slice(2)
  const root = await activeExtension()
  if (mode === '--rollback') {
    const backup = path.resolve(arg || '')
    const meta = JSON.parse(await fs.readFile(path.join(backup,'manifest.json'),'utf8'))
    if (meta.root !== root) throw Error('Backup belongs to another installed extension')
    for (const f of meta.files) {
      if (!['extension.js','webview/index.js'].includes(f.relative)) throw Error('Invalid backup path')
      const file = path.join(root,f.relative), prior = await fs.readFile(path.join(backup,f.relative))
      if (digest(await fs.readFile(file)) !== f.installedSha || digest(prior) !== f.beforeSha) throw Error('File changed after install')
    }
    for (const f of meta.files) await exchange(path.join(root,f.relative),await fs.readFile(path.join(backup,f.relative)))
    console.log('Restored the selected VS Code files')
    return
  }
  if (!['--check','--apply'].includes(mode)) throw Error('Expected --check, --apply or --rollback')
  const {files} = await prepareExtension(root)
  const changed = files.filter(f=>f.before!==f.after)
  if (mode === '--check' || !changed.length) { console.log(JSON.stringify({root,changes:changed.map(f=>f.relative)})); return }
  const backup = path.join(os.homedir(),'.claude','dsh-history','backups',randomUUID())
  await fs.mkdir(backup,{recursive:true,mode:0o700})
  const manifest = {root,files:[]}
  for (const f of changed) {
    const destination = path.join(backup,f.relative)
    await fs.mkdir(path.dirname(destination),{recursive:true,mode:0o700})
    await fs.writeFile(destination,f.before,{flag:'wx',mode:0o600})
    manifest.files.push({relative:f.relative,beforeSha:digest(f.before),installedSha:digest(f.after)})
  }
  await fs.writeFile(path.join(backup,'manifest.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600})
  const done = []
  try {
    for (const f of changed) {
      if (digest(await fs.readFile(f.file)) !== digest(f.before)) throw Error('Extension changed during installation')
      await exchange(f.file,f.after); done.push(f)
    }
  } catch (error) {
    for (const f of done.reverse()) if (digest(await fs.readFile(f.file)) === digest(f.after)) await exchange(f.file,f.before)
    throw error
  }
  console.log(JSON.stringify({root,backup,installed:changed.map(f=>f.relative)}))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(error.message);process.exitCode=1})
}
