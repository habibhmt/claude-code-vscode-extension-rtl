/**
 * آزمونِ نیمهٔ هاستِ تیک‌ها: پرونده، سه سطح، و اینکه restrict واقعاً صدا زده می‌شود.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cleanList, effectiveList } from '../tik-pure.js'

/** یک خانهٔ موقت با پوشهٔ کار. */
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikhost-'))
  // /tmp روی مک لینکی به /private/var است و افزونه (به‌درستی) پوشه‌های سیستم را رد می‌کند؛
  // پس پوشهٔ خانه و کار را بیرونِ /tmp می‌سازیم.
  // HOME را به همان مقدارِ اول برمی‌گردانیم، وگرنه آزمونِ بعدی پوشهٔ پاک‌شده را می‌گیرد
  const base = fs.mkdtempSync(path.join(os.homedir(), 'dsh-rtl-tik-test-'))
  const home = path.join(base, 'home')
  const work = path.join(base, 'work')
  const other = path.join(base, 'other')
  for (const d of [home, work, other]) fs.mkdirSync(d, { recursive: true })
  return { root: base, home, work, other, done: () => fs.rmSync(base, { recursive: true, force: true }) }
}

test('saveTik/loadTik: سه سطح درست می‌نشیند و خرابی خطا نمی‌دهد', async () => {
  const box = sandbox()
  const savedHome = process.env.HOME
  try {
    process.env.HOME = box.home
    const mod = await import('../index.js?' + Date.now())
    assert.equal(mod.tikFile(box.home), path.join(box.home, '.dsh', 'dsh-rtl', 'tik.json'))
    // پروندهٔ خراب ⇒ فهرستِ خالی، بی‌خطا
    fs.mkdirSync(path.dirname(mod.tikFile(box.home)), { recursive: true })
    fs.writeFileSync(mod.tikFile(box.home), '{ not json')
    const empty = mod.loadTik(box.home)
    assert.deepEqual(empty.sarasari, cleanList({}))
    assert.equal(empty.kooch, 0)

    // سطحِ سراسری
    const g = mod.saveTik({ home: box.home, sath: 'sarasari', changes: [{ kind: 'abzar_dsh', name: 'bash', on: false }] })
    assert.equal(g.ok, true)
    // سطحِ پوشه
    const p = mod.saveTik({ home: box.home, sath: 'poshe', cwd: box.work, changes: [{ kind: 'mcp', name: 'hafeze', on: false }] })
    assert.equal(p.ok, true)
    // سطحِ چت
    const c = mod.saveTik({ home: box.home, sath: 'chat', chat: 'session-1', changes: [{ kind: 'eskil', name: 'nazer', on: false }] })
    assert.equal(c.ok, true)
    assert.ok(c.store.kooch > 0, 'زمانِ ثبت نوشته شد')

    const back = mod.loadTik(box.home)
    assert.equal(back.chat['session-1'].eskil.nazer, false)
    assert.equal(back.poshe[box.work].mcp.hafeze, false)
    assert.equal(back.sarasari.abzar_dsh.bash, false)

    // سطحِ نامعلوم رد می‌شود
    assert.equal(mod.saveTik({ home: box.home, sath: 'mah', changes: [{ kind: 'mcp', name: 'x', on: true }] }).ok, false)
    // دستهٔ نامعلوم رد می‌شود
    assert.equal(mod.saveTik({ home: box.home, sath: 'sarasari', changes: [{ kind: 'bad', name: 'x', on: true }] }).ok, false)
    // بی‌تغییر رد می‌شود
    assert.equal(mod.saveTik({ home: box.home, sath: 'sarasari', changes: [] }).ok, false)
    // چتِ ناامن رد می‌شود
    assert.equal(mod.saveTik({ home: box.home, sath: 'chat', chat: '../../etc', changes: [{ kind: 'mcp', name: 'x', on: true }] }).ok, false)
  } finally { process.env.HOME = savedHome; box.done() }
})

test('tikDeniedFor: چت بر پوشه بر سراسری، و نامِ ناموجود نمی‌آید', async () => {
  const box = sandbox()
  const savedHome = process.env.HOME
  try {
    process.env.HOME = box.home
    const mod = await import('../index.js?' + Date.now())
    mod.saveTik({ home: box.home, sath: 'sarasari', changes: [{ kind: 'abzar_dsh', name: 'A', on: false }, { kind: 'abzar_dsh', name: 'B', on: false }] })
    mod.saveTik({ home: box.home, sath: 'poshe', cwd: box.work, changes: [{ kind: 'abzar_dsh', name: 'A', on: true }] })
    const known = ['A', 'B', 'C', 'Ghost']
    // پوشه A و B را خاموش می‌کند: A از پوشه روشن، B از سراسری خاموش
    assert.deepEqual(mod.tikDeniedFor({ home: box.home, cwd: box.work, known: known }).sort(), ['B'])
    // پوشهٔ دیگر: هر دو از سراسری
    assert.deepEqual(mod.tikDeniedFor({ home: box.home, cwd: box.other, known: known }).sort(), ['A', 'B'])
    // چتِ تازه که A را خاموش می‌کند
    mod.saveTik({ home: box.home, sath: 'chat', chat: 'session-1', changes: [{ kind: 'abzar_dsh', name: 'A', on: false }, { kind: 'abzar_dsh', name: 'Ghost', on: false }] })
    // Ghost در این چت خاموش شده، ولی وجود ندارد ⇒ نمی‌آید (بی خطای unknown global tool)
    const knownWithoutGhost = ['A', 'B', 'C']
    assert.deepEqual(mod.tikDeniedFor({ home: box.home, cwd: box.work, sessionId: 'session-1', known: knownWithoutGhost }).sort(), ['A', 'B'])
  } finally { process.env.HOME = savedHome; box.done() }
})

