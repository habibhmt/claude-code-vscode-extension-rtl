/**
 * dsh-nav — توابعِ خالصِ کمکی
 * ---------------------------
 * این فایل نه React دارد نه DOM؛ فقط توابعی که ورودی می‌گیرند و رشته/فهرست برمی‌گردانند.
 * برای همین مستقیماً با node --test آزمون می‌شود.
 *
 * قاعدهٔ اصلی: همهٔ این توابع «چیزی که سایدبار نشان می‌دهد» را بازتولید می‌کنند،
 * تا ردیفِ سرصفحه عیناً مثلِ سایدبار باشد و دو رفتارِ متفاوت در کار نباشد.
 */

/** یک پوشه (workspace) به شکلی که رابطِ کاربر لازم دارد. */
// WorkspaceView از خودِ اپ: { workspaceId, path, title, sessionIds, createdAt, updatedAt }

/**
 * نامِ کوتاهِ پوشه از روی مسیر کامل.
 * سایدبار همین کار را می‌کند: آخرین بخشِ مسیر، و اگر مسیر ته داشت («/») خطا نمی‌دهد.
 * @param {string} path - مسیرِ کاملِ پوشه
 * @returns {string} نامِ پوشه، یا خودِ مسیر اگر نامی پیدا نشد
 */
export function folderName(path) {
  if (typeof path !== 'string') return ''
  const trimmed = path.replace(/[\\/]+$/, '')
  if (trimmed === '') return path === '' ? '' : '/'
  const parts = trimmed.split(/[\\/]/)
  return parts[parts.length - 1] || trimmed
}

/**
 * برچسبِ پوشه: عنوانِ پوشه، و اگر نبود نامِ پوشه.
 * @param {{ title?: string, path?: string } | null | undefined} workspace
 * @returns {string}
 */
export function folderLabel(workspace) {
  if (!workspace || typeof workspace !== 'object') return ''
  if (typeof workspace.title === 'string' && workspace.title.trim() !== '') return workspace.title.trim()
  return folderName(workspace.path)
}

/**
 * فاصلهٔ زمانی به همان شکلی که سایدبار می‌نویسد: «now»، «9min»، «2h»، «3d»، «2mo»، «1y».
 * این دقیقاً همان قاعدهٔ ‎relativeTime‎ خودِ اپ است (از bundle خوانده شد):
 *   کمتر از ۱ دقیقه ⇒ now · کمتر از ۱ ساعت ⇒ min · کمتر از ۱ روز ⇒ h ·
 *   کمتر از ۳۰ روز ⇒ d · کمتر از ۳۶۵ روز ⇒ mo · بقیه ⇒ y
 * @param {number} updatedAt - زمانِ آخرین تغییر (میلی‌ثانیه)
 * @param {number} now - زمانِ الان (میلی‌ثانیه)
 * @returns {{ unit: 'now'|'minutes'|'hours'|'days'|'months'|'years', n: number }}
 */
export function relativeTime(updatedAt, now) {
  const delta = Math.max(0, Number(now) - Number(updatedAt))
  if (!Number.isFinite(delta)) return { unit: 'now', n: 0 }
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  if (delta < MIN) return { unit: 'now', n: 0 }
  if (delta < HOUR) return { unit: 'minutes', n: Math.floor(delta / MIN) }
  if (delta < DAY) return { unit: 'hours', n: Math.floor(delta / HOUR) }
  if (delta < 30 * DAY) return { unit: 'days', n: Math.floor(delta / DAY) }
  if (delta < 365 * DAY) return { unit: 'months', n: Math.floor(delta / (30 * DAY)) }
  return { unit: 'years', n: Math.floor(delta / (365 * DAY)) }
}

/** پسوندِ هر واحد، عیناً مثلِ فرهنگِ انگلیسیِ اپ. */
const UNIT_SUFFIX = { minutes: 'min', hours: 'h', days: 'd', months: 'mo', years: 'y' }

/**
 * همان فاصلهٔ زمانی به‌صورتِ رشتهٔ کوتاهِ سایدبار: «9min».
 * @param {number} updatedAt
 * @param {number} now
 * @returns {string}
 */
export function relativeTimeLabel(updatedAt, now) {
  const { unit, n } = relativeTime(updatedAt, now)
  if (unit === 'now') return 'now'
  return `${n}${UNIT_SUFFIX[unit]}`
}

/**
 * مرتب‌سازیِ چت‌ها: تازه‌ترین اول. این همان ‎orderByRecency‎ سایدبار است
 * (وقتی زمان برابر بود، شناسه تعیین‌کننده است، تا ترتیب همیشه ثابت بماند).
 * @template {{ id: string, updatedAt: number }} T
 * @param {readonly T[]} sessions
 * @returns {T[]}
 */
export function sortByRecency(sessions) {
  const list = Array.isArray(sessions) ? sessions.slice() : []
  return list.sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt
    return left.id < right.id ? -1 : 1
  })
}

