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


    /** پهنای پیش‌فرضِ پنل (توافقِ ۲۱:۲۰، سؤالِ ۴): حداکثر ۵۲۰، و چت دستِ‌کم ۶۸۰ بماند. */
    function preferredPanelWidth(frameWidth, sidebarWidth) {
      return Math.min(520, frameWidth - (sidebarWidth || 0) - 680)
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

    function Card(props) {
      const [open, setOpen] = React.useState(props.defaultOpen !== false)
      return h('div', { style: CSS.card },
        h('div', {
          style: { ...CSS.title, cursor: 'pointer' },
          onClick: () => setOpen(v => !v),
          role: 'button',
          'aria-expanded': open,
        }, (open ? '▾ ' : '▸ ') + props.title),
        open ? h('div', null, props.children) : null,
      )
    }

    function timeOf(ms) {
      if (typeof ms !== 'number') return '—'
      try { return new Date(ms).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return '—' }
    }
    function seconds(ms) { return typeof ms === 'number' ? faNum(ms / 1000, 1) + ' ثانیه' : '—' }

    /** یک ردیفِ رفت‌وبرگشت به زبانِ ساده. */
    function TripLine({ row }) {
      const flags = Array.isArray(row.flags) ? row.flags.filter(f => f.level !== 'info') : []
      const red = flags.some(f => f.level === 'red')
      const amber = !red && flags.some(f => f.level === 'amber')
      const style = red
        ? { ...CSS.row, borderInlineStart: '3px solid #ef4444', paddingInlineStart: 6, background: 'rgba(239,68,68,.06)' }
        : amber ? { ...CSS.row, borderInlineStart: '3px solid #f59e0b', paddingInlineStart: 6 } : CSS.row
      return h('div', { style, 'data-waste': red ? 'red' : amber ? 'amber' : undefined },
        flags.map((flag, i) => h('div', { key: 'f' + i, style: { ...(flag.level === 'red' ? CSS.red : CSS.amber), fontSize: 12, fontWeight: 600 } },
          (flag.level === 'red' ? '● ' : '▲ ') + flag.text + (flag.level === 'red' && typeof flag.waste === 'number' && flag.waste > 0 ? ' — الکی: ' + faMoney(flag.waste) : ''))),
        h('div', null,
          'نوبتِ ' + faNum(row.turn) + ' / گامِ ' + faNum(row.step) + ' · ' + timeOf(row.time) + ' · ',
          h('b', null, row.unpriceable ? 'بی‌قیمت (غیرِ OpenRouter)' : row.pending ? 'قیمت در راه…' : faMoney(row.cost))),
        h('div', { style: CSS.hint },
          'فرستادیم ' + faNum((row.input || 0) + (row.cached || 0)) + ' توکن (' + faNum(row.cached || 0) + ' از کش) · برگشت ' + faNum(row.output) + ' توکن · ' + seconds(row.durationMs)
          + (row.tools && row.tools.length > 0 ? ' · ابزار: ' + row.tools.join('، ') : '')),
        h('div', { style: CSS.hint }, explainCost(row)))
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

    /** کارتِ قرمزِ «پولِ الکی» — بالای هر دو بخش. */
    function WasteCard({ c }) {
      if (!c || !c.waste || c.priced === 0) return null
      const kinds = Object.values(c.waste.byKind || {}).filter(k => k.kind !== 'first')
      const reds = kinds.filter(k => k.level === 'red').sort((a, b) => b.usd - a.usd)
      const ambers = kinds.filter(k => k.level === 'amber').sort((a, b) => b.cost - a.cost)
      const share = c.total > 0 ? c.waste.total / c.total : 0
      if (reds.length === 0 && ambers.length === 0) {
        return h('div', { style: CSS.okCard }, h('div', { style: CSS.title }, '✓ پولِ الکی نداشت'), h('div', { style: CSS.hint }, 'همهٔ رفت‌وبرگشت‌ها کش خوردند و چیزِ پرخرجی دیده نشد.'))
      }
      return h('div', { style: reds.length > 0 ? CSS.redCard : CSS.card, 'data-waste-card': '' },
        h('div', { style: { ...CSS.title, ...(reds.length > 0 ? CSS.red : CSS.amber) } },
          reds.length > 0 ? '● پولِ الکی: ' + faMoney(c.waste.total) + ' از ' + faMoney(c.total) + ' (' + faNum(Math.round(share * 100)) + '٪)' + (c.pending > 0 ? ' — ناقص، قیمت‌ها در راه' : '') : '▲ گران، ولی با دلیل'),
        reds.map(k => h('div', { key: k.kind, style: { ...CSS.red, fontSize: 12.5 } },
          '● ' + (KIND_LABEL[k.kind] || k.kind) + ': ' + faNum(k.count) + ' بار — الکی ' + faMoney(k.usd))),
        ambers.map(k => h('div', { key: k.kind, style: { ...CSS.amber, fontSize: 12.5 } },
          '▲ ' + (KIND_LABEL[k.kind] || k.kind) + ': ' + faNum(k.count) + ' رفت‌وبرگشت — ' + faMoney(k.cost) + ' از کل')),
        h('div', { style: CSS.hint }, '«الکی» = هزینهٔ واقعی منهای همان درخواست اگر کش می‌خورد (نرخِ کش از همین چت).'))
    }

    /** جوابِ host ⇒ شکلِ کامل (نسخهٔ قدیمِ host بعضی فیلدها را ندارد ⇒ پیش‌فرضِ بی‌خطر). */
    function normChat(chat) {
      const raw = chat && chat.status === 'ok' && chat.value && chat.value.found ? chat.value : null
      if (!raw) return null
      return {
        ...raw,
        tokens: raw.tokens || (raw.byModel || []).reduce((sum, m) => ({
          input: sum.input + (m.input || 0), cached: sum.cached + (m.cached || 0), output: sum.output + (m.output || 0),
        }), { input: 0, cached: 0, output: 0 }),
        providers: raw.providers || [],
        unpriceable: raw.unpriceable || 0,
        noId: raw.noId || 0,
        byModel: raw.byModel || [], top: raw.top || [], turns: raw.turns || [], list: raw.list || [],
        wasteTop: raw.wasteTop || [], waste: raw.waste || null,
      }
    }

    /** جمعِ دلاریِ یک مدل؛ اگر هیچ قیمتی نیامده «در راه»، نه $0 ِ دروغ. */
    function modelMoney(m) {
      const waiting = m.pending || 0
      const unpriced = m.unpriced || 0
      if (waiting + unpriced >= m.count) return waiting > 0 ? 'قیمت در راه…' : 'بی‌قیمت'
      return faMoney(m.cost) + (waiting > 0 ? ' (+' + faNum(waiting) + ' در راه)' : '')
    }

    /** بخشِ «تراژکتوری به فارسی». */
    function TrajectorySection({ chat, snapshot, error }) {
      const requests = snapshot && Array.isArray(snapshot.requests) ? snapshot.requests : []
      const lastReq = requests.length > 0 ? requests[requests.length - 1] : null
      const prompt = lastReq && lastReq.prompt ? lastReq.prompt : null
      const busy = Boolean(snapshot && (snapshot.partial || (Array.isArray(snapshot.runningCalls) && snapshot.runningCalls.length > 0)))
      const running = snapshot && Array.isArray(snapshot.runningCalls) ? snapshot.runningCalls : []
      const c = normChat(chat)
      const oldHost = chat.status === 'ok' && chat.value && chat.value.found === undefined

      return h('div', null,
        h(WasteCard, { c }),
        h(Card, { title: 'همین چت تا الان چقدر خرج کرد' },
          c
            ? h('div', null,
              c.priced > 0
                ? h('div', { style: CSS.big }, faMoney(c.total),
                  // تا قیمت‌ها کامل نیامده، عدد «تا این‌جا» است، نه جمعِ نهایی (بعد از ری‌استارت چند ثانیه طول می‌کشد).
                  c.pending > 0 ? h('span', { style: { ...CSS.amber, fontSize: 12, fontWeight: 600, marginInlineStart: 8 }, 'data-incomplete': '' }, '▲ ناقص — هنوز بالا می‌رود') : null)
                : h('div', { style: { ...CSS.big, fontSize: 15 } }, 'قیمتِ دلاری ندارد'),
              h('div', null, faNum(c.requests) + ' رفت‌وبرگشت با مدل' + (c.pending > 0 ? ' · قیمتِ ' + faNum(c.pending) + ' تا هنوز در راه است' : '')),
              h('div', null, 'فرستاده: ' + faNum(c.tokens.input + c.tokens.cached) + ' توکن (' + faNum(c.tokens.cached) + ' از کش) · برگشت: ' + faNum(c.tokens.output)),
              c.byModel.map(m => h('div', { key: m.model, style: CSS.hint },
                m.model + ': ' + faNum(m.count) + ' بار' + (c.priced > 0 ? ' · ' + modelMoney(m) : ''))),
              c.unpriceable - (c.noId || 0) > 0 && h('div', { style: CSS.hint },
                faNum(c.unpriceable - (c.noId || 0)) + ' رفت‌وبرگشت از سرویسِ ' + (c.providers.filter(p => p !== 'openrouter').join('، ') || 'دیگر') + ' است، نه OpenRouter؛ قیمتِ دقیقِ آن‌ها را جایی نداریم (عدد را حدس نمی‌زنیم).'),
              c.noId > 0 && h('div', { style: CSS.hint },
                faNum(c.noId) + ' جوابِ OpenRouter شناسهٔ gen-… نداشت (قطع یا خطا شده)؛ قیمتش را نمی‌شود پرسید.'),
              c.priced > 0 && h('div', { style: CSS.hint }, c.pending > 0
                ? 'هر عدد از خودِ OpenRouter است؛ وقتی «در راه»ها صفر شد، جمع نهایی و دقیق است.'
                : 'عدد دقیق است: هزینهٔ هر جواب از خودِ OpenRouter (همان صفحهٔ Activity)، فقط برای همین چت.'))
            : h('div', { style: CSS.hint },
              oldHost ? 'برای خرجِ دقیقِ همین چت، اپ یک بار بسته و باز شود (نصفِ پشتِ صحنه تازه شده).'
                : chat.status === 'error' ? 'خطا: ' + chat.error
                  : chat.status === 'ok' ? 'لاگِ این چت پیدا نشد.' : 'در حالِ خواندن…')),
        h(Card, { title: 'الان چه خبر است' },
          busy
            ? h('div', null,
              h('span', { style: CSS.live }, '● مدل دارد کار می‌کند'),
              running.length > 0 && h('div', { style: CSS.hint }, 'ابزارِ در حالِ اجرا: ' + running.map(r => (r && (r.name || r.toolName)) || 'ابزار').join('، ')))
            : h('div', { style: CSS.hint }, 'بیکار — منتظرِ پیامِ بعدی.'),
          c && c.last && h(TripLine, { row: c.last }),
          error && h('div', { style: CSS.hint }, 'خطای تراژکتوری: ' + error)),
        c && Array.isArray(c.wasteTop) && c.wasteTop.length > 0 && h(Card, { title: '● الکی‌ترین رفت‌وبرگشت‌ها (قرمز)' },
          c.wasteTop.map((row, i) => h(TripLine, { key: i, row }))),
        h(Card, { title: c && c.topBy === 'tokens' ? 'سنگین‌ترین رفت‌وبرگشت‌ها (بر اساسِ توکن)' : 'چرا گران شد (۵ رفت‌وبرگشتِ پرخرج)', defaultOpen: !(c && c.wasteTop && c.wasteTop.length > 0) },
          c && c.top.length > 0
            ? c.top.map((row, i) => h(TripLine, { key: i, row }))
            : h('div', { style: CSS.hint }, 'هنوز قیمتی نیامده.')),
        h(Card, { title: 'هر نوبت چه بود (چه کسی چه گفت ⇐ چقدر خرج شد)', defaultOpen: false },
          c && c.turns.length > 0
            ? c.turns.map((turn, i) => h('div', { key: i, style: CSS.row },
              h('div', null, 'نوبتِ ' + faNum(turn.turn) + ' · ' + timeOf(turn.time) + ' · ', c.priced > 0 ? h('b', null, faMoney(turn.cost)) : null, ' · ' + faNum(turn.requests) + ' رفت‌وبرگشت',
                turn.waste > 0 ? h('span', { style: { ...CSS.red, fontWeight: 700 } }, ' · ● الکی ' + faMoney(turn.waste)) : null),
              turn.trigger && h('div', { style: CSS.hint }, turn.trigger.kind + ': «' + turn.trigger.text + '»')))
            : h('div', { style: CSS.hint }, '—')),
        h(Card, { title: 'باندلِ پیام (چه چیزی همراهِ هر درخواست می‌رود)', defaultOpen: false },
          prompt
            ? h('div', null,
              h('div', null, 'دستورِ سیستمی: ' + faNum((prompt.system || '').length) + ' حرف'),
              h('div', null, 'ابزارهای معرفی‌شده به مدل: ' + faNum(Array.isArray(prompt.tools) ? prompt.tools.length : 0)),
              Array.isArray(prompt.tools) && prompt.tools.length > 0 && h('div', { style: CSS.hint },
                prompt.tools.map(t => (t && t.name) || '?').join('، ')),
              h('div', { style: CSS.hint }, 'به‌علاوهٔ کلِ تاریخچهٔ همین چت — برای همین با بزرگ‌شدنِ چت، هر درخواست سنگین‌تر می‌شود.'))
            : h('div', { style: CSS.hint }, 'درخواستی در پنجرهٔ بارگذاری نیست.')),
        h(Card, { title: 'همهٔ رفت‌وبرگشت‌ها (تازه‌ترین بالا)', defaultOpen: false },
          c && c.list.length > 0
            ? c.list.map((row, i) => h(TripLine, { key: i, row }))
            : h('div', { style: CSS.hint }, '—')),
      )
    }

    /** بخشِ «آمار». */
    function StatsSection({ chat, stats, keyCost }) {
      const c = normChat(chat)
      const summary = stats.snapshot ? summarizeStats(stats.snapshot) : null
      const k = keyCost.status === 'ok' ? keyCost.value : null
      return h('div', null,
        h(WasteCard, { c }),
        h(Card, { title: 'آمارِ همین چت' },
          summary
            ? h('div', null,
              h('div', null, 'نوبت‌ها: ' + faNum(summary.turns) + ' · گام‌ها: ' + faNum(summary.steps)),
              h('div', null, 'حافظهٔ فرستاده‌شده (context): ' + faNum(summary.context) + ' توکن · خروجی: ' + faNum(summary.output)),
              h('div', null, 'زمان تا اولین کلمه (TTFT): ' + seconds(summary.ttft) + ' · سرعت: ' + (summary.tps === null ? '—' : faNum(summary.tps, 1) + ' توکن/ثانیه')),
              h('div', null, 'وقتِ مدل: ' + seconds(summary.modelMs) + ' · وقتِ ابزارها: ' + seconds(summary.toolMs)),
              h('div', null, 'سهمِ کش در آخرین نوبت: ' + (summary.cacheHit === null ? '—' : faNum(summary.cacheHit * 100) + '٪')),
              summary.tools.length > 0 && h('div', { style: CSS.hint }, 'ابزارها: ' + summary.tools.slice(0, 10).map(t => t.name + '×' + faNum(t.count)).join(' · ')))
            : h('div', { style: CSS.hint }, stats.error ? 'خطا: ' + stats.error : 'هنوز آمارِ این چت نیامده.')),
        h(Card, { title: 'به تفکیکِ مدل (همین چت)' },
          c && c.byModel.length > 0
            ? c.byModel.map(m => h('div', { key: m.model, style: CSS.row },
              h('div', null, m.model + (c.priced > 0 ? ' · ' : ''), c.priced > 0 ? h('b', null, modelMoney(m)) : null),
              h('div', { style: CSS.hint }, faNum(m.count) + ' بار · ورودیِ تازه ' + faNum(m.input) + ' · از کش ' + faNum(m.cached) + ' · خروجی ' + faNum(m.output))))
            : h('div', { style: CSS.hint }, '—')),
        h('div', { style: { ...CSS.hint, marginTop: 4 } },
          k ? 'کلِ حسابِ OpenRouter (همهٔ چت‌ها، فقط برای اطلاع): ' + faMoney(k.usage) + ' از ' + faMoney(k.limit) + ' · امروز ' + faMoney(k.daily) : ''),
      )
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
          h('button', {
            type: 'button', style: CSS.ghost, title: 'صفحهٔ کاملِ اصلیِ اپ (Option+کلیک روی همان دکمهٔ بالا هم همین کار را می‌کند)',
            onClick: () => openFullPage(section),
          }, 'تمام‌صفحه ⤢')),
        section === 'stats'
          ? h(StatsSection, { chat, stats, keyCost })
          : h(TrajectorySection, { chat, snapshot: trajectory.snapshot, error: trajectory.error }),
      )
    }

    /** قرصِ پایینِ چت (کنارِ Cache hit و tok/s): خرجِ تا الانِ همین چت + پولِ الکی به قرمز. */
    function CostPill(props) {
      const ctx = props.ctx
      const sessionId = props.sessionId
      const chat = usePoll(sessionId ? '/plugins/side-panel/session-cost?sessionId=' + encodeURIComponent(sessionId) : null, 5000)
      const c = normChat(chat)
      if (!c) return null
      const wasted = c.waste && c.waste.total > 0 ? c.waste.total : 0
      const redShare = c.total > 0 && wasted / c.total >= 0.1
      // «بی‌قیمت» در فارسی «گران‌بها» هم معنی می‌دهد ⇒ روشن‌تر: قیمت ندارد.
      const label = c.priced > 0 ? faMoney(c.total) + (c.pending > 0 ? '…' : '') : 'قیمت ندارد'
      return h('button', {
        type: 'button',
        'data-side-panel-cost-pill': '',
        title: c.priced > 0
          ? 'خرجِ واقعیِ همین چت از OpenRouter' + (c.pending > 0 ? ' (ناقص: قیمتِ ' + faNum(c.pending) + ' جواب هنوز در راه است)' : '') + (wasted > 0 ? ' — الکی: ' + faMoney(wasted) : '') + ' (بزن تا پنل باز شود)'
          : 'این چت از OpenRouter نیست؛ قیمتِ دقیق ندارد',
        onClick: () => { setSection('trajectory'); openPanel(ctx) },
        style: {
          display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent',
          color: 'inherit', font: 'inherit', fontSize: 'inherit', cursor: 'pointer', padding: '0 4px',
          opacity: redShare ? 1 : 0.8, fontVariantNumeric: 'tabular-nums', direction: 'ltr',
        },
      },
      h('span', null, label),
      wasted > 0 ? h('span', { style: { color: '#ef4444', fontWeight: redShare ? 700 : 400 } }, '· الکی ' + faMoney(wasted)) : null)
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
        handle.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, composed: true, pointerId: 7071, pointerType: 'mouse',
          isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
        }))
      } finally { driving = false }
    }

    /** پهنای پیش‌فرضِ توافق‌شده: min(520, فریم − سایدبار − 680) — یک بار در هر بارگذاری. */
    let widthApplied = false
    function applyPreferredWidth() {
      if (widthApplied || typeof document === 'undefined' || typeof document.querySelector !== 'function') return
      const col = document.querySelector('[data-sp-layout] > [data-rightbar-col]')
      const frame = col ? col.parentElement : null
      const handle = frame ? frame.querySelector(':scope > [data-side="rightbar"]') : null
      if (!frame || !handle) return
      const fr = frame.getBoundingClientRect()
      const sidebar = firstTrackPx(frame.getAttribute('data-sp-original') || frame.style.gridTemplateColumns) || 0
      const target = preferredPanelWidth(fr.width, sidebar)
      const current = col.getBoundingClientRect().width
      widthApplied = true
      if (target < 300 || Math.abs(current - target) < 8) return
      const x0 = fr.left + Number.parseFloat(handle.style.left)
      const y = fr.top + fr.height / 2
      const restore = patchCapture(handle)
      try {
        sendPointer(handle, 'pointerdown', x0, y)
        sendPointer(handle, 'pointerup', x0 + (current - target), y) // به راست ⇒ پنل باریک‌تر
      } finally { restore() }
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