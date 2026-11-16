// «نوارِ اطلاعات» (Habib, 16 Nov 2026): this chat's dollars, tokens, messages and context in a small table with the
// look of the «تماس‌ها» table, left of the prompt box, above it; a click opens it big. Two halves:
//  1. host (claude-host-hook.js __crtl_navar): numbers from a transcript — person messages only, one call per
//     message id, provider price from the chat's preset, never the panel's Opus-priced figure.
//  2. page (claude-ui-buttons.js): asks the host with this chat's sid, draws what comes back, no zeros invented.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm')
const assert = require('node:assert/strict')
const out = {}

/* ---------------- 1. host ---------------- */
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'navar-'))
const sid = '11111111-2222-3333-4444-555555555555'
fs.mkdirSync(path.join(home, 'projects', '-x'), { recursive: true })
const tr = path.join(home, 'projects', '-x', sid + '.jsonl')
const L = (o) => JSON.stringify(o)
const u = (i, o, cr, cw) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: cr, cache_creation_input_tokens: cw })
fs.writeFileSync(tr, [
  L({ type: 'user', cwd: '/x', message: { content: 'سلام' } }),
  L({ type: 'user', message: { content: '<command-name>/hads</command-name>' } }),
  L({ type: 'user', isMeta: true, message: { content: 'meta' } }),
  L({ type: 'assistant', message: { id: 'm1', model: 'deepseek/deepseek-v4-flash-vision-exp', usage: u(1000, 100, 0, 0), content: [] } }),
  // the same call written again for its second block: counted once
  L({ type: 'assistant', message: { id: 'm1', model: 'deepseek/deepseek-v4-flash-vision-exp', usage: u(1000, 100, 0, 0), content: [] } }),
  L({ type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } }),
  L({ type: 'assistant', message: { id: 'm2', model: 'deepseek/deepseek-v4-flash-vision-exp', usage: u(10, 50, 2000, 0), content: [] } }),
  L({ type: 'user', message: { content: [{ type: 'text', text: 'دوباره' }] } }),
  L({ type: 'assistant', message: { id: 'm3', model: '<synthetic>', usage: u(0, 0, 0, 0), content: [] } }),
  ''].join('\n'))
fs.writeFileSync(path.join(home, 'crtl_tanzimat.json'), L({ chat: { [sid]: { model: { v: 'deepseek/deepseek-v4-flash-vision-exp@preset/mh-deepseek-v4-flash-vision-exp-deepinfra', t: 1 } } } }))
process.env.CRTL_NAVAR_HOME = home
delete process.env.CRTL_TANZIMAT
const g = { require, process, console, Buffer, setTimeout }
g.globalThis = g
vm.runInNewContext(fs.readFileSync(process.env.HOST_HOOK_JS || path.join(__dirname, 'claude-host-hook.js'), 'utf8'), g)
const N = g.__crtl_navar
const asked = []
N.gereftan_gheymat = (base, done) => { asked.push(base); done(null, [
  { provider: 'DeepInfra', tag: 'deepinfra/fp8/priority', ctx: 1000000, p: { in: 3e-7, out: 9e-7, cr: 1e-8, cw: null } },
  { provider: 'DeepInfra', tag: 'deepinfra/fp8', ctx: 1000000, p: { in: 2e-7, out: 6e-7, cr: 1e-8, cw: null } },
  { provider: 'GMICloud', tag: 'gmicloud/fp8', ctx: 1000000, p: { in: 1e-7, out: 1e-7, cr: 1e-9, cw: null } }]) }