/**
 * چت‌های یک پوشه، برای منوی «چت».
 * سایدبار چت‌های زیرِ پوشه را نشان می‌دهد؛ ساب‌ایجنت‌ها و پوشه‌نشین‌های بایگانی‌شده بیرون می‌مانند.
 * @param {object} input
 * @param {readonly string[]} input.sessionIds - شناسهٔ چت‌های این پوشه (از workspace.sessionIds)
 * @param {Record<string, { id: string, displayTitle?: string, updatedAt: number, running?: boolean, origin?: string, parentId?: string }>} input.byId
 * @param {readonly string[]} [input.archivedSessionIds]
 * @returns {Array<{ id: string, label: string, updatedAt: number, running: boolean, current: boolean }>} به ترتیبِ تازه‌ترین
 */
export function folderChats({ sessionIds, byId, archivedSessionIds }) {
  const archived = new Set(Array.isArray(archivedSessionIds) ? archivedSessionIds : [])
  const rows = []
  for (const id of Array.isArray(sessionIds) ? sessionIds : []) {
    const summary = byId ? byId[id] : undefined
    if (!summary) continue
    // ساب‌ایجنت‌ها زیرِ چتِ والدشان می‌نشینند، نه زیرِ پوشه.
    if (summary.origin === 'subagent') continue
    if (archived.has(id)) continue
    rows.push({
      id,
      label: typeof summary.displayTitle === 'string' && summary.displayTitle !== '' ? summary.displayTitle : id,
      updatedAt: typeof summary.updatedAt === 'number' ? summary.updatedAt : 0,
      running: summary.running === true,
      current: false,
    })
  }
  return sortByRecency(rows)
}

/**
 * فهرستِ منوی «پوشه»: همهٔ پوشه‌ها، تازه‌ترینِ هر کدام اول.
 * @param {readonly { workspaceId: string, title?: string, path?: string, updatedAt?: string, sessionIds?: readonly string[] }[]} workspaces
 * @param {{ currentWorkspaceId?: string }} [options]
 * @returns {Array<{ id: string, label: string, path: string, current: boolean, updatedAt: number }>}
 */
export function folderList(workspaces, options = {}) {
  const currentId = options && options.currentWorkspaceId
  const rows = []
  for (const workspace of Array.isArray(workspaces) ? workspaces : []) {
    if (!workspace || typeof workspace.workspaceId !== 'string') continue
    const parsed = Date.parse(workspace.updatedAt)
    rows.push({
      id: workspace.workspaceId,
      label: folderLabel(workspace),
      path: typeof workspace.path === 'string' ? workspace.path : '',
      current: workspace.workspaceId === currentId,
      updatedAt: Number.isFinite(parsed) ? parsed : 0,
    })
  }
  return rows.sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt
    return left.id < right.id ? -1 : 1
  })
}

/**
 * کدام پوشه مالِ این چت است؟ سایدبار پوشه را از روی مسیرِ کاریِ چت پیدا می‌کند.
 * @param {readonly { workspaceId: string, path?: string }[]} workspaces
 * @param {string | undefined} cwd - مسیرِ کاریِ چت
 * @returns {string | undefined} شناسهٔ پوشه
 */
export function workspaceOfSession(workspaces, cwd) {
  if (typeof cwd !== 'string' || cwd === '') return undefined
  const items = Array.isArray(workspaces) ? workspaces : []
  for (const workspace of items) {
    if (workspace && workspace.path === cwd) return workspace.workspaceId
  }
  return undefined
}

/**
 * شاخه‌های ساب‌ایجنتِ یک چت: از چتِ فعلی تا والدِ اصلی.
 * ردیفِ سرصفحه «پوشه / چت / ساب‌ایجنت» را از همین می‌سازیم.
 * @param {Record<string, { id: string, displayTitle?: string, parentId?: string, origin?: string }>} byId
 * @param {string | undefined} sessionId
 * @returns {Array<{ id: string, label: string, subagent: boolean }>} از والد به فرزند
 */
export function chatLineage(byId, sessionId) {
  const chain = []
  if (!byId || typeof sessionId !== 'string') return chain
  const seen = new Set()
  let cursor = sessionId
  while (cursor !== undefined) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const summary = byId[cursor]
    if (!summary) break
    chain.unshift({
      id: summary.id,
      label: typeof summary.displayTitle === 'string' && summary.displayTitle !== '' ? summary.displayTitle : summary.id,
      subagent: summary.origin === 'subagent',
    })
    if (summary.origin !== 'subagent') break
    cursor = summary.parentId
  }
  return chain
}

/**
 * چتِ والدِ اصلی (چتی که ساب‌ایجنت مالِ آن است)؛ برای چتِ عادی خودِ چت برمی‌گردد.
 * @param {Record<string, any>} byId
 * @param {string | undefined} sessionId
 * @returns {string | undefined}
 */
export function rootChatId(byId, sessionId) {
  const chain = chatLineage(byId, sessionId)
  return chain.length ? chain[0].id : undefined
}

/**
 * خلاصهٔ شمارش برای سرتیترِ منو (مثلِ «۳ چت · ۱ در حال اجرا»).
 * @param {{ total: number, running: number }} counts
 * @returns {string}
 */
export function menuCounter(counts) {
  const total = Number(counts && counts.total) || 0
  const running = Number(counts && counts.running) || 0
  const parts = [`${total} چت`]
  if (running > 0) parts.push(`${running} در حال اجرا`)
  return parts.join(' · ')
}
