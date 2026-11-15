/**
 * Side Panel — Client half
 * ------------------------
 * حبیب (۱۴ نوامبر): «تراژکتوری یا استاتیستیک بغلِ صفحهٔ چت نشون داده بشه» ·
 * «همان دکمه پنل را باز کند» · «چت چپ، پنل راست» · «ابعاد قابلیتِ کوچیک‌بزرگ‌کردن» ·
 * «به تفکیکِ چت» · «به زبانِ من».
 *
 * ۱) تبِ کنارِ چت (kind = side-panel) با دو بخش: «تراژکتوری به فارسی» و «آمار».
 * ۲) دکمه‌های Trajectory / Statistics ِ بالای چت ⇒ همین پنل کنارِ چت باز می‌شود و
 *    چت سرِ جایش می‌ماند. Option(Alt)+کلیک یا دکمهٔ «تمام‌صفحه» ⇒ همان صفحهٔ کاملِ قدیم.
 * ۳) در چیدمانِ راست‌به‌چپ: سایدبار راست می‌ماند، پنل کنارش، چت سمتِ چپ؛
 *    دستهٔ تغییرِ اندازهٔ پنل هم روی مرزِ واقعیِ چت و پنل می‌نشیند.
 * ۴) خرجِ دقیقِ همین چت از OpenRouter (نصفِ host، /plugins/side-panel/session-cost).
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-side-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const Fragment = React.Fragment

    /* #region fold-inline — تولیدِ خودکار از panel-fold.js (tools/sync-fold.mjs) */

    /** شکلِ usage در لاگ ممکن است ناقص یا null باشد؛ این تابع همیشه عدد یا null می‌دهد. */
    function normalizeUsage(usage) {
      if (!usage || typeof usage !== 'object') return null
      const pick = (key) => (typeof usage[key] === 'number' && Number.isFinite(usage[key]) ? usage[key] : null)
      const input = pick('inputTokens')
      const output = pick('outputTokens')
      const total = pick('totalTokens') ?? (input !== null && output !== null ? input + output : null)
      const cacheRead = pick('cacheReadTokens')
      const cacheWrite = pick('cacheWriteTokens')
      if (input === null && output === null && total === null) return null
      return { input, output, total, cacheRead, cacheWrite }
    }

    /** مدتِ یک درخواست به میلی‌ثانیه، یا null وقتی تمام نشده. */
    function requestDurationMs(request) {
      if (!request || typeof request.startedAt !== 'number') return null
      if (typeof request.completedAt !== 'number') return null
      const value = request.completedAt - request.startedAt
      return Number.isFinite(value) && value >= 0 ? value : null
    }

    /** شناسهٔ مدلِ یک درخواست: «provider/model» یا «نامعلوم». */
    function requestModel(request) {
      const meta = request && request.providerMetadata
      if (!meta || typeof meta.model !== 'string' || meta.model === '') return 'نامعلوم'
      return typeof meta.provider === 'string' && meta.provider !== ''
        ? `${meta.provider}/${meta.model}`
        : meta.model
    }

    /**
     * هزینهٔ یک درخواست از روی توکن و قیمتِ هر میلیون توکن.
     * قیمت نامعلوم ⇒ null (نه صفر)، تا «نامعلوم» نشان داده شود نه «رایگان».
     */
    function requestCost(request, price) {
      const usage = normalizeUsage(request && request.usage)
      if (!usage || !price) return null
      const perMillionIn = typeof price.prompt === 'number' ? price.prompt : null
      const perMillionOut = typeof price.completion === 'number' ? price.completion : null
      if (perMillionIn === null || perMillionOut === null) return null
      const inputTokens = usage.input ?? 0
      const outputTokens = usage.output ?? 0
      const value = (inputTokens / 1_000_000) * perMillionIn + (outputTokens / 1_000_000) * perMillionOut
      return Number.isFinite(value) ? value : null
    }

    /** خلاصهٔ یک درخواست برای کارتِ «چه فرستادیم / چه برگشت». */
    function summarizeRequest(request) {
      const usage = normalizeUsage(request && request.usage)
      return {
        turn: request && typeof request.turn === 'number' ? request.turn : null,
        step: request && typeof request.step === 'number' ? request.step : null,
        model: requestModel(request),
        status: request && request.status ? request.status : 'نامعلوم',
        durationMs: requestDurationMs(request),
        inputTokens: usage ? usage.input : null,
        outputTokens: usage ? usage.output : null,
        cacheReadTokens: usage ? usage.cacheRead : null,
        retry: request && typeof request.retry === 'number' ? request.retry : null,
        error: request && typeof request.error === 'string' && request.error !== '' ? request.error : null,
      }
    }

    /**
     * مقایسهٔ دو درخواستِ متوالی برای کارتِ «چرا گران شد».
     * اگر قبلی نبود یا صفر بود، نسبت null می‌شود (نه بی‌نهایت).
     */
    function compareRequests(previous, current) {
      const before = normalizeUsage(previous && previous.usage)
      const after = normalizeUsage(current && current.usage)
      const ratio = (from, to) => {
        if (typeof from !== 'number' || typeof to !== 'number' || from === 0) return null
        return to / from
      }
      return {
        inputRatio: ratio(before && before.input, after && after.input),
        outputRatio: ratio(before && before.output, after && after.output),
        inputDelta: before && after && typeof before.input === 'number' && typeof after.input === 'number'
          ? after.input - before.input
          : null,
        cacheMissed: Boolean(before && after && (after.cacheRead === null || after.cacheRead === 0)),
      }
    }

    /** شمارشِ رخدادها برای کارتِ «ابزارها» و نوارِ خلاصه. */
    function summarizeEvents(eventNodes) {
      const nodes = Array.isArray(eventNodes) ? eventNodes : []
      const byKind = new Map()
      const tools = []
      for (const node of nodes) {
        const kind = node && typeof node.kind === 'string' ? node.kind : 'نامعلوم'
        byKind.set(kind, (byKind.get(kind) ?? 0) + 1)
        if (kind === 'tool-result') {
          tools.push({
            name: typeof node.name === 'string' && node.name !== '' ? node.name : 'ابزار',
            time: typeof node.time === 'number' ? node.time : null,
            isError: Boolean(node.isError),
          })
        }
      }
      return { total: nodes.length, byKind: Object.fromEntries(byKind), tools }
    }

    /** عددِ دلاری با چهار رقمِ اعشار؛ null ⇒ «نامعلوم». */
    function formatMoney(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'نامعلوم'
      return `$${value.toFixed(4)}`
    }

    /** درصدِ مصرف از سقف؛ سقف صفر یا نامعلوم ⇒ null. */
    function usagePercent(usage, limit) {
      if (typeof usage !== 'number' || typeof limit !== 'number' || limit <= 0) return null
      const percent = (usage / limit) * 100
      return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null
    }

    /** خلاصهٔ کلِ سشن: تعدادِ درخواست، مدل‌ها، جمعِ توکن. */
    function summarizeSession(snapshot) {
      const requests = Array.isArray(snapshot && snapshot.requests) ? snapshot.requests : []
      const events = summarizeEvents(snapshot && snapshot.eventNodes)
      let input = 0
      let output = 0
      let known = 0
      const models = new Map()
      for (const request of requests) {
        const usage = normalizeUsage(request && request.usage)
        if (usage) {
          if (typeof usage.input === 'number') input += usage.input
          if (typeof usage.output === 'number') output += usage.output
          known += 1
        }
        const model = requestModel(request)
        models.set(model, (models.get(model) ?? 0) + 1)
      }
      return {
        requests: requests.length,
        events: events.total,
        tools: events.tools.length,
        inputTokens: known > 0 ? input : null,
        outputTokens: known > 0 ? output : null,
        models: [...models.entries()].map(([model, count]) => ({ model, count })),
      }
    }
    /**
     * خلاصهٔ آمارِ سشن از `StatsSnapshot` (پنلِ Statistics).
     * شکل: { turns: StatsTurnMetrics[], stepCount }
     * هیچ‌وقت throw نمی‌کند: دادهٔ ناقص ⇒ null، نه NaN.
     */
    function summarizeStats(statsSnapshot) {
      const turns = Array.isArray(statsSnapshot && statsSnapshot.turns) ? statsSnapshot.turns : []
      const last = turns.length > 0 ? turns[turns.length - 1] : null
      const sum = (field) => {
        let total = 0
        let seen = false
        for (const turn of turns) {
          const value = turn && turn[field]
          if (typeof value === 'number' && Number.isFinite(value)) { total += value; seen = true }
        }
        return seen ? total : null
      }
      const tools = new Map()
      for (const turn of turns) {
        const list = Array.isArray(turn && turn.tools) ? turn.tools : []
        for (const entry of list) {
          if (!entry || typeof entry.name !== 'string') continue
          tools.set(entry.name, (tools.get(entry.name) ?? 0) + (typeof entry.count === 'number' ? entry.count : 0))
        }
      }
      return {
        turns: turns.length,
        steps: typeof (statsSnapshot && statsSnapshot.stepCount) === 'number' ? statsSnapshot.stepCount : null,
        context: sum('context'),
        output: sum('output'),
        ttft: last && typeof last.ttft === 'number' ? last.ttft : null,
        modelMs: sum('model'),
        toolMs: sum('tool'),
        tps: last && typeof last.tps === 'number' ? last.tps : null,
        cacheHit: last && typeof last.cacheHit === 'number' ? last.cacheHit : null,
        cacheRead: sum('cacheRead'),
        tools: [...tools.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      }
    }

    /**
     * قالبِ ستون‌های فریم را به سه تکه می‌شکند (فاصله‌های داخلِ پرانتز نمی‌شکنند).
     * «280px minmax(360px, 1fr) minmax(0px, 520px)» ⇒ ['280px', 'minmax(360px, 1fr)', 'minmax(0px, 520px)']
     */
    function splitTracks(template) {
      if (typeof template !== 'string') return []
      const parts = []
      let depth = 0
      let current = ''
      for (const ch of template.trim()) {
        if (ch === '(') depth += 1
        if (ch === ')') depth = Math.max(0, depth - 1)
        if (/\s/.test(ch) && depth === 0) {
          if (current !== '') { parts.push(current); current = '' }
          continue
        }
        current += ch
      }
      if (current !== '') parts.push(current)
      return parts
    }

    /**
     * جای ستونِ چت و ستونِ پنل را عوض می‌کند (ستونِ اول = سایدبار، دست نمی‌خورد).
     * در چیدمانِ راست‌به‌چپ یعنی: سایدبار راست، پنل کنارش، چت سمتِ چپ.
     * قالبِ ناشناخته ⇒ null (هیچ کاری نکن).
     */
    function swapMiddleTracks(template) {
      const parts = splitTracks(template)
      if (parts.length !== 3) return null
      return [parts[0], parts[2], parts[1]].join(' ')
    }

    /** عرضِ ستونِ اول به پیکسل (سایدبار)؛ ناشناخته ⇒ null. */
    function firstTrackPx(template) {
      const first = splitTracks(template)[0]
      if (!first || !/^-?\d+(\.\d+)?px$/.test(first)) return null
      return Number.parseFloat(first)
    }

    /** عددِ فارسی با جداکننده: 12345 ⇒ «۱۲٬۳۴۵». */
    function faNum(value, digits = 0) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return value.toLocaleString('fa-IR', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    }

    /** دلار: کمتر از یک سنت با ۵ رقم، بقیه با ۴ رقم. */
    function faMoney(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      // LRI…PDI (جداسازِ چپ‌به‌راست): وسطِ جملهٔ فارسی، «$» به آن سرِ عدد نمی‌پرد
      // (بی این، «نوبتِ ۲ · $0.0151» روی صفحه «0.0151$» می‌شد — قاعدهٔ W2 ِ یونیکد).
      return '\u2066$' + value.toFixed(Math.abs(value) < 0.01 ? 5 : 4) + '\u2069'
    }

    /**
     * یک جملهٔ سادهٔ فارسی: «چرا این رفت‌وبرگشت این‌قدر خرج داشت».
     * row = { input (توکنِ تازه/بی‌کش), cached, output, cost }
     */
    function explainCost(row) {
      if (!row) return ''
      const fresh = typeof row.input === 'number' ? row.input : 0
      const cached = typeof row.cached === 'number' ? row.cached : 0
      const output = typeof row.output === 'number' ? row.output : 0
      const sent = fresh + cached
      if (sent === 0 && output === 0) return 'توکنی ثبت نشده.'
      const cachedShare = sent > 0 ? cached / sent : 0
      const reasons = []
      if (sent > 0 && cachedShare < 0.5 && fresh > 20000) {
        reasons.push(`کش نخورد: ${faNum(fresh)} توکن تازه فرستاده شد (گران‌ترین بخش)`)
      } else if (cachedShare >= 0.9) {
        reasons.push(`${faNum(Math.round(cachedShare * 100))}٪ ورودی از کش آمد (ارزان)`)
      } else if (fresh > 0) {
        reasons.push(`${faNum(fresh)} توکن تازه + ${faNum(cached)} از کش`)
      }
      if (sent > 150000) reasons.push(`تاریخچهٔ چت بزرگ است (${faNum(Math.round(sent / 1000))} هزار توکن هر بار فرستاده می‌شود)`)
      if (output > 4000) reasons.push(`جوابِ بلند: ${faNum(output)} توکن`)
      return reasons.length > 0 ? reasons.join(' · ') : 'رفت‌وبرگشتِ کوچک'
    }

    /**
     * ترتیبِ کارت‌های پنل: ذخیره‌شده + پیش‌فرض ⇒ فهرستِ کامل و بی‌تکرار.
     * saved = آنچه در localStorage بود (شاید هیچ، شاید زباله)؛ defaults = ترتیبِ پیش‌فرض.
     * شناسه‌های تازه (که در saved نبودند) به ترتیبِ پیش‌فرض، ته فهرست می‌چسبند؛
     * شناسهٔ ناشناخته در saved دور ریخته می‌شود. هیچ‌وقت throw نمی‌کند.
     * @param {unknown} saved - فهرستِ ذخیره‌شده (یا هر چیزِ دیگر).
     * @param {string[]} defaults - همهٔ شناسه‌های همین بخش، به ترتیبِ پیش‌فرض.
     * @returns {string[]} همهٔ شناسه‌های defaults، اولی‌ها به ترتیبِ saved.
     */
    function mergeOrder(saved, defaults) {
      const list = Array.isArray(defaults) ? defaults.filter(id => typeof id === 'string' && id !== '') : []
      const known = new Set(list)
      const out = []
      for (const id of Array.isArray(saved) ? saved : []) {
        if (typeof id !== 'string' || !known.has(id) || out.includes(id)) continue
        out.push(id)
      }
      for (const id of list) if (!out.includes(id)) out.push(id)
      return out
    }

    /**
     * جای یک شناسه را در فهرست delta خانه جابه‌جا می‌کند (▲ = −۱، ▼ = +۱).
     * بیرون از فهرست یا بیرون از مرز ⇒ همان فهرست (بدونِ تغییر).
     * @param {string[]} order
     * @param {string} id
     * @param {number} delta
     * @returns {string[]}
     */
    function moveId(order, id, delta) {
      const list = Array.isArray(order) ? order.slice() : []
      const from = list.indexOf(id)
      const step = typeof delta === 'number' && Number.isFinite(delta) ? delta : 0
      const to = from + step
      if (from < 0 || step === 0 || to < 0 || to >= list.length) return list
      list.splice(from, 1)
      list.splice(to, 0, id)
      return list
    }

    /** پهنای پیش‌فرضِ پنل (توافقِ ۲۱:۲۰، سؤالِ ۴): حداکثر ۵۲۰، و چت دستِ‌کم ۶۸۰ بماند. */
    function preferredPanelWidth(frameWidth, sidebarWidth) {
      return Math.min(520, frameWidth - (sidebarWidth || 0) - 680)
    }

    const PANEL_MIN_WIDTH = 300
    const PANEL_CHAT_MIN = 400

    /**
     * سقفِ پهنای پنل: پنل هرچه پهن‌تر، چت باید دستِ‌کم ۴۰۰ پیکسل بماند.
     * @param {number} frameWidth - عرضِ کلِ قاب.
     * @param {number} sidebarWidth - عرضِ سایدبار.
     * @returns {number} بیشترین پهنای مجاز (هرگز از کمینه کمتر نمی‌شود).
     */
    function maxPanelWidth(frameWidth, sidebarWidth) {
      if (typeof frameWidth !== 'number' || !Number.isFinite(frameWidth)) return PANEL_MIN_WIDTH
      const rest = frameWidth - (typeof sidebarWidth === 'number' && Number.isFinite(sidebarWidth) ? sidebarWidth : 0) - PANEL_CHAT_MIN
      return Math.max(PANEL_MIN_WIDTH, Math.round(rest))
    }

    /**
     * پهنای خواسته‌شده را به بازهٔ مجاز می‌آورد (بی‌این، پنل یا چت از صفحه بیرون می‌زد).
     * عددِ نامعتبر ⇒ بیشترین مجاز؟ نه: کمترین؛ تا پنلِ خراب‌شده چت را نبلعد.
     * @param {number} wanted - پهنای خواسته‌شده (پیکسل).
     * @param {number} frameWidth - عرضِ کلِ قاب.
     * @param {number} sidebarWidth - عرضِ سایدبار.
     * @returns {number} پهنای مجاز.
     */
    function clampPanelWidth(wanted, frameWidth, sidebarWidth) {
      const max = maxPanelWidth(frameWidth, sidebarWidth)
      // بی‌نهایت یعنی «هرچه پهن‌تر» ⇒ سقف؛ عددِ نامعتبر (NaN، متن، هیچ) ⇒ کمینه.
      if (wanted === Infinity) return max
      const value = typeof wanted === 'number' && Number.isFinite(wanted) ? Math.round(wanted) : PANEL_MIN_WIDTH
      return Math.min(max, Math.max(PANEL_MIN_WIDTH, value))
    }
    /* #endregion fold-inline */

    const KIND = 'side-panel'
    const TAB_ID = '@local/dsh-side-panel/panel'
    const VIEW_IDS = new Set(['trajectory', 'stats'])

    const CSS = {
      root: {
        padding: '10px 12px 16px',
        fontFamily: 'inherit',
        fontSize: '13px',
        lineHeight: 1.85,
        overflow: 'auto',
        height: '100%',
        boxSizing: 'border-box',
      },
      bar: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' },
      tab: (active) => ({
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
        background: active ? 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.18))' : 'transparent',
        color: 'inherit', borderRadius: 7, padding: '2px 10px', cursor: 'pointer', font: 'inherit',
        fontWeight: active ? 700 : 400,
      }),
      ghost: {
        marginInlineStart: 'auto', border: 0, background: 'transparent', color: 'inherit',
        opacity: 0.7, cursor: 'pointer', font: 'inherit', fontSize: 12,
      },
      card: {
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3))',
        borderRadius: '8px',
        padding: '8px 11px',
        marginBottom: '9px',
      },
      title: { fontWeight: 700, marginBottom: '4px' },
      hint: { opacity: 0.68, fontSize: '12px' },
      big: { fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
      row: { padding: '3px 0', borderTop: '1px dashed var(--dsw-alias-border-l1, rgba(128,128,128,.2))' },
      live: { color: 'var(--dsw-alias-brand-primary, #3b82f6)', fontWeight: 700 },
      red: { color: '#ef4444' },
      amber: { color: '#f59e0b' },
      redCard: { border: '1px solid #ef4444', background: 'rgba(239,68,68,.08)', borderRadius: '8px', padding: '8px 11px', marginBottom: '9px' },
      okCard: { border: '1px solid rgba(34,197,94,.6)', background: 'rgba(34,197,94,.06)', borderRadius: '8px', padding: '8px 11px', marginBottom: '9px' },
      // جدول‌ها: پنل باریک است ⇒ عرضِ کامل + اسکرولِ افقی؛ سرِ ستون‌ها چسبیده بالا
      tw: { width: '100%', overflowX: 'auto', marginTop: 4 },
      tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
      th: {
        position: 'sticky', top: 0, zIndex: 1, background: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,.14))',
        border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))', padding: '3px 6px',
        textAlign: 'start', fontWeight: 700, whiteSpace: 'nowrap',
      },
      td: {
        border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25))', padding: '3px 6px',
        verticalAlign: 'top', fontVariantNumeric: 'tabular-nums',
      },
      titleRow: { display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', marginBottom: 4 },
      titleText: { fontWeight: 700, cursor: 'pointer', flex: '1 1 auto' },
      orderBtn: {
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))', background: 'transparent',
        color: 'inherit', borderRadius: 5, padding: '0 5px', cursor: 'pointer', font: 'inherit',
        fontSize: 11, lineHeight: '16px', opacity: 0.8,
      },
      pre: {
        margin: '4px 0 0', padding: '6px 8px', border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))',
        borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '60vh', overflow: 'auto',
        fontSize: 11.5, lineHeight: 1.5, textAlign: 'left',
      },
      ltr: { direction: 'ltr', unicodeBidi: 'isolate', textAlign: 'left' },
      miniBtn: {
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))', background: 'transparent',
        color: 'inherit', borderRadius: 6, padding: '0 8px', cursor: 'pointer', font: 'inherit', fontSize: 12,
      },
    }

    /* ---------- بخشِ فعالِ پنل (تراژکتوری / آمار) — مشترک بینِ دکمه‌ها و پنل ---------- */
    let currentSection = 'trajectory'
    const sectionListeners = new Set()
    function setSection(next) {
      if (next !== 'trajectory' && next !== 'stats') return
      currentSection = next
      for (const listener of sectionListeners) listener(next)
    }
    function useSection() {
      const [value, setValue] = React.useState(currentSection)
      React.useEffect(() => {
        sectionListeners.add(setValue)
        return () => { sectionListeners.delete(setValue) }
      }, [])
      return value
    }

    /** خواندنِ دوره‌ایِ یک مسیرِ host. */
    function usePoll(url, everyMs) {
      const [state, setState] = React.useState({ status: 'loading' })
      React.useEffect(() => {
        if (!url) return undefined
        let alive = true
        const load = async () => {
          try {
            const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
            const json = await res.json()
            if (!alive) return
            if (!res.ok || json.error) setState({ status: 'error', error: json.error || ('HTTP ' + res.status) })
            else setState({ status: 'ok', value: json })
          } catch (err) {
            if (alive) setState({ status: 'error', error: String(err && err.message ? err.message : err) })
          }
        }
        load()
        const timer = setInterval(load, everyMs)
        return () => { alive = false; clearInterval(timer) }
      }, [url, everyMs])
      return state
    }

    /** snapshot یک target ِ همین سشن (اول subscribe، بعد getSnapshot — قاعدهٔ خودِ اپ). */
    function useTarget(ctx, sessionId, targetName) {
      const [snapshot, setSnapshot] = React.useState(null)
      const [error, setError] = React.useState(null)
      React.useEffect(() => {
        if (!sessionId || !ctx || !ctx.uiConversation) return undefined
        let target
        try {
          target = ctx.uiConversation.binding(sessionId).target(targetName)
        } catch (err) {
          setError(String(err && err.message ? err.message : err))
          return undefined
        }
        const read = () => {
          try { setSnapshot(target.getSnapshot() || null) } catch (err) { setError(String(err)) }
        }
        const off = typeof target.subscribe === 'function' ? target.subscribe(read) : undefined
        read()
        return () => { if (typeof off === 'function') off() }
      }, [ctx, sessionId, targetName])
      return { snapshot, error }
    }

    /* ---------- حافظهٔ مرورگر: ترتیبِ کارت‌ها + باز/بسته — هیچ‌وقت خطا نمی‌دهد ---------- */
    function storage() {
      try {
        const s = typeof localStorage !== 'undefined' ? localStorage : (typeof window !== 'undefined' ? window.localStorage : undefined)
        return s || null
      } catch { return null }
    }
    function readJson(key) {
      const s = storage()
      if (!s) return null
      try {
        const text = s.getItem(key)
        return text === null || text === undefined ? null : JSON.parse(text)
      } catch { return null }
    }
    function writeJson(key, value) {
      const s = storage()
      if (!s) return
      try { s.setItem(key, JSON.stringify(value)) } catch { /* حافظه پر یا بسته */ }
    }
    const ORDER_PREFIX = 'dsh-side-panel/order/'
    const OPEN_PREFIX = 'dsh-side-panel/open/'
    function trimText(text, max) {
      const s = typeof text === 'string' ? text : ''
      return s.length > max ? s.slice(0, max) + '…' : s
    }

    /**
     * propsِ جابه‌جاییِ کارت. مقدارِ undefined نگذار: cloneElement آن را روی propsِ کارت می‌ریزد
     * و کلیدهای هم‌نام (id، delta …) را می‌بلعد.
     */
    function orderProps(move, index, count) {
      return { move: move || null, upDisabled: index === 0, downDisabled: index === count - 1 }
    }

    /** ترتیبِ کارت‌های یک بخش: از حافظهٔ مرورگر (▲/▼) + بالا/پایین‌بردن. */
    function useCardOrder(section, defaults) {
      const [order, setOrder] = React.useState(() => mergeOrder(readJson(ORDER_PREFIX + section), defaults))
      const all = React.useMemo(() => mergeOrder(order, defaults), [order, defaults])
      // نامِ پارامتر cardId است، نه id: کلیدِ JSON متغیری به نامِ id را می‌بلعد (بی این، جابه‌جایی نمی‌شد).
      const move = (cardId, delta) => setOrder((prev) => {
        const next = moveId(mergeOrder(prev, defaults), cardId, delta)
        writeJson(ORDER_PREFIX + section, next)
        return next
      })
      return { order: all, move }
    }

    /**
     * کارتِ پنل: عنوان و باز/بسته‌شدن + دو دکمهٔ ▲/▼ برای جابه‌جا کردنِ کارت.
     * دکمه‌ها stopPropagation می‌کنند تا کارت باز/بسته نشود.
     */
    function Card(props) {
      const key = OPEN_PREFIX + props.id
      const [open, setOpen] = React.useState(() => {
        const saved = readJson(key)
        return typeof saved === 'boolean' ? saved : props.defaultOpen !== false
      })
      const toggle = () => {
        const next = !open
        setOpen(next)
        writeJson(key, next)
      }
      return h('div', { style: props.accent ? CSS.redCard : CSS.card, 'data-card-id': props.id },
        h('div', { style: CSS.titleRow },
          h('div', {
            style: { ...CSS.titleText, ...(props.accent || null) },
            onClick: toggle,
            role: 'button',
            'aria-expanded': open,
          }, (open ? '▾ ' : '▸ ') + props.title),
          h('button', {
            type: 'button', style: CSS.orderBtn, disabled: Boolean(props.upDisabled),
            'aria-label': 'بالا بردن', title: 'این کارت را یک پله بالاتر ببر',
            'data-move': 'up',
            onClick: (event) => { event.stopPropagation(); if (props.move && !props.upDisabled) props.move(props.id, -1) },
          }, '▲'),
          h('button', {
            type: 'button', style: CSS.orderBtn, disabled: Boolean(props.downDisabled),
            'aria-label': 'پایین بردن', title: 'این کارت را یک پله پایین‌تر ببر',
            'data-move': 'down',
            onClick: (event) => { event.stopPropagation(); if (props.move && !props.downDisabled) props.move(props.id, 1) },
          }, '▼')),
        // محتوا فقط وقتی ساخته می‌شود که کارت باز باشد (rawBody تابع است ⇒ تنبل)؛
        // کارتِ دادهٔ خامِ بسته هیچ درخواستی نمی‌فرستد.
        open
          ? h('div', null, typeof props.rawBody === 'function' ? props.rawBody() : props.children)
          : null,
      )
    }

    /* ---------- کرکرهٔ پهنا (حبیب: «یه دکمه بزار کرکره‌ای بتونم کوچیک بزرگش کنم») ---------- */
    const WIDTH_PRESETS = [
      { label: 'باریک', value: 360 },
      { label: 'متوسط', value: 520 },
      { label: 'پهن', value: 760 },
    ]

    /**
     * دکمهٔ «پهنا ⇔» + کرکره‌ای که پنل را پهن/باریک می‌کند.
     * نبودِ قاب/دسته ⇒ پیامِ ساده، نه خطا.
     */
    function WidthShutter() {
      const [open, setOpen] = React.useState(false)
      const [width, setWidth] = React.useState(() => currentPanelWidth())
      const [limits, setLimits] = React.useState(null)
      const [frameFound, setFrameFound] = React.useState(true)
      const lastApply = React.useRef(0)
      const raf = React.useRef(0)

      const refresh = React.useCallback(() => {
        const part = panelFrame()
        setFrameFound(Boolean(part))
        if (!part) { setLimits(null); return }
        const l = widthLimits(part)
        setLimits(l)
        setWidth(Math.round(l.current))
      }, [])

      React.useEffect(() => {
        if (!open) return undefined
        refresh()
        const timer = setInterval(refresh, 1000)
        return () => clearInterval(timer)
      }, [open, refresh])

      // عدد را فوری نشان بده، خودِ پهن‌کردن را حداکثر هر ۸۰ میلی‌ثانیه یک بار.
      const apply = (value) => {
        setWidth(value)
        const now = Date.now()
        if (now - lastApply.current >= 80) {
          lastApply.current = now
          setPanelWidth(value)
          return
        }
        if (typeof requestAnimationFrame === 'function') {
          if (raf.current) return
          raf.current = requestAnimationFrame(() => {
            raf.current = 0
            lastApply.current = Date.now()
            setPanelWidth(value)
          })
        }
      }

      const max = limits ? limits.max : 520
      const min = PANEL_MIN_WIDTH
      return h(Fragment, null,
        h('button', {
          type: 'button',
          style: CSS.tab(open),
          'data-width-toggle': '',
          title: 'پهن یا باریک کردنِ پنل',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => { setOpen(!open); if (!open) refresh() },
        }, 'پهنا ⇔'),
        open && h('div', {
          style: {
            flexBasis: '100%', border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
            borderRadius: 8, padding: '6px 8px', marginBottom: 6,
            overflow: 'hidden', transition: 'max-height .18s ease',
            maxHeight: open ? 200 : 0,
          },
          'data-width-shutter': '',
        },
        !frameFound
          ? h('div', { style: CSS.hint }, 'پنل را باز کنید تا پهنایش قابلِ تنظیم شود.')
          : h(Fragment, null,
            h('div', { 'data-width-label': '' }, 'پهنا: ' + faNum(width) + ' پیکسل'),
            h('input', {
              type: 'range',
              'data-width-range': '',
              min: String(min),
              max: String(max),
              step: '10',
              value: String(Math.round(Math.min(max, Math.max(min, width)))),
              'aria-label': 'پهنای پنل به پیکسل',
              style: { width: '100%', direction: 'ltr' },
              onChange: (event) => apply(Number(event.target.value)),
              onInput: (event) => apply(Number(event.target.value)),
            }),
            h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 } },
              WIDTH_PRESETS.map(p => h('button', {
                key: p.label,
                type: 'button',
                style: CSS.miniBtn,
                'data-width-preset': p.value,
                disabled: p.value > max,
                onClick: () => apply(p.value),
              }, p.label)),
              h('button', {
                type: 'button', style: CSS.miniBtn, 'data-width-preset': 'max',
                onClick: () => apply(max),
              }, 'بیشترین')))))
    }

    function timeOf(ms) {
      if (typeof ms !== 'number') return '—'
      try { return new Date(ms).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return '—' }
    }
    function seconds(ms) { return typeof ms === 'number' ? faNum(ms / 1000, 1) + ' ثانیه' : '—' }

    /* ---------- جدول‌ها (حبیب: «تراژکتوری رو جدولی کن») ---------- */
    /** جدولِ ساده: سرِ ستون‌ها چسبیده بالا، خانه‌های عریض پنل را افقی اسکرول می‌کنند. */
    function Table({ columns, children }) {
      return h('div', { style: CSS.tw },
        h('table', { style: CSS.tbl },
          h('thead', null, h('tr', null, columns.map((name, i) => h('th', { key: i, style: CSS.th }, name)))),
          h('tbody', null, children)))
    }

    /** ردیفِ رفت‌وبرگشت به شکلِ جدولی: نوبت | گام | ساعت | خرج | فرستاده | از کش | برگشت | زمان | ابزار | چرا */
    const TRIP_COLUMNS = ['نوبت', 'گام', 'ساعت', 'خرج', 'فرستاده (توکن)', 'از کش', 'برگشت', 'زمان', 'ابزار', 'چرا']

    /** مبلغِ یک ردیف؛ همان متنِ قبلی (بی‌قیمت / در راه / دلار). */
    function tripCostText(row) {
      return row.unpriceable ? 'بی‌قیمت (غیرِ OpenRouter)' : row.pending ? 'قیمت در راه…' : faMoney(row.cost)
    }

    /** رنگِ ردیف از روی پرچم‌ها: قرمز > زرد > بی‌رنگ. */
    function tripLevel(flags) {
      if (flags.some(f => f.level === 'red')) return 'red'
      return flags.some(f => f.level === 'amber') ? 'amber' : null
    }

    /** خانهٔ «چرا»: پرچم‌ها + توضیحِ ساده + «الکی». */
    function tripWhy(row, level) {
      const flags = Array.isArray(row.flags) ? row.flags.filter(f => f.level === 'red' || f.level === 'amber') : []
      const waste = level === 'red' && typeof row.waste === 'number' && row.waste > 0 ? ' — الکی: ' + faMoney(row.waste) : ''
      return [
        ...flags.map((flag, i) => h('div', {
          key: 'f' + i,
          style: { ...(flag.level === 'red' ? CSS.red : CSS.amber), fontSize: 12, fontWeight: 600 },
        }, (flag.level === 'red' ? '● ' : '▲ ') + flag.text + (flag.level === 'red' && typeof flag.waste === 'number' && flag.waste > 0 ? ' — الکی: ' + faMoney(flag.waste) : ''))),
        h('div', { key: 'why' }, explainCost(row) + waste),
      ]
    }

    /** کلیدِ پایدارِ یک ردیفِ رفت‌وبرگشت: نوبت+گام (بی‌این، شمارندهٔ فهرست هر دور عوض می‌شد). */
    function tripKey(row, index) {
      if (row && row.turn !== null && row.turn !== undefined && row.step !== null && row.step !== undefined) return 't' + row.turn + 's' + row.step
      if (row && row.responseId) return 'g' + row.responseId
      return 'i' + index
    }

    /** کلیدِ پایدارِ یک ردیفِ نوبت. */
    function turnKey(turn, index) {
      if (turn && turn.turn !== null && turn.turn !== undefined) return 'turn' + turn.turn
      return 'i' + index
    }

    /** جدولِ رفت‌وبرگشت‌ها — جای همهٔ ردیف‌های قبلی (کارت‌های الکی‌ترین/گران‌ترین/همه + ردیفِ «الان»). */
    function TripTable({ rows, turns }) {
      const list = Array.isArray(rows) ? rows.filter(Boolean) : []
      if (list.length === 0) return h('div', { style: CSS.hint }, '—')
      // با «turns» (فقط کارتِ «الان چه خبر است»): خانهٔ خرج = جمعِ همهٔ گام‌های همین نوبت تا الان
      // (حبیب ۱۵ نوامبر: «باید کل نوبت ۴۳ رو همه گامهاشو خرجشو تا الان بزنه»).
      const cumulative = Array.isArray(turns)
      const columns = cumulative ? TRIP_COLUMNS.map(name => (name === 'خرج' ? 'خرجِ کلِ نوبت تا الان' : name)) : TRIP_COLUMNS
      return h(Table, { columns },
        list.map((row, i) => {
          const flags = Array.isArray(row.flags) ? row.flags.filter(f => f.level !== 'info') : []
          const level = tripLevel(flags)
          // رنگِ شروعِ ردیف: قرمز پررنگ + پس‌زمینهٔ قرمزِ کمرنگ؛ زرد فقط نوارِ شروع.
          const style = level === 'red'
            ? { ...CSS.td, borderInlineStart: '3px solid #ef4444', background: 'rgba(239,68,68,.08)' }
            : level === 'amber' ? { ...CSS.td, borderInlineStart: '3px solid #f59e0b' } : CSS.td
          // کلیدِ پایدار (بیرون: نوبت+گام، قدیمی‌ترین) تا با هر دورِ تازه ردیف‌ها از نو ساخته نشوند
          // و جای اسکرول نپرد (حبیب: «وقتی لاگِ جدید میاد پرش می‌کنه»).
          return h('tr', { key: tripKey(row, i), 'data-waste': level || undefined },
            h('td', { style }, faNum(row.turn)),
            h('td', { style }, faNum(row.step)),
            h('td', { style }, timeOf(row.time)),
            h('td', { style: { ...style, whiteSpace: 'nowrap' } }, cumulative ? turnSoFar(row, turns) : h('b', null, tripCostText(row))),
            h('td', { style }, faNum((row.input || 0) + (row.cached || 0))),
            h('td', { style }, faNum(row.cached || 0)),
            h('td', { style }, faNum(row.output)),
            h('td', { style: { ...style, whiteSpace: 'nowrap' } }, seconds(row.durationMs)),
            h('td', { style: { ...style, minWidth: 60 } }, row.tools && row.tools.length > 0 ? row.tools.join('، ') : '—'),
            h('td', { style: { ...style, minWidth: 160 } }, tripWhy(row, level)))
        }))
    }

    /**
     * خانهٔ خرج در کارتِ «الان»: جمعِ نوبت تا الان (پررنگ) + خرجِ همین گام (کم‌رنگ).
     * @param row ردیفِ آخرین رفت‌وبرگشت.
     * @param turns c.turns (هر نوبت: cost، requests، pending).
     */
    function turnSoFar(row, turns) {
      const turn = turns.find(t => t && t.turn === row.turn)
      if (!turn) return h('b', null, tripCostText(row))
      const waiting = turn.pending || 0
      return h('div', { 'data-turn-so-far': row.turn },
        h('b', null, faMoney(turn.cost) + (waiting > 0 ? ' +' + faNum(waiting) + ' در راه' : '')),
        h('div', { style: { ...CSS.hint, fontSize: 11 } }, faNum(turn.requests) + ' گام · این گام: ' + tripCostText(row)))
    }

    /** جدولِ «هر نوبت چه بود»: نوبت | ساعت | خرج | ساب‌ایجنت | رفت‌وبرگشت | الکی | پیامِ شروع. */
    function TurnTable({ turns, priced, c }) {
      const list = Array.isArray(turns) ? turns : []
      if (list.length === 0) return h('div', { style: CSS.hint }, '—')
      return h(Table, { columns: ['نوبت', 'ساعت', 'خرج', 'ساب‌ایجنت', 'رفت‌وبرگشت', 'الکی', 'پیامِ شروع'] },
        list.map((turn, i) => {
          // خرجِ ساب‌ایجنت‌هایی که در همین نوبت راه افتادند (— یعنی در این نوبت ساب‌ایجنت نداشت).
          const subs = turnSubagentCost(c, turn.turn)
          return h('tr', { key: turnKey(turn, i) },
            h('td', { style: CSS.td }, faNum(turn.turn)),
            h('td', { style: { ...CSS.td, whiteSpace: 'nowrap' } }, timeOf(turn.time)),
            h('td', { style: CSS.td }, priced > 0 ? h('b', null, faMoney(turn.cost)) : '—'),
            h('td', { style: { ...CSS.td, whiteSpace: 'nowrap' }, 'data-turn-subagents': turn.turn },
              subs
                ? h('span', { title: faNum(subs.count) + ' ساب‌ایجنت در این نوبت' },
                  faMoney(subs.total) + (subs.pending > 0 ? '…' : ''))
                : '—'),
            h('td', { style: CSS.td }, faNum(turn.requests)),
            h('td', { style: CSS.td, title: turn.trigger && turn.trigger.text ? turn.trigger.text : '' },
              turn.waste > 0 ? h('span', { style: { ...CSS.red, fontWeight: 700 } }, '● ' + faMoney(turn.waste)) : '—'),
            h('td', { style: { ...CSS.td, minWidth: 140 } },
              turn.trigger ? '«' + trimText(turn.trigger.text, 160) + '» (' + turn.trigger.kind + ')' : '—'))
        }))
    }

    const KIND_LABEL = {
      dropped: 'سرور کش را نگه نداشت',
      gap: 'مکثِ بیش از ۵ دقیقه (کش پاک شد)',
      provider: 'سرور وسطِ چت عوض شد',
      model: 'مدل/preset وسطِ چت عوض شد',
      fallback: 'سرورِ جایگزین جواب داد (نه سرورِ preset)',
      pro: 'مدلِ گران (pro)',
      big: 'چتِ خیلی بزرگ (بیش از ۲۰۰ هزار توکن در هر درخواست)',
      steps: 'نوبتِ پرقدم (بیش از ۲۰ رفت‌وبرگشت)',
    }

    /** کارتِ قرمزِ «پولِ الکی» — بالای هر دو بخش (با دکمه‌های ▲/▼). */
    function WasteCard({ c, id = 'waste', upDisabled, downDisabled, move }) {
      if (!c || !c.waste || c.priced === 0) return null
      const kinds = Object.values(c.waste.byKind || {}).filter(k => k.kind !== 'first')
      const reds = kinds.filter(k => k.level === 'red').sort((a, b) => b.usd - a.usd)
      const ambers = kinds.filter(k => k.level === 'amber').sort((a, b) => b.cost - a.cost)
      const share = c.total > 0 ? c.waste.total / c.total : 0
      if (reds.length === 0 && ambers.length === 0) {
        return h(Card, { id, title: '✓ پولِ الکی نداشت', move, upDisabled, downDisabled },
          h('div', { style: CSS.hint }, 'همهٔ رفت‌وبرگشت‌ها کش خوردند و چیزِ پرخرجی دیده نشد.'))
      }
      return h(Card, {
        id,
        title: reds.length > 0 ? '● پولِ الکی: ' + faMoney(c.waste.total) + ' از ' + faMoney(c.total) + ' (' + faNum(Math.round(share * 100)) + '٪)' + (c.pending > 0 ? ' — ناقص، قیمت‌ها در راه' : '') : '▲ گران، ولی با دلیل',
        accent: reds.length > 0 ? CSS.red : CSS.amber,
        move, upDisabled, downDisabled,
      },
      reds.map(k => h('div', { key: k.kind, style: { ...CSS.red, fontSize: 12.5 } },
        '● ' + (KIND_LABEL[k.kind] || k.kind) + ': ' + faNum(k.count) + ' بار — الکی ' + faMoney(k.usd))),
      ambers.map(k => h('div', { key: k.kind, style: { ...CSS.amber, fontSize: 12.5 } },
        '▲ ' + (KIND_LABEL[k.kind] || k.kind) + ': ' + faNum(k.count) + ' رفت‌وبرگشت — ' + faMoney(k.cost) + ' از کل')),
      h('div', { style: CSS.hint }, '«الکی» = هزینهٔ واقعی منهای همان درخواست اگر کش می‌خورد (نرخِ کش از همین چت).'))
    }

    /**
     * آخرین دادهٔ سالمِ هر سشن را نگه می‌دارد تا با یک دورِ خطا/در راه، جدول‌ها ناگهان
     * خالی نشوند و پنل کوتاه شود (که جای اسکرول را می‌پراند — حبیب: «میاد بالا»).
     */
    const lastChat = new Map()

    /** جوابِ host ⇒ شکلِ کامل (نسخهٔ قدیمِ host بعضی فیلدها را ندارد ⇒ پیش‌فرضِ بی‌خطر). */
    function normChat(chat, sessionKey = '') {
      const raw = chat && chat.status === 'ok' && chat.value && chat.value.found ? chat.value : null
      if (!raw) return lastChat.get(sessionKey) ?? null
      const norm = {
        ...raw,
        tokens: raw.tokens || (raw.byModel || []).reduce((sum, m) => ({
          input: sum.input + (m.input || 0), cached: sum.cached + (m.cached || 0), output: sum.output + (m.output || 0),
        }), { input: 0, cached: 0, output: 0 }),
        providers: raw.providers || [],
        unpriceable: raw.unpriceable || 0,
        noId: raw.noId || 0,
        byModel: raw.byModel || [], top: raw.top || [], turns: raw.turns || [], list: raw.list || [],
        wasteTop: raw.wasteTop || [], waste: raw.waste || null,
        // ساب‌ایجنت‌ها: نسخهٔ قدیمِ host این فیلدها را ندارد ⇒ بی‌خطر.
        subagents: Array.isArray(raw.subagents) ? raw.subagents : [],
        subagentTotal: typeof raw.subagentTotal === 'number' ? raw.subagentTotal : 0,
        subagentPending: typeof raw.subagentPending === 'number' ? raw.subagentPending : 0,
        subagentModels: Array.isArray(raw.subagentModels) ? raw.subagentModels : [],
        grandTotal: typeof raw.grandTotal === 'number' ? raw.grandTotal : raw.total,
      }
      lastChat.set(sessionKey, norm)
      return norm
    }

    /* ---------- ساب‌ایجنت‌ها (حبیب: «هم جدا پایین بیاد هم توی جدول‌ها مشخص باشه») ---------- */
    /** فهرستِ ساب‌ایجنت‌های یک پاسخِ host؛ نسخهٔ قدیمِ host ندارد ⇒ فهرستِ خالی. */
    function subagentList(c) {
      return c && Array.isArray(c.subagents) ? c.subagents.filter(Boolean) : []
    }

    /** «ساب‌ایجنت $0.1234» یا «ساب‌ایجنت …» تا قیمت‌ها برسد؛ بی ساب‌ایجنت ⇒ null. */
    function subagentPillText(c) {
      const subs = subagentList(c)
      if (subs.length === 0) return null
      const waiting = typeof c.subagentPending === 'number' ? c.subagentPending : 0
      return 'ساب‌ایجنت ' + faMoney(c.subagentTotal) + (waiting > 0 ? '…' : '')
    }

    /** خرجِ ساب‌ایجنت‌هایی که در یک نوبتِ خاص راه افتادند؛ در آن نوبت هیچ ⇒ null. */
    function turnSubagentCost(c, turn) {
      const subs = subagentList(c).filter(s => s.turn === turn)
      if (subs.length === 0) return null
      let total = 0
      let pending = 0
      for (const s of subs) {
        total += typeof s.total === 'number' ? s.total : 0
        pending += typeof s.pending === 'number' ? s.pending : 0
      }
      return { total, count: subs.length, pending }
    }

    /** ردیف‌های جدولِ ساب‌ایجنت‌ها، به ترتیبِ زمان (پدر پیش از فرزند). */
    function subagentRows(c) {
      return subagentList(c).slice().sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
    }

    /** وضعیتِ یک ساب‌ایجنت به زبانِ ساده. */
    function subagentStatus(s) {
      if (!s.found) return 'لاگ پیدا نشد'
      if (s.pending > 0) return 'قیمت در راه'
      if (s.priced === 0) return 'بی‌قیمت'
      return 'حساب شد'
    }

    /** جمعِ دلاریِ یک مدل؛ اگر هیچ قیمتی نیامده «در راه»، نه $0 ِ دروغ. */
    function modelMoney(m) {
      const waiting = m.pending || 0
      const unpriced = m.unpriced || 0
      if (waiting + unpriced >= m.count) return waiting > 0 ? 'قیمت در راه…' : 'بی‌قیمت'
      return faMoney(m.cost) + (waiting > 0 ? ' (+' + faNum(waiting) + ' در راه)' : '')
    }

    /* ---------- دادهٔ خام (کارتِ «دادهٔ خامِ کامل») ---------- */
    const RAW_PAGE = 50

    /** آدرسِ مسیرِ host: صفحه‌بندی یا دانلودِ کلِ فایلِ لاگ. */
    function rawUrl(sessionId, from, q, download) {
      const params = new URLSearchParams()
      params.set('sessionId', sessionId || '')
      if (download) { params.set('download', '1'); return '/plugins/side-panel/raw-log?' + params.toString() }
      params.set('from', String(Math.max(0, Math.floor(from) || 0)))
      params.set('limit', String(RAW_PAGE))
      const text = typeof q === 'string' ? q.trim() : ''
      if (text !== '') params.set('q', text)
      return '/plugins/side-panel/raw-log?' + params.toString()
    }

    /** متنِ JSONِ یک خط، خوانا؛ اگر JSON نبود همان متنِ خام. */
    function prettyLine(text) {
      try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return String(text) }
    }

    /** خط‌های دادهٔ خام + «نمایش»؛ زیرِ هر خطِ باز، کلِ متنِ همان رخداد. */
    function RawTable({ lines }) {
      const list = Array.isArray(lines) ? lines : []
      const [shown, setShown] = React.useState(null)
      const [copied, setCopied] = React.useState(null)
      const copy = (entry) => {
        try {
          const clip = typeof navigator !== 'undefined' && navigator ? navigator.clipboard : null
          if (clip && typeof clip.writeText === 'function') {
            const job = clip.writeText(entry.text)
            if (job && typeof job.then === 'function') job.then(() => setCopied(entry.index), () => {})
            else setCopied(entry.index)
          }
        } catch { /* بی‌اجازه ⇒ بی‌صدا */ }
      }
      return h(Table, { columns: ['#', 'زمان', 'نوع', 'حجم', 'نمایش'] },
        list.map((entry) => h(React.Fragment, { key: entry.index },
          h('tr', { 'data-line': entry.index },
            h('td', { style: { ...CSS.td, whiteSpace: 'nowrap' } }, faNum(entry.index)),
            h('td', { style: { ...CSS.td, whiteSpace: 'nowrap' } }, entry.time === undefined ? '—' : timeOf(entry.time)),
            h('td', { style: { ...CSS.td, ...CSS.ltr } }, entry.type === undefined ? '—' : entry.type),
            h('td', { style: { ...CSS.td, whiteSpace: 'nowrap' } }, faNum(entry.bytes) + ' بایت'),
            h('td', { style: CSS.td }, h('button', {
              type: 'button',
              style: CSS.miniBtn,
              onClick: () => setShown(shown === entry.index ? null : entry.index),
            }, shown === entry.index ? 'بستن' : 'نمایش'))),
          shown === entry.index && h('tr', { 'data-line-pre': entry.index },
            h('td', { colSpan: 5, style: CSS.td },
              h('button', { type: 'button', style: CSS.miniBtn, onClick: () => copy(entry) }, copied === entry.index ? '✓ کپی شد' : 'کپی'),
              h('pre', { style: CSS.pre, dir: 'ltr' }, prettyLine(entry.text))))))
      )
    }

    /**
     * محتوای کارتِ «دادهٔ خامِ کامل»: چون کارت باز شود می‌خواند؛ بی poll.
     * تابعِ قلاب‌دار است، نه کامپوننت: کارتِ بسته هیچ درخواستی نمی‌فرستد.
     * @param {() => void} setCardOpen باز/بسته‌کردنِ کارت (کپی و «تازه کن»).
     */
    function useRawPanel(sessionId, setCardOpen) {
      const [page, setPage] = React.useState({ from: 0, q: '', tick: 0 })
      const [state, setState] = React.useState({ status: 'idle' })
      const [search, setSearch] = React.useState('')
      // جست‌وجو با مکثِ ۴۰۰ میلی‌ثانیه (هر کلید یک درخواست ندهد).
      React.useEffect(() => {
        const timer = setTimeout(() => setPage(prev => (prev.q === search.trim() ? prev : { from: 0, q: search.trim(), tick: prev.tick })), 400)
        return () => clearTimeout(timer)
      }, [search])
      React.useEffect(() => {
        if (!sessionId) return undefined
        let alive = true
        setState({ status: 'loading' })
        fetch(rawUrl(sessionId, page.from, page.q, false), { credentials: 'same-origin', cache: 'no-store' })
          .then(async (res) => {
            const type = String((res.headers && typeof res.headers.get === 'function' && res.headers.get('content-type')) || '')
            // hostِ قدیم این مسیر را ندارد (۴۰۴ یا صفحهٔ HTML) ⇒ پیامِ «یک بار بسته و باز شود».
            if (res.status === 404 || (type !== '' && !/json/i.test(type))) return { stale: true }
            const json = await res.json()
            if (!res.ok || json.error) return { error: json.error || ('HTTP ' + res.status) }
            return { value: json }
          })
          .then((out) => {
            if (!alive) return
            if (out.error) setState({ status: 'error', error: out.error })
            else if (out.stale) setState({ status: 'stale' })
            else setState({ status: 'ok', value: out.value })
          })
          .catch((err) => { if (alive) setState({ status: 'stale', error: String(err && err.message ? err.message : err) }) })
        return () => { alive = false }
      }, [sessionId, page.from, page.q, page.tick])
      // همهٔ خانه‌ها زیرِ یک والد (Fragment)
      return h(Fragment, null,
        h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
          h('span', { style: CSS.hint }, state.status === 'ok' && state.value ? 'کل: ' + faNum(state.value.totalAll) + ' خط' + (state.value.total !== state.value.totalAll ? ' · با جست‌وجو: ' + faNum(state.value.total) : '') : 'کل: — خط'),
          h('button', { type: 'button', style: CSS.miniBtn, onClick: () => setPage(prev => ({ ...prev, tick: prev.tick + 1 })) }, 'تازه کن')),
        h('input', {
          key: 'search',
          type: 'search',
          dir: 'auto',
          placeholder: 'جست‌وجو در دادهٔ خام…',
          value: search,
          onChange: (event) => setSearch(event.target.value),
          style: { width: '100%', boxSizing: 'border-box', margin: '6px 0', padding: '2px 6px', font: 'inherit', fontSize: 12, borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))', background: 'transparent', color: 'inherit' },
        }),
        state.status === 'stale'
          ? h('div', { key: 'stale', style: CSS.hint, 'data-raw-stale': '' }, 'برای دیدنِ دادهٔ خام، اپ یک بار بسته و باز شود')
          : state.status === 'error'
            ? h('div', { key: 'error', style: CSS.hint }, 'خطا: ' + state.error)
            : state.status === 'loading'
              ? h('div', { key: 'loading', style: CSS.hint }, 'در حالِ خواندن…')
              : state.status === 'ok' && state.value
                ? (state.value.found === false
                  ? h('div', { key: 'none', style: CSS.hint }, 'لاگِ این چت پیدا نشد.')
                  : h('div', { key: 'page' },
                    h('div', { style: { ...CSS.hint, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
                      h('button', {
                        type: 'button', style: CSS.miniBtn, disabled: state.value.total === 0 || page.from <= 0,
                        onClick: () => setPage(prev => ({ ...prev, from: Math.max(0, prev.from - RAW_PAGE) })),
                      }, 'قبلی'),
                      h('span', null, state.value.total === 0
                        ? 'هیچ خطی پیدا نشد'
                        : 'از خطِ ' + faNum(state.value.from) + ' تا ' + faNum(state.value.from + Math.max(0, state.value.lines.length - 1)) + ' از ' + faNum(state.value.totalAll)),
                      h('button', {
                        type: 'button', style: CSS.miniBtn, disabled: state.value.total === 0 || page.from + RAW_PAGE >= state.value.total,
                        onClick: () => setPage(prev => ({ ...prev, from: prev.from + RAW_PAGE })),
                      }, 'بعدی')),
                    h('div', { style: { margin: '4px 0' } },
                      h('a', {
                        href: rawUrl(sessionId, 0, '', true),
                        download: (sessionId || 'session') + '.jsonl',
                        style: { fontSize: 12 },
                      }, 'دانلودِ کلِ دادهٔ خام (JSONL)')),
                    h(RawTable, { lines: state.value.lines })))
                : null)
    }

    /** کارتِ «دادهٔ خامِ کامل». محتوایش کامپوننت است ⇒ بسته هیچ درخواستی نمی‌فرستد. */
    function RawCard(props) {
      return h(Card, {
        id: 'raw',
        title: 'دادهٔ خامِ کامل (همان لاگِ اصلیِ چت)',
        defaultOpen: false,
        move: (id, delta) => props.move && props.move(id, delta),
        upDisabled: props.upDisabled,
        downDisabled: props.downDisabled,
        rawBody: () => h(RawPanel, { sessionId: props.sessionId }),
      })
    }

    /** بدنهٔ کارتِ دادهٔ خام: فقط وقتی کارت باز است mounted می‌شود. */
    function RawPanel({ sessionId }) {
      return useRawPanel(sessionId)
    }

    /** بخشِ «تراژکتوری به فارسی». */
    const TRAJECTORY_CARDS = ['waste', 'spend', 'subagents', 'now', 'wasteTop', 'top', 'turns', 'bundle', 'all', 'raw']

    function TrajectorySection({ chat, snapshot, error, sessionId }) {
      const requests = snapshot && Array.isArray(snapshot.requests) ? snapshot.requests : []
      const lastReq = requests.length > 0 ? requests[requests.length - 1] : null
      const prompt = lastReq && lastReq.prompt ? lastReq.prompt : null
      const busy = Boolean(snapshot && (snapshot.partial || (Array.isArray(snapshot.runningCalls) && snapshot.runningCalls.length > 0)))
      const running = snapshot && Array.isArray(snapshot.runningCalls) ? snapshot.runningCalls : []
      const c = normChat(chat, sessionId)
      const oldHost = chat.status === 'ok' && chat.value && chat.value.found === undefined
      const { order, move } = useCardOrder('trajectory', TRAJECTORY_CARDS)

      // هر کارت با شناسهٔ پایدار؛ ترتیب از حافظهٔ مرورگر (▲/▼).
      const cards = {
        waste: h(WasteCard, { c, id: 'waste', move }),
        spend: h(Card, { id: 'spend', title: 'همین چت تا الان چقدر خرج کرد', move },
          c
            ? h('div', null,
              // سه خطِ جدا: خودِ چت / ساب‌ایجنت‌ها / جمعِ کل (حبیب: «هم جدا پایین بیاد»).
              h('div', { 'data-spend-line': 'own' }, 'خودِ چت: ',
                c.priced > 0 ? h('b', { style: { ...CSS.ltr, display: 'inline-block' } }, faMoney(c.total)) : 'قیمت ندارد',
                // تا قیمت‌ها کامل نیامده، عدد «تا این‌جا» است، نه جمعِ نهایی (بعد از ری‌استارت چند ثانیه طول می‌کشد).
                c.pending > 0 ? h('span', { style: { ...CSS.amber, fontSize: 12, fontWeight: 600, marginInlineStart: 8 }, 'data-incomplete': '' }, '▲ ناقص — هنوز بالا می‌رود') : null),
              subagentList(c).length > 0 && h('div', { 'data-spend-line': 'subagents' }, 'ساب‌ایجنت‌ها (' + faNum(subagentList(c).length) + ' تا): ',
                h('b', { style: { ...CSS.ltr, display: 'inline-block' } }, faMoney(c.subagentTotal)),
                c.subagentPending > 0 ? h('span', { style: { ...CSS.amber, fontSize: 12, fontWeight: 600, marginInlineStart: 8 }, 'data-incomplete': '' }, '▲ ناقص — قیمتِ ' + faNum(c.subagentPending) + ' جواب در راه') : null),
              h('div', { style: { fontSize: 15, fontWeight: 700 }, 'data-spend-line': 'grand' }, 'جمعِ کل: ',
                h('b', { style: { ...CSS.ltr, display: 'inline-block' } }, faMoney(c.grandTotal))),
              h('div', null, faNum(c.requests) + ' رفت‌وبرگشت با مدل' + (c.pending > 0 ? ' · قیمتِ ' + faNum(c.pending) + ' تا هنوز در راه است' : '')),
              h('div', null, 'فرستاده: ' + faNum(c.tokens.input + c.tokens.cached + (c.tokens.written || 0)) + ' توکن (' + faNum(c.tokens.cached) + ' از کش) · برگشت: ' + faNum(c.tokens.output)),
              c.byModel.map(m => h('div', { key: m.model, style: CSS.hint },
                m.model + ': ' + faNum(m.count) + ' بار' + (c.priced > 0 ? ' · ' + modelMoney(m) : ''))),
              c.unpriceable - (c.noId || 0) > 0 && h('div', { style: CSS.hint },
                faNum(c.unpriceable - (c.noId || 0)) + ' رفت‌وبرگشت از سرویسِ ' + (c.providers.filter(p => p !== 'openrouter').join('، ') || 'دیگر') + ' است، نه OpenRouter؛ قیمتِ دقیقِ آن‌ها را جایی نداریم (عدد را حدس نمی‌زنیم).'),
              c.noId > 0 && h('div', { style: CSS.hint },
                faNum(c.noId) + ' جوابِ OpenRouter شناسهٔ gen-… نداشت (قطع یا خطا شده)؛ قیمتش را نمی‌شود پرسید.'),
              c.estimated > 0 && h('div', { style: CSS.hint },
                faNum(c.estimated) + ' رفت‌وبرگشت از Anthropic است. Anthropic هزینهٔ تک‌تکِ جواب را نمی‌دهد؛ عددش حساب شده: توکن‌های همان جواب در لاگ (ورودی، خواندن و نوشتنِ کش، خروجی) × جدولِ رسمیِ قیمتِ Anthropic' +
                (c.anthropicSource === 'anthropic' ? ' (تازه از سایتِ Anthropic).' : ' (نسخهٔ ذخیره‌شدهٔ ۱۵ نوامبر؛ سایت در دسترس نبود).')),
              c.priced - (c.estimated || 0) > 0 && h('div', { style: CSS.hint }, c.pending > 0
                ? 'عددِ OpenRouter از خودِ OpenRouter است؛ وقتی «در راه»ها صفر شد، جمع نهایی و دقیق است.'
                : 'عددِ OpenRouter دقیق است: هزینهٔ هر جواب از خودِ OpenRouter (همان صفحهٔ Activity)، فقط برای همین چت.'))
            : h('div', { style: CSS.hint },
              oldHost ? 'برای خرجِ دقیقِ همین چت، اپ یک بار بسته و باز شود (نصفِ پشتِ صحنه تازه شده).'
                : chat.status === 'error' ? 'خطا: ' + chat.error
                  : chat.status === 'ok' ? 'لاگِ این چت پیدا نشد.' : 'در حالِ خواندن…')),
        subagents: (() => {
          const rows = subagentRows(c)
          const waiting = c ? c.subagentPending : 0
          return h(Card, {
            id: 'subagents',
            title: 'ساب‌ایجنت‌ها (هر کدام چقدر خرج کرد)' +
              (rows.length > 0 ? ' — ' + faNum(rows.length) + ' تا · ' + faMoney(c.subagentTotal) : '') +
              (waiting > 0 ? ' …' : ''),
            move,
          }, rows.length === 0
            ? h('div', { style: CSS.hint }, 'هنوز ساب‌ایجنت‌ی در این چت راه نیفتاده.')
            : h(Fragment, null,
              h('div', { style: { ...CSS.hint, marginBottom: 4 } },
                'هر ساب‌ایجنت یک چتِ جدا دارد؛ این‌جا خرجِ همان چت آمده. جمع: ',
                h('b', { style: CSS.ltr }, faMoney(c.subagentTotal)),
                waiting > 0 ? ' (قیمتِ ' + faNum(waiting) + ' جواب هنوز در راه است)' : '',
                ' · با خودِ چت: ', h('b', { style: CSS.ltr }, faMoney(c.grandTotal))),
              h(Table, { columns: ['نام', 'کار', 'نوبت', 'مدل', 'رفت‌وبرگشت', 'فرستاده', 'برگشت', 'خرج', 'وضعیت'] },
                rows.map(s => {
                  const tokens = s.tokens || {}
                  const sent = (tokens.input || 0) + (tokens.cached || 0) + (tokens.written || 0)
                  const models = Array.isArray(s.byModel) && s.byModel.length > 0
                    ? s.byModel.map(m => m.model).join('، ')
                    : '—'
                  const nested = s.depth > 0 ? '↳ ' : ''
                  return h('tr', { key: s.childId, 'data-subagent-id': s.childId, 'data-depth': s.depth },
                    h('td', { style: { ...CSS.td, fontWeight: 600 }, title: s.childId },
                      nested + (s.name || s.childId.slice(0, 8))),
                    h('td', { style: { ...CSS.td, minWidth: 110 } }, s.label || '—'),
                    h('td', { style: CSS.td }, typeof s.turn === 'number' ? faNum(s.turn) : '—'),
                    h('td', { style: { ...CSS.td, ...CSS.ltr } }, models),
                    h('td', { style: CSS.td }, faNum(s.requests)),
                    h('td', { style: CSS.td }, faNum(sent)),
                    h('td', { style: CSS.td }, faNum(tokens.output)),
                    h('td', { style: { ...CSS.td, whiteSpace: 'nowrap' } },
                      s.found ? faMoney(s.total) + (s.pending > 0 ? '…' : '') : '—'),
                    h('td', { style: { ...CSS.td, whiteSpace: 'nowrap', ...(s.pending > 0 ? CSS.amber : {}) } },
                      h('span', { 'data-status': s.pending > 0 ? 'pending' : 'done' }, subagentStatus(s))))
                }))))
        })(),
        now: h(Card, { id: 'now', title: 'الان چه خبر است', move },
          busy
            ? h('div', null,
              h('span', { style: CSS.live }, '● مدل دارد کار می‌کند'),
              running.length > 0 && h('div', { style: CSS.hint }, 'ابزارِ در حالِ اجرا: ' + running.map(r => (r && (r.name || r.toolName)) || 'ابزار').join('، ')))
            : h('div', { style: CSS.hint }, 'بیکار — منتظرِ پیامِ بعدی.'),
          c && c.last && h(TripTable, { rows: [c.last], turns: Array.isArray(c.turns) ? c.turns : [] }),
          error && h('div', { style: CSS.hint }, 'خطای تراژکتوری: ' + error)),
        wasteTop: c && Array.isArray(c.wasteTop) && c.wasteTop.length > 0
          ? h(Card, { id: 'wasteTop', title: '● الکی‌ترین رفت‌وبرگشت‌ها (قرمز)', move }, h(TripTable, { rows: c.wasteTop }))
          : null,
        top: h(Card, {
          id: 'top',
          title: c && c.topBy === 'tokens' ? 'سنگین‌ترین رفت‌وبرگشت‌ها (بر اساسِ توکن)' : 'چرا گران شد (۵ رفت‌وبرگشتِ پرخرج)',
          defaultOpen: !(c && c.wasteTop && c.wasteTop.length > 0),
          move,
        }, c && c.top.length > 0
          ? h(TripTable, { rows: c.top })
          : h('div', { style: CSS.hint }, 'هنوز قیمتی نیامده.')),
        turns: h(Card, { id: 'turns', title: 'هر نوبت چه بود (چه کسی چه گفت ⇐ چقدر خرج شد)', defaultOpen: false, move },
          h(TurnTable, { turns: c ? c.turns : [], priced: c ? c.priced : 0, c })),
        bundle: h(Card, { id: 'bundle', title: 'باندلِ پیام (چه چیزی همراهِ هر درخواست می‌رود)', defaultOpen: false, move },
          prompt
            ? h('div', null,
              h('div', null, 'دستورِ سیستمی: ' + faNum((prompt.system || '').length) + ' حرف'),
              h('div', null, 'ابزارهای معرفی‌شده به مدل: ' + faNum(Array.isArray(prompt.tools) ? prompt.tools.length : 0)),
              Array.isArray(prompt.tools) && prompt.tools.length > 0 && h('div', { style: CSS.hint },
                prompt.tools.map(t => (t && t.name) || '?').join('، ')),
              h('div', { style: CSS.hint }, 'به‌علاوهٔ کلِ تاریخچهٔ همین چت — برای همین با بزرگ‌شدنِ چت، هر درخواست سنگین‌تر می‌شود.'))
            : h('div', { style: CSS.hint }, 'درخواستی در پنجرهٔ بارگذاری نیست.')),
        all: h(Card, { id: 'all', title: 'همهٔ رفت‌وبرگشت‌ها (تازه‌ترین بالا)', defaultOpen: false, move },
          h(TripTable, { rows: c ? c.list : [] })),
        raw: sessionId ? h(RawCard, { sessionId, move }) : null,
      }

      const shown = order.filter(cardId => cards[cardId])
      return h('div', { 'data-section': 'trajectory' },
        shown.map((cardId, index) => h('div', { key: cardId, 'data-card-order': cardId },
          React.cloneElement(cards[cardId], orderProps(move, index, shown.length)))))
    }

    /** بخشِ «آمار». */
    const STATS_CARDS = ['waste', 'stats', 'byModel', 'statsRaw']

    function StatsSection({ chat, stats, keyCost, sessionId }) {
      const c = normChat(chat, sessionId)
      const summary = stats.snapshot ? summarizeStats(stats.snapshot) : null
      const k = keyCost.status === 'ok' ? keyCost.value : null
      const { order, move } = useCardOrder('stats', STATS_CARDS)
      const cards = {
        waste: h(WasteCard, { c, move }),
        stats: h(Card, { id: 'stats', title: 'آمارِ همین چت', move },
          summary
            ? h('div', null,
              h('div', null, 'نوبت‌ها: ' + faNum(summary.turns) + ' · گام‌ها: ' + faNum(summary.steps)),
              h('div', null, 'حافظهٔ فرستاده‌شده (context): ' + faNum(summary.context) + ' توکن · خروجی: ' + faNum(summary.output)),
              h('div', null, 'زمان تا اولین کلمه (TTFT): ' + seconds(summary.ttft) + ' · سرعت: ' + (summary.tps === null ? '—' : faNum(summary.tps, 1) + ' توکن/ثانیه')),
              h('div', null, 'وقتِ مدل: ' + seconds(summary.modelMs) + ' · وقتِ ابزارها: ' + seconds(summary.toolMs)),
              h('div', null, 'سهمِ کش در آخرین نوبت: ' + (summary.cacheHit === null ? '—' : faNum(summary.cacheHit * 100) + '٪')),
              summary.tools.length > 0 && h('div', { style: CSS.hint }, 'ابزارها: ' + summary.tools.slice(0, 10).map(t => t.name + '×' + faNum(t.count)).join(' · ')))
            : h('div', { style: CSS.hint }, stats.error ? 'خطا: ' + stats.error : 'هنوز آمارِ این چت نیامده.')),
        byModel: h(Card, { id: 'byModel', title: 'به تفکیکِ مدل (همین چت)', move },
          c && (c.byModel.length > 0 || (c.subagentModels || []).length > 0)
            ? h(Fragment, null,
              h(Table, { columns: ['مدل', 'بار', 'خرج', 'ورودیِ تازه', 'از کش', 'خروجی'] },
                c.byModel.map(m => h('tr', { key: m.model },
                  h('td', { style: { ...CSS.td, ...CSS.ltr } }, m.model),
                  h('td', { style: CSS.td }, faNum(m.count)),
                  h('td', { style: { ...CSS.td, whiteSpace: 'nowrap' } }, c.priced > 0 ? modelMoney(m) : '—'),
                  h('td', { style: CSS.td }, faNum(m.input)),
                  h('td', { style: CSS.td }, faNum(m.cached)),
                  h('td', { style: CSS.td }, faNum(m.output)))),
                // مدل‌های ساب‌ایجنت‌ها هم همین‌جا، با برچسبِ «(ساب‌ایجنت)» تا با خودِ چت قاطی نشوند.
                (c.subagentModels || []).map(m => h('tr', { key: 'sub:' + m.model, 'data-subagent-model': m.model },
                  h('td', { style: { ...CSS.td, ...CSS.ltr } }, m.model + ' (ساب‌ایجنت)'),
                  h('td', { style: CSS.td }, faNum(m.count)),
                  h('td', { style: { ...CSS.td, whiteSpace: 'nowrap' } }, c.subagentTotal > 0 || m.count > 0 ? modelMoney(m) : '—'),
                  h('td', { style: CSS.td }, faNum(m.input)),
                  h('td', { style: CSS.td }, faNum(m.cached)),
                  h('td', { style: CSS.td }, faNum(m.output))))),
              c.subagentPending > 0 && h('div', { style: CSS.hint }, 'قیمتِ ' + faNum(c.subagentPending) + ' جوابِ ساب‌ایجنت هنوز در راه است؛ عددِ «خرج» بالا می‌رود.'))
            : h('div', { style: CSS.hint }, '—')),
        // خامِ آمار: همان snapshotِ کاملِ آمار، بی دست‌کاری — بشود همهٔ حرفش را دید
        statsRaw: h(Card, { id: 'statsRaw', title: 'دادهٔ خامِ آمار', defaultOpen: false, move },
          h('pre', { style: CSS.pre, dir: 'ltr', 'data-stats-raw': '' }, JSON.stringify(stats.snapshot, null, 2) || 'null')),
      }
      const shown = order.filter(cardId => cards[cardId])
      return h('div', { 'data-section': 'stats' },
        shown.map((cardId, index) => h('div', { key: cardId, 'data-card-order': cardId },
          React.cloneElement(cards[cardId], orderProps(move, index, shown.length)))),
        h('div', { style: { ...CSS.hint, marginTop: 4 } },
          k ? 'کلِ حسابِ OpenRouter (همهٔ چت‌ها، فقط برای اطلاع): ' + faMoney(k.usage) + ' از ' + faMoney(k.limit) + ' · امروز ' + faMoney(k.daily) : ''))
    }

    /** بدنهٔ تب. */
    function PanelBody(props) {
      const ctx = props.ctx
      const sessionId = props.sessionId
      const section = useSection()
      const trajectory = useTarget(ctx, sessionId, 'trajectory')
      const stats = useTarget(ctx, sessionId, 'stats')
      const chat = usePoll(sessionId ? '/plugins/side-panel/session-cost?sessionId=' + encodeURIComponent(sessionId) : null, 3000)
      const keyCost = usePoll(section === 'stats' ? '/plugins/side-panel/cost' : null, 10000)
      return h('div', { style: CSS.root, 'data-side-panel': '', dir: 'rtl' },
        h('div', { style: CSS.bar },
          h('button', { type: 'button', style: CSS.tab(section === 'trajectory'), onClick: () => setSection('trajectory') }, 'تراژکتوری (به فارسی)'),
          h('button', { type: 'button', style: CSS.tab(section === 'stats'), onClick: () => setSection('stats') }, 'آمار'),
          h(WidthShutter),
          h('button', {
            type: 'button', style: CSS.ghost, title: 'صفحهٔ کاملِ اصلیِ اپ (Option+کلیک روی همان دکمهٔ بالا هم همین کار را می‌کند)',
            onClick: () => openFullPage(section),
          }, 'تمام‌صفحه ⤢')),
        section === 'stats'
          ? h(StatsSection, { key: 'stats', chat, stats, keyCost, sessionId })
          : h(TrajectorySection, { key: 'trajectory', chat, snapshot: trajectory.snapshot, error: trajectory.error, sessionId }),
      )
    }

    /**
     * قرصِ پایینِ چت (کنارِ Cache hit و tok/s): خرجِ تا الانِ همین چت + ساب‌ایجنت‌ها + پولِ الکی به قرمز.
     * خودِ دکمه rtl است (متغیرِ متن قاطی نشود)؛ فقط عددها با dir=ltr جدا می‌شوند.
     */
    function CostPill(props) {
      const ctx = props.ctx
      const sessionId = props.sessionId
      const chat = usePoll(sessionId ? '/plugins/side-panel/session-cost?sessionId=' + encodeURIComponent(sessionId) : null, 5000)
      const c = normChat(chat, sessionId)
      if (!c) return null
      const wasted = c.waste && c.waste.total > 0 ? c.waste.total : 0
      const redShare = c.total > 0 && wasted / c.total >= 0.1
      const subs = subagentList(c)
      const subText = subagentPillText(c)
      // «بی‌قیمت» در فارسی «گران‌بها» هم معنی می‌دهد ⇒ روشن‌تر: قیمت ندارد.
      const label = c.priced > 0 ? faMoney(c.total) + (c.pending > 0 ? '…' : '') : 'قیمت ندارد'
      const tip = [
        c.priced > 0
          ? 'خرجِ خودِ این چت: ' + faMoney(c.total) + (c.estimated > 0 ? ' (Anthropic: توکن × جدولِ رسمیِ قیمت)' : ' از OpenRouter')
            + (c.pending > 0 ? ' (ناقص: قیمتِ ' + faNum(c.pending) + ' جواب هنوز در راه است)' : '')
          : 'قیمتِ مدلِ این چت را نداریم (نه OpenRouter، نه در جدولِ Anthropic)',
        subs.length > 0
          ? 'خرجِ ساب‌ایجنت‌ها (' + faNum(subs.length) + ' تا): ' + faMoney(c.subagentTotal)
            + (c.subagentPending > 0 ? ' (قیمتِ ' + faNum(c.subagentPending) + ' جواب هنوز در راه است)' : '')
          : null,
        subs.length > 0 ? 'جمعِ کل: ' + faMoney(c.grandTotal) : null,
        wasted > 0 ? 'الکی: ' + faMoney(wasted) : null,
        'بزن تا پنل باز شود',
      ].filter(Boolean).join(' · ')
      return h('button', {
        type: 'button',
        'data-side-panel-cost-pill': '',
        title: tip,
        onClick: () => { setSection('trajectory'); openPanel(ctx) },
        style: {
          display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent',
          color: 'inherit', font: 'inherit', fontSize: 'inherit', cursor: 'pointer', padding: '0 4px',
          opacity: redShare ? 1 : 0.8, fontVariantNumeric: 'tabular-nums', direction: 'rtl',
        },
      },
      h('span', { 'data-pill': 'own', style: { direction: 'ltr', unicodeBidi: 'isolate' } }, label),
      subText ? h('span', { 'data-pill': 'subagents', style: { direction: 'rtl' } }, ' · ', h('span', { style: { direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' } }, subText)) : null,
      wasted > 0 ? h('span', { style: { color: '#ef4444', fontWeight: redShare ? 700 : 400 } }, '· الکی ', h('span', { style: { direction: 'ltr', unicodeBidi: 'isolate' } }, faMoney(wasted))) : null)
    }

    /* ---------- بازکردنِ پنل ---------- */
    function openPanel(ctx) {
      try {
        if (ctx.layout && typeof ctx.layout.openRightbar === 'function') ctx.layout.openRightbar(true, false)
        if (ctx.sidebarRight && typeof ctx.sidebarRight.openTab === 'function') ctx.sidebarRight.openTab(KIND)
      } catch (err) {
        console.error('side-panel: open failed', err)
      }
      if (!widthApplied && typeof setTimeout === 'function') setTimeout(() => { try { applyPreferredWidth() } catch (err) { console.warn('side-panel: width', err) } }, 400)
    }

    /** برچسبِ هر view (همان متنی که روی دکمه است) ⇒ شناسه‌اش؛ از خودِ اسلات، نه حدس. */
    function viewIdOfTab(ctx, button) {
      const text = (button && button.textContent ? button.textContent : '').trim()
      if (text === '') return null
      try {
        const entries = ctx.slots && typeof ctx.slots.entries === 'function' ? ctx.slots.entries('conversation.view') : []
        for (const entry of entries) {
          const options = entry && entry.options ? entry.options : {}
          let label = options.label
          if (typeof label === 'function') { try { label = label() } catch { label = undefined } }
          if (typeof label === 'string' && label.trim() === text) return options.id ?? null
        }
      } catch { /* بی‌اسلات ⇒ راهِ دوم */ }
      if (/^trajectory$/i.test(text)) return 'trajectory'
      if (/^statistics$/i.test(text)) return 'stats'
      return null
    }

    let bypassUntil = 0
    /** صفحهٔ کاملِ قدیم: همان دکمهٔ بالا را این بار بی‌دست‌کاری می‌زنیم. */
    function openFullPage(section) {
      if (typeof document === 'undefined') return
      const wanted = section === 'stats' ? /^statistics$/i : /^trajectory$/i
      const tabs = document.querySelectorAll('[data-conversation-tabs] [role="tab"]')
      for (const tab of tabs) {
        const id = tab.getAttribute('data-side-panel-view')
        if (id === section || wanted.test((tab.textContent || '').trim())) {
          bypassUntil = Date.now() + 800
          tab.click()
          return
        }
      }
    }

    /* ---------- چیدمان: سایدبار راست، پنل کنارش، چت چپ (فقط وقتی صفحه راست‌به‌چپ است) ---------- */
    const LAYOUT_CSS = [
      '[data-sp-layout] > [data-rightbar-col] { grid-column: 2 !important; }',
      '[data-sp-layout] > :has(+ [data-rightbar-col]) { grid-column: 3 !important; }',
      // دستهٔ سایدبار را اپ برای چیدمانِ چپ‌به‌راست جا می‌دهد؛ در راست‌به‌چپ یک نوارِ
      // نامرئیِ «کشیدنی» وسطِ چت می‌شد (x = عرضِ سایدبار). خاموش، تا روی چت کار نکند.
      '[data-sp-layout] > [data-side="sidebar"] { display: none !important; }',
    ].join('\n')

    function fixFrame(frame) {
      if (!frame || !frame.style) return
      const rtl = typeof getComputedStyle === 'function' && getComputedStyle(frame).direction === 'rtl'
      if (!rtl) {
        if (frame.hasAttribute('data-sp-layout')) {
          frame.removeAttribute('data-sp-layout')
          const original = frame.getAttribute('data-sp-original')
          if (original) frame.style.gridTemplateColumns = original
        }
        return
      }
      if (!frame.hasAttribute('data-sp-layout')) frame.setAttribute('data-sp-layout', '')
      const template = frame.style.gridTemplateColumns
      if (template && template !== frame.getAttribute('data-sp-swapped')) {
        const swapped = swapMiddleTracks(template)
        if (swapped) {
          frame.setAttribute('data-sp-original', template)
          frame.style.gridTemplateColumns = swapped
          frame.setAttribute('data-sp-swapped', frame.style.gridTemplateColumns)
        }
      }
      // دستهٔ تغییرِ اندازهٔ پنل: اپ آن را برای چیدمانِ چپ‌به‌راست جا می‌دهد؛
      // مرزِ واقعیِ چت و پنل این‌جا «همان عدد منهای عرضِ سایدبار» است. منطقِ کشیدن
      // (به چپ بکشی ⇒ پنل پهن‌تر) با این جا درست درمی‌آید.
      const handle = frame.querySelector(':scope > [data-side="rightbar"]')
      if (handle && handle.style.left !== handle.getAttribute('data-sp-set')) {
        const original = Number.parseFloat(handle.style.left)
        const sidebar = firstTrackPx(frame.getAttribute('data-sp-original') || template)
        if (Number.isFinite(original) && sidebar !== null) {
          handle.style.left = (original - sidebar) + 'px'
          handle.setAttribute('data-sp-set', handle.style.left)
        }
      }
    }


    /**
     * دستهٔ کشیدنِ خودِ اپ را با رویدادهای ساختگی می‌راند (همان مسیرِ کدِ اپ،
     * بی‌دست‌کاریِ store). setPointerCapture برای رویدادِ ساختگی خطا می‌دهد، پس
     * موقتاً روی همان یک عنصر بی‌اثر می‌شود و بعد برمی‌گردد.
     */
    let driving = false
    function patchCapture(handle) {
      let captured = false
      handle.setPointerCapture = () => { captured = true }
      handle.hasPointerCapture = () => captured
      handle.releasePointerCapture = () => { captured = false }
      return () => { delete handle.setPointerCapture; delete handle.hasPointerCapture; delete handle.releasePointerCapture }
    }
    function sendPointer(handle, type, x, y) {
      driving = true
      try {
        // اگر PointerEvent نبود (مرورگرِ قدیم/محیطِ آزمون) از MouseEvent استفاده کن.
        // از windowِ خودِ عنصر می‌گیریم، نه نامِ سراسری (که در برخی محیط‌ها تعریف نشده).
        const win = (handle.ownerDocument && handle.ownerDocument.defaultView) || (typeof window !== 'undefined' ? window : {})
        const EventCtor = typeof win.PointerEvent === 'function' ? win.PointerEvent : win.MouseEvent
        if (typeof EventCtor !== 'function') return
        handle.dispatchEvent(new EventCtor(type, {
          bubbles: true, cancelable: true, composed: true, pointerId: 7071, pointerType: 'mouse',
          isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
        }))
      } finally { driving = false }
    }

    const WIDTH_KEY = 'dsh-side-panel/width'

    /** قاب و دستهٔ تغییرِ اندازهٔ پنل را از صفحه پیدا می‌کند؛ نبودشان ⇒ null. */
    function panelFrame() {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
      const col = document.querySelector('[data-sp-layout] > [data-rightbar-col]')
      const frame = col ? col.parentElement : null
      const handle = frame ? frame.querySelector(':scope > [data-side="rightbar"]') : null
      return frame && handle ? { col, frame, handle } : null
    }

    /** پهنای مجازِ همین صفحه (قاب و سایدبار از خودِ صفحه). */
    function widthLimits(part) {
      const fr = part.frame.getBoundingClientRect()
      const sidebar = firstTrackPx(part.frame.getAttribute('data-sp-original') || part.frame.style.gridTemplateColumns) || 0
      return { frameWidth: fr.width, sidebar, max: maxPanelWidth(fr.width, sidebar), current: part.col.getBoundingClientRect().width }
    }

    /**
     * پهنای پنل را به target می‌رساند (با همان کشیدنِ ساختگیِ دستهٔ اپ).
     * @returns true اگر پنل/دسته پیدا شد (حتی اگر لازم نشد حرکت کند).
     */
    function setPanelWidth(target, save = true) {
      const part = panelFrame()
      if (!part) return false
      const limits = widthLimits(part)
      const wide = clampPanelWidth(target, limits.frameWidth, limits.sidebar)
      const fr = part.frame.getBoundingClientRect()
      const left = Number.parseFloat(part.handle.style.left)
      const current = limits.current
      if (Number.isFinite(left) && Math.abs(wide - current) >= 1) {
        const x0 = fr.left + left
        const y = fr.top + fr.height / 2
        const restore = patchCapture(part.handle)
        try {
          sendPointer(part.handle, 'pointerdown', x0, y)
          sendPointer(part.handle, 'pointerup', x0 + (current - wide), y) // به راست ⇒ پنل باریک‌تر
        } finally { restore() }
      }
      // ذخیره در حافظهٔ مرورگر تا دفعهٔ بعد هم همین عرض بیاید.
      if (save) writeJson(WIDTH_KEY, wide)
      return true
    }

    /** پهنای فعلیِ پنل (برای عددِ کرکره) یا null. */
    function currentPanelWidth() {
      const part = panelFrame()
      if (!part) return null
      return Math.round(part.col.getBoundingClientRect().width)
    }

    /** پهنای پیش‌فرضِ توافق‌شده: min(520, فریم − سایدبار − 680) — یک بار در هر بارگذاری. */
    let widthApplied = false
    function applyPreferredWidth() {
      if (widthApplied) return
      widthApplied = true
      const saved = readJson(WIDTH_KEY)
      if (typeof saved === 'number' && Number.isFinite(saved)) {
        setPanelWidth(saved, false) // عرضِ ذخیره‌شدهٔ کاربر
        return
      }
      const part = panelFrame()
      if (!part) return
      const limits = widthLimits(part)
      const target = preferredPanelWidth(limits.frameWidth, limits.sidebar)
      if (target < 300) return
      if (Math.abs(limits.current - target) < 8) return
      setPanelWidth(target, false)
    }

    function startLayoutFix() {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function' || typeof MutationObserver === 'undefined') return () => {}
      const style = document.createElement('style')
      style.setAttribute('data-side-panel', 'layout')
      style.textContent = LAYOUT_CSS
      document.head.appendChild(style)
      let frame = null
      let frameObserver = null
      let handleObserver = null
      let handleKey = ''
      const watchHandle = () => {
        const list = frame ? [...frame.querySelectorAll(':scope > [data-side]')] : []
        const key = list.map(el => el.getAttribute('data-side')).join(',') + ':' + list.length
        if (handleObserver && key === handleKey && list.every(el => el.isConnected)) return
        if (handleObserver) handleObserver.disconnect()
        handleKey = key
        handleObserver = new MutationObserver(() => fixFrame(frame))
        for (const el of list) handleObserver.observe(el, { attributes: true, attributeFilter: ['style'] })
      }
      const attach = () => {
        const col = document.querySelector('[data-rightbar-col]')
        const next = col ? col.parentElement : null
        if (next !== frame) {
          if (frameObserver) frameObserver.disconnect()
          frame = next
          frameObserver = null
          if (frame) {
            frameObserver = new MutationObserver(() => { fixFrame(frame); watchHandle() })
            frameObserver.observe(frame, { attributes: true, attributeFilter: ['style'], childList: true })
          }
        }
        if (frame) { fixFrame(frame); watchHandle() }
      }
      attach()
      const timer = setInterval(attach, 1000)
      return () => {
        clearInterval(timer)
        if (frameObserver) frameObserver.disconnect()
        if (handleObserver) handleObserver.disconnect()
        style.remove()
        if (frame && frame.hasAttribute('data-sp-layout')) {
          frame.removeAttribute('data-sp-layout')
          const original = frame.getAttribute('data-sp-original')
          if (original) frame.style.gridTemplateColumns = original
        }
      }
    }

    /** آیکونِ ردیفِ پنل‌ها در سایدبار، کنارِ «شکارچی مدل». */
    function PanelIcon() {
      return h('svg', {
        'data-side-panel-trigger': '',
        viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
      h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2.5 }),
      h('line', { x1: 14.5, y1: 4, x2: 14.5, y2: 20 }),
      h('line', { x1: 6.5, y1: 9, x2: 11.5, y2: 9 }),
      h('line', { x1: 6.5, y1: 12.5, x2: 11.5, y2: 12.5 }))
    }

    /**
     * تورِ نجات: اگر کلیکِ آیکون به هر دلیل از دستِ کلیک‌گیر در رفت و سایدبار
     * main را عوض کرد، پنل را باز می‌کنیم و به چت برمی‌گردیم؛ شکست ⇒ دلیل روی صفحه.
     */
    function MainBounce(props) {
      const ctx = props.ctx
      const [report, setReport] = React.useState(null)
      const beforePaint = React.useLayoutEffect || React.useEffect
      beforePaint(() => {
        const steps = []
        const step = (label, run) => {
          try {
            const value = run()
            steps.push(label + ': ok' + (value === undefined ? '' : ' (' + String(value) + ')'))
            return true
          } catch (err) {
            steps.push(label + ': ERROR ' + (err && err.message ? err.message : String(err)))
            return false
          }
        }
        const back = step('selectPanel(null)', () => ctx.layout.selectPanel(null))
        const opened = step('openRightbar', () => ctx.layout.openRightbar(true, false))
        // سطحِ سشن بعد از برگشت به چت دوباره mount می‌شود ⇒ openTab یک فریم بعد.
        setTimeout(() => {
          const tabbed = step('openTab', () => ctx.sidebarRight.openTab(KIND))
          if (!(back && opened && tabbed)) setReport(steps.slice())
        }, 50)
      }, [ctx])
      if (report === null) return null
      return h('div', { style: { ...CSS.root, direction: 'rtl' }, 'data-side-panel': 'diagnostics' },
        h('div', { style: CSS.title }, 'پنل باز نشد — دلیل:'),
        report.map((line, index) => h('div', { key: index, style: CSS.hint }, line)),
        h('button', {
          type: 'button',
          style: { marginTop: 8 },
          onClick: () => { try { ctx.layout.selectPanel(null) } catch (err) { console.warn(err) } },
        }, 'برگشت به چت'))
    }

    /** کلیک‌گیرِ مشترک (فازِ capture، قبل از React). */
    function createClickCapture(ctx) {
      return (event) => {
        const target = event.target
        if (!target || typeof target.closest !== 'function') return
        // ۱) آیکونِ خودمان در سایدبار — کلِ دکمه، نه فقط خودِ نقاشی.
        const button = target.closest('button')
        const trigger = target.closest('[data-side-panel-trigger]')
          || (button && typeof button.querySelector === 'function' ? button.querySelector('[data-side-panel-trigger]') : null)
        if (trigger) {
          event.preventDefault()
          event.stopPropagation()
          openPanel(ctx)
          return
        }
        // ۲) دکمه‌های Trajectory / Statistics ِ بالای چت ⇒ پنلِ کنارِ چت.
        const tab = target.closest('[data-conversation-tabs] [role="tab"]')
        if (!tab) return
        if (event.altKey || Date.now() < bypassUntil) return // صفحهٔ کاملِ قدیم
        const id = viewIdOfTab(ctx, tab)
        if (!VIEW_IDS.has(id)) return
        if (typeof tab.setAttribute === 'function') tab.setAttribute('data-side-panel-view', id)
        event.preventDefault()
        event.stopPropagation()
        setSection(id)
        openPanel(ctx)
      }
    }

    return {
      name: '@local/dsh-side-panel',
      // بی inject، cordis سرویس‌ها را تزریق نمی‌کند ⇒ ctx.slots تعریف‌نشده ⇒ هیچ ثبتی انجام نمی‌شود.
      inject: ['slots', 'sidebarRightTabs', 'sidebarRight', 'layout', 'uiConversation'],
      apply(ctx) {
        const warn = (what, err) => console.warn('side-panel: ' + what, err)

        try {
          ctx.effect(() => ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: KIND,
            priority: 'extension',
            title: () => 'ترجمهٔ مدل',
          }), 'side-panel: tab type')
        } catch (err) { warn('tab type', err) }

        try {
          ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
          }, (props) => h(PanelBody, { ...props, ctx })))
        } catch (err) { warn('tab body', err) }

        try {
          ctx.effect(() => {
            if (typeof document === 'undefined') return () => {}
            const onClick = createClickCapture(ctx)
            document.addEventListener('click', onClick, true)
            return () => document.removeEventListener('click', onClick, true)
          }, 'side-panel: click capture')
        } catch (err) { warn('click capture', err) }

        try {
          ctx.effect(() => startLayoutFix(), 'side-panel: layout')
        } catch (err) { warn('layout', err) }

        try {
          ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
            name: 'conversation.composer.dock',
            id: 'side-panel-cost',
            order: 2,
          }, (props) => h(CostPill, { ...props, ctx })))
        } catch (err) { warn('cost pill', err) }

        try {
          ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'side-panel',
            order: 30,
            label: 'پنل کنارِ چت',
          }, () => h(PanelIcon)))
        } catch (err) { warn('panellist icon', err) }

        try {
          ctx.slots.inject('main', () => ctx.slots.register({
            name: 'main',
            key: 'side-panel',
          }, (props) => h(MainBounce, { ...props, ctx })))
        } catch (err) { warn('main bounce', err) }
      },
    }
  },
})

