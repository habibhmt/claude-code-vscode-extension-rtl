/** آزمونِ خرجِ ساب‌ایجنت‌ها (نصفِ host) — بی‌شبکه، با لاگِ قلابی. */
import assert from 'node:assert/strict'
import { parseSessionLog, summarizeChatCost, summarizeSubagents, collectDescendants, SUBAGENT_MAX_DEPTH } from '../cost-log.js'
import { chatCost } from '../index.js'

const ev = (type, time, data, seq) => JSON.stringify({ type, seq, time, data })
const cat = (time, childId, name, label, seq) => ev('subagent/catalog', time, { version: 3, childId, childCreatedAt: time - 20, mode: 'continuable', label, name }, seq)
const am = (turn, step, time, id, usage = { inputTokens: 100, outputTokens: 10 }) => ev('assistant/message', time, {
  turn, step, usage,
  message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'openrouter', model: 'deepseek/x',
    replayState: { response: { responseId: id, responseModel: 'deepseek/x' } } } },
})

// ---------- ۱) پارس: هر catalog یک ردیف، بی‌تکرار، نوبتِ درست ----------
{
  const log = [
    ev('turn/start', 1, { turn: 1 }),
    am(1, 1, 2, 'gen-a'),
    cat(10, 'child-a', 'ds-a', 'کارِ الف', 3),
    ev('turn/end', 11, {}),
    ev('turn/start', 20, { turn: 2 }),
    cat(30, 'child-b', 'ds-b', 'کارِ ب', 5),
    // همان childId دوباره (مثلاً تغییرِ نام) ⇒ یک ردیف، با آخرین نام
    cat(40, 'child-a', 'ds-a2', 'کارِ الفِ تازه', 6),
    ev('turn/end', 41, {}),
    // بی نوبتِ باز ⇒ turn می‌شود null، ولی ردیف هست
    cat(50, 'child-c', 'ds-c', 'کارِ ج', 7),
  ].join('\n')
  const parsed = parseSessionLog(log)
  assert.equal(parsed.subagents.length, 3, 'duplicate childId collapses into one row')
  const a = parsed.subagents.find(s => s.childId === 'child-a')
  assert.equal(a.turn, 1, 'turn of the nearest open turn')
  assert.equal(a.name, 'ds-a2', 'latest name wins')
  assert.equal(a.label, 'کارِ الفِ تازه', 'latest label wins')
  assert.equal(a.time, 10, 'start time stays the first sighting')
  const b = parsed.subagents.find(s => s.childId === 'child-b')
  assert.equal(b.turn, 2)
  const cChild = parsed.subagents.find(s => s.childId === 'child-c')
  assert.equal(cChild.turn, null, 'outside a turn ⇒ null, not a crash')
  // بقیهٔ خروجی دست‌نخورده
  assert.equal(parsed.requests.length, 1)
  assert.equal(parsed.turns.size, 2)
  // لاگی که هیچ ساب‌ایجنت ندارد ⇒ فهرستِ خالی (نه undefined)
  assert.deepEqual(parseSessionLog(log.split('\n').filter(l => !l.includes('subagent/catalog')).join('\n')).subagents, [])
}

// ---------- ۲) پارس: data.turn اگر خودِ رخداد داشت، مقدم است ----------
{
  const parsed = parseSessionLog([
    ev('turn/start', 1, { turn: 4 }),
    ev('subagent/catalog', 2, { childId: 'x1', name: 'n', label: 'l', turn: 9 }),
  ].join('\n'))
  assert.equal(parsed.subagents[0].turn, 9, 'own data.turn wins')
}