test('applyTik: روی چتِ تازه restrict صدا زده می‌شود و چتِ دیگر بی‌تیک می‌ماند', async () => {
  const box = sandbox()
  const savedHome = process.env.HOME
  try {
    process.env.HOME = box.home
    const mod = await import('../index.js?' + Date.now())
    mod.saveTik({ home: box.home, sath: 'sarasari', changes: [{ kind: 'abzar_dsh', name: 'web_search', on: false }] })

    const calls = []
    const mkCtx = () => ({
      effect: (fn) => fn(),
      get: (name) => (name === 'agents' ? { list: () => [] } : undefined),
      logger: { info: () => {}, warn: () => {} },
      inject: (deps, cb) => {
        if (deps.includes('tools') && !deps.includes('webServer')) {
          cb({ on: () => {}, logger: { info: () => {}, warn: () => {} } })
        }
      },
      tools: { definitions: () => [{ name: 'web_search' }, { name: 'bash' }] },
      mcpManager: { list: () => [{ name: 'hafeze' }] },
      skills: { list: async () => [{ name: 'nazer' }] },
      configEditor: { entries: () => [{ name: 'dsh-rtl' }] },
    })
    const ctx = mkCtx()
    ctx.inject = (deps, cb) => {
      if (deps.includes('webServer')) return cb({ webServer: { register: () => () => {} }, effect: (fn) => fn() })
      // چتِ دستی: روی agent.ctx باید restrict صدا زده شود
      const agent = {
        session: { id: 'session-new', header: { cwd: box.work } },
        ctx: {
          tools: {
            definitions: () => [{ name: 'web_search' }, { name: 'bash' }],
            restrict: (filter) => { calls.push({ sid: 'session-new', filter }) },
          },
        },
      }
      return cb({ on: (ev, fn) => { if (ev === 'agent/created') fn({ agent }) } })
    }
    mod.apply(ctx)
    assert.equal(calls.length, 1, 'restrict صدا زده شد')
    assert.deepEqual(calls[0].filter, { deny: ['web_search'] })
  } finally { process.env.HOME = savedHome; box.done() }
})

test('اسکیل: خاموشیِ ابزارِ skill کاتالوگِ اسکیل را هم خالی می‌کند (منطقِ dsh-tool-skill)', async () => {
  const box = sandbox()
  const savedHome = process.env.HOME
  try {
    process.env.HOME = box.home
    const mod = await import('../index.js?' + Date.now())
    // ابزارِ skill و دو اسکیل داریم
    mod.saveTik({ home: box.home, sath: 'sarasari', changes: [{ kind: 'abzar_dsh', name: 'skill', on: false }] })
    const known = ['skill', 'bash', 'web_search']
    const denied = mod.tikDeniedFor({ home: box.home, cwd: box.work, known: known })
    assert.deepEqual(denied, ['skill'])
    // همان قاعده‌ای که dsh-tool-skill دارد: اگر tools.get('skill', agent) !== skillTool،
    // کاتالوگ خالی می‌آید. یعنی خاموشیِ ابزارِ skill ⇒ اسکیل‌ها پنهان.
    const skillTool = { name: 'skill' }
    const toolsGet = (name, agent) => (denied.includes(name) ? undefined : skillTool)
    const snapshotWouldRun = toolsGet('skill', {}) === skillTool
    assert.equal(snapshotWouldRun, false, 'با خاموشیِ skill، کاتالوگِ اسکیل خوانده نمی‌شود')
    // و اگر روشن باشد، خوانده می‌شود
    mod.saveTik({ home: box.home, sath: 'sarasari', changes: [{ kind: 'abzar_dsh', name: 'skill', on: true }] })
    const denied2 = mod.tikDeniedFor({ home: box.home, cwd: box.work, known: known })
    assert.deepEqual(denied2, [])
    const toolsGet2 = (name) => (denied2.includes(name) ? undefined : skillTool)
    assert.equal(toolsGet2('skill') === skillTool, true)
  } finally { process.env.HOME = savedHome; box.done() }
})