function javab(kelid) { return new Promise((res) => { let r = null; N.javab(sid, kelid, (x) => { r = x }); setTimeout(() => res(r), 300) }) }
;(async () => {
  const r1 = await javab('')
  const d = r1.d
  out.host = { payam: d.payam, tamas: d.tamas, tokens: d.tokens_kol, ersal: d.models[0].ersal, usd: +d.usd.toFixed(8), ctx: d.ctx, asked }
  out.host = JSON.parse(JSON.stringify(out.host)) // the hook runs in its own realm
  // 2 person messages; 2 calls (m1 once, synthetic dropped); price of the preset's provider, its plain endpoint:
  // m1 1000×2e-7 + 100×6e-7 = 0.00026 · m2 10×2e-7 + 50×6e-7 + 2000×1e-8 = 0.000052 ⇒ 0.000312
  assert.deepEqual(out.host, { payam: 2, tamas: 2, tokens: 3160, ersal: 'DeepInfra (deepinfra/fp8)', usd: 0.000312,
    ctx: { used: 2060, max: 1000000 }, asked: ['deepseek/deepseek-v4-flash-vision-exp'] })
  // nothing changed ⇒ no answer
  out.same = await javab(r1.kelid)
  assert.equal(out.same, null)
  // a new line ⇒ only the new bytes are read, and the numbers move
  fs.appendFileSync(tr, L({ type: 'assistant', message: { id: 'm4', model: 'deepseek/deepseek-v4-flash-vision-exp', usage: u(5, 5, 100, 0), content: [] } }) + '\n')
  const r2 = JSON.parse(JSON.stringify(await javab(r1.kelid)))
  out.append = { tamas: r2.d.tamas, ctx: r2.d.ctx.used }
  assert.deepEqual(out.append, { tamas: 3, ctx: 110 })
  // no preset known ⇒ the cheapest endpoint, never the panel's Opus price
  out.names = [N.esm_openrouter('claude-opus-5-5'), N.ersal_konande('deepseek/deepseek-v4.1-flash-1017@preset/mh-deepseek-v4-1-flash-1017-deepinfra', 'deepseek/deepseek-v4.1-flash-1017'), N.ersal_konande('x/y@preset/cheap-deepseek', 'x/y')]
  assert.deepEqual(out.names, ['anthropic/claude-opus-5.5', 'deepinfra', ''])

  /* ---------------- 2. page ---------------- */
  const { chromium } = require('playwright')
  const script = fs.readFileSync(process.env.BUTTONS_JS || path.join(__dirname, 'claude-ui-buttons.js'), 'utf8')
  const page = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body style="margin:0;width:900px;height:600px">
<div aria-label="Message input" contenteditable="true" style="position:fixed;bottom:10px;left:200px;width:600px;height:60px"></div>
<script>window.__sent=[];window.acquireVsCodeApi=function(){return{postMessage:function(m){window.__sent.push(m)},getState:function(){return{sessionID:'${sid}'}},setState:function(){}}}</script></body></html>`
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  try {
    const p = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage()
    await p.route('http://t.local/', (r) => r.fulfill({ contentType: 'text/html', body: page }))
    await p.goto('http://t.local/')
    await p.addScriptTag({ content: script })
    await p.evaluate(() => window.acquireVsCodeApi()) // the app takes the handle
    await p.waitForFunction(() => window.__sent.some((m) => m.type === 'crtl-navar'), null, { timeout: 6000 })
    out.asked = await p.evaluate(() => window.__sent.filter((m) => m.type === 'crtl-navar')[0])
    assert.deepEqual(out.asked, { type: 'crtl-navar', sid, kelid: '' })
    // before an answer: «reading», not zeros
    out.wait = await p.evaluate(() => document.getElementById('crtl-navar').textContent)
    assert.equal(out.wait, 'در حالِ خواندن…')
    await p.evaluate((r) => window.postMessage(r, '*'), r2)
    await p.waitForTimeout(300)
    out.small = await p.evaluate(() => { const b = document.getElementById('crtl-navar'), r = b.getBoundingClientRect()
      return { heads: [...b.querySelectorAll('th')].map((x) => x.textContent).join(' '), vals: [...b.querySelectorAll('td')].map((x) => x.textContent).join(' | '),
        clear: r.right < document.querySelector('[aria-label="Message input"]').getBoundingClientRect().left || r.bottom < document.querySelector('[aria-label="Message input"]').getBoundingClientRect().top,
        left: r.left < 20, lines: getComputedStyle(b.querySelector('td')).borderTopStyle, zero: /\$۰٫۰۰(?![۰-۹])/.test(b.textContent) } })
    assert.deepEqual(out.small, { heads: 'هزینه توکن پیام کانتکست', vals: '≈$۰٫۰۰۰۳ | ۳٫۳k | ۲ | ۰٪', clear: true, left: true, lines: 'solid', zero: false })
    // a narrow panel: the prompt box starts at the left edge ⇒ the table goes above it, never over it
    await p.evaluate(() => { document.querySelector('[aria-label="Message input"]').style.left = '30px'; window.__crtl_navar_keshidan() })
    out.narrow = await p.evaluate(() => document.getElementById('crtl-navar').getBoundingClientRect().bottom <= document.querySelector('[aria-label="Message input"]').getBoundingClientRect().top)
    assert.equal(out.narrow, true)
    await p.evaluate(() => { document.querySelector('[aria-label="Message input"]').style.left = '200px'; window.__crtl_navar_keshidan() })
    // a click opens it big, with the provider and its price
    const box = await p.evaluate(() => { const r = document.getElementById('crtl-navar').getBoundingClientRect(); return [r.left + 5, r.top + 5] })
    await p.mouse.click(box[0], box[1]); await p.waitForTimeout(300)
    out.big = await p.evaluate(() => { const b = document.getElementById('crtl-navar'); return { big: b.classList.contains('crtl-amar-bozorg'), ersal: b.textContent.includes('DeepInfra (deepinfra/fp8)'), payam: b.textContent.includes('پیامِ تو'), inside: b.getBoundingClientRect().bottom <= innerHeight } })
    assert.deepEqual(out.big, { big: true, ersal: true, payam: true, inside: true })
    await p.mouse.click(850, 50); await p.waitForTimeout(300)
    out.back = await p.evaluate(() => !document.getElementById('crtl-navar').classList.contains('crtl-amar-bozorg'))
    assert.equal(out.back, true)
    // another chat's answer is ignored
    await p.evaluate((r) => window.postMessage(Object.assign({}, r, { sid: '99999999-2222-3333-4444-555555555555', d: Object.assign({}, r.d, { payam: 77 }) }), '*'), r2)
    await p.waitForTimeout(300)
    out.other = await p.evaluate(() => document.getElementById('crtl-navar').textContent.includes('۷۷'))
    assert.equal(out.other, false)
    // a question window open ⇒ hidden, like the «تماس‌ها» table
    await p.evaluate(() => { const q = document.createElement('div'); q.className = 'questionsContainer_x'; document.body.appendChild(q) })
    out.question = await p.evaluate(() => getComputedStyle(document.getElementById('crtl-navar')).display)
    assert.equal(out.question, 'none')
  } finally { await browser.close() }
  fs.rmSync(home, { recursive: true, force: true })
  console.log(JSON.stringify(out))
  console.log('navar: all green')
})().catch((e) => { console.error(e); process.exit(1) })