// ---------- ۳) جمع: خرجِ خودِ چت + فرزندان + جمعِ کل ----------
const sumOf = (ids) => summarizeChatCost(parseSessionLog(ids.map((id, i) => am(1, i + 1, 10 + i, id)).join('\n')), id => (id === 'gen-miss' ? undefined : 0.01))
{
  const own = sumOf(['gen-1', 'gen-2'])          // 0.02
  const childA = sumOf(['gen-3'])                // 0.01
  const childB = sumOf(['gen-4', 'gen-5', 'gen-miss']) // 0.02 + 1 pending
  const children = [
    { childId: 'a', name: 'ds-a', label: 'الف', turn: 1, time: 100, depth: 0, summary: childA },
    { childId: 'b', name: 'ds-b', label: 'ب', turn: 1, time: 200, depth: 0, summary: childB },
    { childId: 'gone', name: 'ds-gone', label: 'رفته', turn: 2, time: 300, depth: 0, summary: null },
  ]
  const out = summarizeSubagents(children, own.total)
  assert.equal(out.subagents.length, 3, 'a missing child still gets a row')
  assert.ok(Math.abs(out.subagentTotal - 0.03) < 1e-12, 'totals of the two found children')
  assert.equal(out.subagentPending, 1, 'pending prices counted')
  assert.ok(Math.abs(out.grandTotal - (own.total + 0.03)) < 1e-12, 'grand = own + subagents')
  const gone = out.subagents.find(s => s.childId === 'gone')
  assert.equal(gone.found, false, 'missing child ⇒ found:false')
  assert.equal(gone.total, 0, 'missing child adds nothing to the totals')
  assert.equal(gone.requests, 0)
  // شکلِ هر ردیف: همان فیلدهایی که کلاینت می‌خواهد
  for (const key of ['childId', 'name', 'label', 'turn', 'time', 'found', 'requests', 'priced', 'pending', 'total', 'estimated', 'tokens', 'byModel', 'providers', 'depth', 'parentId']) {
    assert.ok(key in out.subagents[0], 'row must have ' + key)
  }
  // مدل‌های ساب‌ایجنت‌ها جمع می‌شوند
  assert.equal(out.subagentModels.length, 1)
  assert.equal(out.subagentModels[0].model, 'x')
  assert.equal(out.subagentModels[0].count, 4, 'childA(1) + childB(3) requests')
  assert.equal(out.subagentModels[0].pending, 1)
  // ورودیِ خالی ⇒ صفر، نه خطا
  const empty = summarizeSubagents([], 1.5)
  assert.equal(empty.subagentTotal, 0)
  assert.equal(empty.grandTotal, 1.5)
  assert.deepEqual(summarizeSubagents(null, 0).subagents, [])
}

// ---------- ۴) درخت: تودرتو + دور + عمق ----------
{
  const mk = (childIds, extra = {}) => ({ requests: 0, turns: new Map(), subagents: childIds.map(id => ({ childId: id, name: id, label: id, turn: 1, time: 1 })), ...extra })
  const tree = new Map([
    ['root1', mk(['nested1'])],
    ['nested1', mk(['deep1'])],
    ['deep1', mk([])],
    ['cycler', mk(['root2'])],   // دور: root2 ⇐ cycler ⇐ root2
    ['root2', mk(['cycler'])],
  ])
  const read = async (id) => tree.get(id) ?? null
  const flat = await collectDescendants(read, [
    { childId: 'root1', name: 'ds-1', turn: 1, time: 1 },
    { childId: 'root2', name: 'ds-2', turn: 2, time: 2 },
    { childId: 'nolag', name: 'ds-x', turn: 3, time: 3 },
  ])
  const ids = flat.map(f => f.childId)
  assert.deepEqual(ids, ['root1', 'nested1', 'deep1', 'root2', 'cycler', 'nolag'], 'depth-first, cycle broken, missing log kept as a row')
  assert.deepEqual(flat.map(f => f.depth), [0, 1, 2, 0, 1, 0])
  assert.equal(flat[1].parentId, 'root1')
  assert.equal(flat[2].parentId, 'nested1')
  assert.equal(flat[4].parentId, 'root2')
  assert.equal(flat[5].summary, null, 'missing log ⇒ summary null')
  assert.equal(flat[5].parentId, null, 'top-level child has no parent')
  // فرزندِ خودش (خودارجاعی) ⇒ دوباره اضافه نمی‌شود
  const self = await collectDescendants(async (id) => (id === 'me' ? mk(['me']) : null), [{ childId: 'me', name: 'me' }])
  assert.deepEqual(self.map(f => f.childId), ['me'], 'a child that lists itself does not loop forever')
  // سقفِ عمق
  const chain = new Map()
  for (let d = 0; d <= SUBAGENT_MAX_DEPTH + 3; d++) chain.set('c' + d, mk(d + 1 <= SUBAGENT_MAX_DEPTH + 3 ? ['c' + (d + 1)] : []))
  const deep = await collectDescendants(async (id) => chain.get(id) ?? null, [{ childId: 'c0', name: 'c0' }])
  assert.ok(deep.length <= SUBAGENT_MAX_DEPTH + 1, 'depth is capped, got ' + deep.length)
  assert.ok(deep.every(f => f.depth <= SUBAGENT_MAX_DEPTH))
}