test('MCP: سرور خاموش ⇒ ابزارهایش هم با پیشوند از فهرست می‌روند', async () => {
  const box = sandbox()
  const savedHome = process.env.HOME
  try {
    process.env.HOME = box.home
    const mod = await import('../index.js?' + Date.now())
    // نامِ ابزارهای MCP در DSH «mcp__<سرور>__<ابزار>» است
    const known = ['mcp__hafeze__gashtan_dar_hafeze', 'mcp__computer_use__computer', 'bash']
    mod.saveTik({ home: box.home, sath: 'sarasari', changes: [{ kind: 'mcp', name: 'hafeze', on: false }] })
    // تیکِ مکپ ⇒ ابزارهای همان سرور هم می‌روند
    assert.deepEqual(mod.tikDeniedFor({ home: box.home, cwd: box.work, known: known }), ['mcp__hafeze__gashtan_dar_hafeze'])
    // ...پس برای MCP باید نام‌ها را خودمان به دستهٔ ابزار ترجمه کنیم: این کار را applyTik می‌کند.
    const rows = mod.tikRows({ home: box.home, cwd: box.work, available: { abzar_dsh: known, mcp: ['hafeze', 'computer_use'], afzune: [], eskil: [] } })
    const mcpRow = rows.rows.find((r) => r.kind === 'mcp')
    assert.equal(mcpRow.items.find((i) => i.name === 'hafeze').on, false, 'hafeze خاموش دیده می‌شود')
    assert.equal(mcpRow.items.find((i) => i.name === 'computer_use').on, true, 'computer_use روشن می‌ماند')
  } finally { process.env.HOME = savedHome; box.done() }
})

test('پوشهٔ مؤثر: workingDirectory بر header مقدم است (چتی که پوشه‌اش را عوض کرده)', async () => {
  const box = sandbox()
  const savedHome = process.env.HOME
  try {
    process.env.HOME = box.home
    const mod = await import('../index.js?' + Date.now())
    // فقط پوشهٔ «work» یک تیک دارد
    mod.saveTik({ home: box.home, sath: 'poshe', cwd: box.work, changes: [{ kind: 'abzar_dsh', name: 'bash', on: false }] })
    const calls = []
    const ctx = {
      effect: (fn) => fn(),
      logger: { info: () => {}, warn: () => {} },
      get: (name) => {
        if (name === 'workingDirectory') return { get: () => box.work }   // پوشهٔ مؤثر
        if (name === 'agents') return { list: () => [] }
        return undefined
      },
      inject: (deps, cb) => {
        if (deps.includes('webServer')) return cb({ webServer: { register: () => () => {} }, effect: (fn) => fn() })
        if (deps.includes('tools')) {
          const agent = {
            // header یک پوشهٔ دیگر را می‌گوید (چت آن را عوض کرده)
            session: { id: 'session-moved', header: { cwd: box.other } },
            ctx: {
              tools: {
                definitions: () => [{ name: 'bash' }, { name: 'grep' }],
                restrict: (f) => calls.push(f),
              },
            },
          }
          return cb({ on: (ev, fn) => { if (ev === 'agent/created') fn({ agent }) } })
        }
      },
    }
    mod.apply(ctx)
    assert.deepEqual(calls, [{ deny: ['bash'] }], 'تیکِ پوشهٔ مؤثر (work) اعمال شد، نه پوشهٔ کهنه (other)')
  } finally { process.env.HOME = savedHome; box.done() }
})

test('تیکِ ناموجود: restrict با فیلترِ خالی صدا زده نمی‌شود و چت نمی‌شکند', async () => {
  const box = sandbox()
  const savedHome = process.env.HOME
  try {
    process.env.HOME = box.home
    const mod = await import('../index.js?' + Date.now())
    // فقط یک ابزارِ ناموجود خاموش شده
    mod.saveTik({ home: box.home, sath: 'sarasari', changes: [{ kind: 'abzar_dsh', name: 'ghost_tool', on: false }] })
    const calls = []
    const ctx = {
      effect: (fn) => fn(),
      logger: { info: () => {}, warn: () => {} },
      get: (n) => (n === 'agents' ? { list: () => [] } : undefined),
      inject: (deps, cb) => {
        if (deps.includes('webServer')) return cb({ webServer: { register: () => () => {} }, effect: (fn) => fn() })
        const agent = {
          session: { id: 'session-g', header: { cwd: box.work } },
          ctx: { tools: {
            definitions: () => [{ name: 'bash' }, { name: 'grep' }],
            // مثلِ DSH: نامِ ناشناخته ⇒ خطا
            restrict: (f) => {
              for (const n of f.deny) if (!['bash', 'grep'].includes(n)) throw new Error('unknown global tool ' + n)
              calls.push(f)
            },
          } },
        }
        return cb({ on: (ev, fn) => { if (ev === 'agent/created') fn({ agent }) } })
      },
    }
    mod.apply(ctx)
    assert.deepEqual(calls, [], 'فیلترِ خالی فرستاده نشد')
  } finally { process.env.HOME = savedHome; box.done() }
})