// ---------- ۵) chatCost: فیلدهای قدیمی سرِ جایشان، فیلدهای تازه هم می‌آیند ----------
{
  const logs = new Map([
    ['session-p', parseSessionLog([
      ev('turn/start', 1, { turn: 1 }),
      am(1, 1, 2, 'gen-p'),
      cat(5, 'kid-1', 'ds-1', 'کارِ فرزند', 2),
      cat(6, 'kid-missing', 'ds-ghost', 'لاگ ندارد', 3),
    ].join('\n'))],
    ['kid-1', parseSessionLog([
      ev('turn/start', 1, { turn: 1 }),
      am(1, 1, 2, 'gen-k'),
      cat(5, 'grand-1', 'ds-g', 'نوه', 2),
    ].join('\n'))],
    ['grand-1', parseSessionLog([ev('turn/start', 1, { turn: 1 }), am(1, 1, 2, 'gen-g')].join('\n'))],
  ])
  const prices = { 'gen-p': 0.5, 'gen-k': 0.02, 'gen-g': 0.004 }
  const out = await chatCost('session-p', {
    readChatLog: async (id) => logs.get(id) ?? null,
    priceBook: { priceOf: id => prices[id], flush() {} },
  })
  assert.equal(out.found, true)
  // فیلدهای قدیمی
  assert.equal(out.requests, 1)
  assert.equal(out.priced, 1)
  assert.ok(Math.abs(out.total - 0.5) < 1e-12, 'own total unchanged')
  assert.ok(Array.isArray(out.byModel) && Array.isArray(out.turns) && Array.isArray(out.list))
  // فیلدهای تازه
  assert.equal(out.subagents.length, 3, 'child + grandchild + one with no log')
  const kid = out.subagents.find(s => s.childId === 'kid-1')
  assert.equal(kid.found, true)
  assert.equal(kid.depth, 0)
  assert.equal(kid.turn, 1)
  const grand = out.subagents.find(s => s.childId === 'grand-1')
  assert.equal(grand.depth, 1, 'nested child included')
  assert.equal(grand.parentId, 'kid-1')
  const ghost = out.subagents.find(s => s.childId === 'kid-missing')
  assert.equal(ghost.found, false)
  assert.ok(Math.abs(out.subagentTotal - 0.024) < 1e-12, 'kid + grandchild; the missing one adds nothing')
  assert.equal(out.subagentPending, 0)
  assert.ok(Math.abs(out.grandTotal - 0.524) < 1e-12, 'grand total = own + subagents')
  assert.equal(out.subagentModels.length, 1, 'models of subagents only (deepseek/x)')
  // چتِ بی‌لاگ
  const none = await chatCost('nope', { readChatLog: async () => null, priceBook: { priceOf() {}, flush() {} } })
  assert.equal(none.found, false)
  // چتِ بی‌ساب‌ایجنت ⇒ فهرستِ خالی و جمعِ کل = خودِ چت
  const lone = await chatCost('session-p', {
    readChatLog: async () => parseSessionLog([ev('turn/start', 1, { turn: 1 }), am(1, 1, 2, 'gen-p')].join('\n')),
    priceBook: { priceOf: () => 0.5, flush() {} },
  })
  assert.deepEqual(lone.subagents, [])
  assert.equal(lone.subagentTotal, 0)
  assert.equal(lone.grandTotal, 0.5)
}

// ---------- ۶) قیمتِ در راه: جمع را «صفرِ دروغ» نمی‌کند، pending را می‌گوید ----------
{
  const parsed = parseSessionLog([ev('turn/start', 1, { turn: 1 }), am(1, 1, 2, 'gen-wait'), am(1, 2, 3, 'gen-done')].join('\n'))
  const s = summarizeChatCost(parsed, id => (id === 'gen-done' ? 0.01 : undefined))
  const out = summarizeSubagents([{ childId: 'k', name: 'k', label: 'k', turn: 1, time: 1, depth: 0, summary: s }], 0)
  assert.equal(out.subagents[0].pending, 1)
  assert.ok(Math.abs(out.subagents[0].total - 0.01) < 1e-12)
  assert.equal(out.subagentPending, 1)
}

console.log('subagents OK: پارسِ catalog (بی‌تکرار، نوبت، data.turn) + جمعِ تودرتو + دور + لاگِ گم‌شده + chatCost')
