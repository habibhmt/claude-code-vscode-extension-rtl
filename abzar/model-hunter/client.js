/**
 * Model Hunter — Client half
 * پنلِ «شکارچی مدل» در نوارِ کنار + آیکونِ آن.
 */

window.__ModuleLoader__.load({
  id: '@local/model-hunter',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    class Guard extends React.Component {
      constructor(props) { super(props); this.state = { err: null } }
      static getDerivedStateFromError(err) { return { err: err } }
      render() {
        if (this.state.err) {
          return h('div', { style: { padding: '20px', color: 'var(--dsw-alias-state-error-primary)', fontFamily: 'inherit' } },
            'خطا در پنلِ شکارچی مدل: ' + String(this.state.err && this.state.err.message ? this.state.err.message : this.state.err))
        }
        return this.props.children
      }
    }
    function wrap(C) {
      return function Guarded(props) { return h(Guard, null, h(C, props)) }
    }
    const TIER_FA = {
      default: 'استاندارد',
      flex: 'flex (ارزان، اولویتِ کمتر)',
      priority: 'priority (سریع)',
      ultrafast: 'ultrafast',
    }
    let currentSessionId = null
    function SessionReporter(props) {
      React.useEffect(() => { currentSessionId = props && props.sessionId ? props.sessionId : null }, [props && props.sessionId])
      return null
    }

    const CSS = `
      .mh-panel { direction: rtl; height: 100%; overflow: auto; padding: 20px 24px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); font: inherit; }
      .mh-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
      .mh-title { font-size: 18px; font-weight: 600; margin: 0; }
      .mh-sub { color: var(--dsw-alias-label-secondary); font-size: 12px; }
      .mh-bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 14px 0; }
      .mh-btn { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 5px 10px; font: inherit; font-size: 12px; cursor: pointer; }
      .mh-btn:hover { border-color: var(--dsw-alias-border-l2); }
      /* brand-primary در تمِ تیره سفید است ⇒ متنِ سفید روی سفید = «نقطهٔ سفید» (حبیب ۱۵ نوامبر). رنگِ ثابت. */
      .mh-btn[data-on="1"] { background: #2563eb; color: #fff; border-color: transparent; }
      .mh-btn:disabled { opacity: .5; cursor: default; }
      .mh-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .mh-table th.mh-th, .mh-table th.mh-th-active { cursor: pointer; user-select: none; }
      .mh-table th.mh-th:hover { color: var(--dsw-alias-label-primary); }
      .mh-table th.mh-th-active { color: var(--dsw-alias-brand-primary); }
      .mh-table th { text-align: right; font-weight: 500; color: var(--dsw-alias-label-secondary); padding: 6px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); white-space: nowrap; }
      .mh-table td { padding: 6px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); white-space: nowrap; }
      .mh-table tr:hover td { background: var(--dsw-alias-bg-layer-1); }
      .mh-fam { margin: 18px 0 6px; font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); }
      .mh-q { font-variant-numeric: tabular-nums; }
      .mh-err { color: var(--dsw-alias-state-error-primary); font-size: 12px; }
      .mh-ok { color: var(--dsw-alias-state-success-primary); font-size: 12px; }
      .mh-empty { color: var(--dsw-alias-label-secondary); padding: 24px 0; }
      .mh-rec { border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; padding: 12px 14px; margin: 8px 0 16px; background: var(--dsw-alias-bg-layer-1); }
      .mh-legend { margin-top: 10px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
      .mh-rec-title { font-weight: 600; margin-bottom: 4px; }
      .mh-tier { margin-inline-start: 6px; font-size: 10px; padding: 1px 5px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); border: 1px solid var(--dsw-alias-border-l1); }
      .mh-best-tag { margin-inline-start: 6px; font-size: 10px; padding: 1px 5px; border-radius: 6px; background: #16a34a; color: #fff; }
      .mh-best td { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent); }
      .mh-ml { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
      .mh-ml-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .mh-chip { flex: none; font-size: 10px; line-height: 14px; padding: 0 4px; border-radius: 5px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .mh-chip.mh-red { color: #fff; background: #dc2626; }
      .mh-chip.mh-amber { color: #1f1300; background: #f59e0b; }
      .mh-chip.mh-green { color: #fff; background: #16a34a; }
      .mh-sum { direction: rtl; text-align: right; font-size: 11px; line-height: 1.6; padding: 6px 10px; margin: 4px 6px; border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); white-space: normal; max-width: 340px; }
      .mh-sum-hint { color: #b45309; }
      .mh-sum-ok { color: #16a34a; }
    `

    function useHunter() {
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [rec, setRec] = React.useState(null)

      const load = React.useCallback(async () => {
        try {
          const r = await fetch('/plugins/model-hunter/state', { credentials: 'same-origin' })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const j = await r.json()
          setData(j)
          setError(j.error || null)
        } catch (e) {
          setError(String(e.message || e))
        }
      }, [])

      React.useEffect(() => {
        load()
        const t = setInterval(load, 60000)
        return () => clearInterval(t)
      }, [load])

      const recommend = React.useCallback(async (scope, family) => {
        setBusy(true); setNotice(null); setRec(null)
        try {
          const qs = new URLSearchParams({ scope, ...(currentSessionId ? { sessionId: currentSessionId } : {}), ...(family !== 'all' ? { model: family } : {}) })
          const r = await fetch(`/plugins/model-hunter/recommend?${qs}`, { credentials: 'same-origin' })
          const j = await r.json()
          if (!j.ok) throw new Error(j.error || `HTTP ${r.status}`)
          setRec(j)
        } catch (e) {
          setNotice(`خطا: ${e.message || e}`)
        } finally {
          setBusy(false)
        }
      }, [])

      const apply = React.useCallback(async (model, provider, scope) => {
        setBusy(true); setNotice(null)
        try {
          const r = await fetch('/plugins/model-hunter/apply', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model, provider, scope, sessionId: currentSessionId }),
          })
          const j = await r.json()
          if (!j.ok) throw new Error(j.error || `HTTP ${r.status}`)
          const lv = j.live || {}
          const label = { session: 'همین چت', project: 'همین پروژه', all: 'همهٔ پروژه‌ها' }[lv.scope] || lv.scope
          const failed = (lv.failed || []).length
          setNotice(`ست شد (${label}): ${j.ref.split('@preset/').pop()} — ${(lv.switched || []).length} چت عوض شد${failed ? `، ${failed} تا نشد` : ''}`)
          await load()
        } catch (e) {
          setNotice(`خطا: ${e.message || e}`)
        } finally {
          setBusy(false)
        }
      }, [load])

      return { data, error, busy, notice, rec, setRec, load, apply, recommend }
    }

    function Panel() {
      const { data, error, busy, notice, rec, load, apply, recommend } = useHunter()
      const [family, setFamily] = React.useState('all')
      const [task, setTask] = React.useState('balanced')
      const [limit, setLimit] = React.useState(12)
      const [scope, setScope] = React.useState('project')
      const [sortKey, setSortKey] = React.useState(null)
      const [sortDir, setSortDir] = React.useState('desc')

      const COLS = [
        ['model', 'مدل', 'شناسهٔ مدل در OpenRouter', (r) => r.model, 'asc'],
        ['provider', 'ارائه‌دهنده', 'شرکتی که مدل را اجرا می‌کند', (r) => r.provider, 'asc'],
        ['tier', 'سطح', 'سطحِ ظرفیتِ همان اندپوینت: استاندارد = ظرفیتِ معمول؛ flex = ارزان‌تر با اولویتِ کمتر؛ priority (fast/turbo/prime) = سریع‌تر و گران‌تر', (r) => r.tier || 'default', 'asc'],
        ['quant', 'دقت', 'quantization: fp32/bf16 دقیق‌ترین، fp8 متعارف، fp4/mxfp4 سبک‌شده', (r) => r.quantization, 'asc'],
        ['quality', 'کیفیت', 'امتیازِ این پلاگین (نه OpenRouter): ۰٫۷۲×دقت + ۰٫۲۸×آپ‌تایم + امتیازِ سطح', (r) => r.quality, 'desc'],
        ['real', 'آف واقعی', 'صرفهٔ واقعی نسبت به دیپ‌سیکِ رسمیِ همان مدل، با الگوی مصرفِ خودمان (کش ۹۲٪ · ورودی ۳۳۸٬۰۰۰ · خروجی ۶۹۸ توکن)', (r) => (r.realOffPct == null ? -1e9 : r.realOffPct), 'desc'],
        ['cost', '$/درخواست', 'هزینهٔ مورد انتظارِ هر درخواستِ خودمان (دلار): کش‌خورده × (۱−m) + کش‌نخورده × m', (r) => (r.costCalib == null ? Infinity : r.costCalib), 'asc'],
        ['miss', 'کش‌نخوردن', 'درصدِ واقعیِ کش‌نخوردنِ بی‌دلیل در چت‌های خودمان (همان سرور، کمتر از ۵ دقیقه بعد). قرمز = بالای ۲٪. — = هنوز کمتر از ۳۰ نمونه (۳٪ فرض شده)', (r) => (r.measured && r.measured.eligible >= 30 ? r.measured.missPct : 3), 'asc'],
        ['spent', '$ واقعی', 'میانگینِ هزینهٔ واقعیِ هر درخواست در چت‌های خودمان، از OpenRouter (n = تعداد)', (r) => (r.measured && r.measured.requests ? r.measured.costPerRequest : Infinity), 'asc'],
        ['in', 'ورودی $/M', 'قیمتِ هر یک میلیون توکنِ ورودیِ بدونِ کش', (r) => r.priceIn1m, 'asc'],
        ['cache', 'کش $/M', 'قیمتِ هر یک میلیون توکنِ خوانده‌شده از کش (— = ارائه‌دهنده منتشر نکرده)', (r) => (r.cacheRead1m == null ? Infinity : r.cacheRead1m), 'asc'],
        ['out', 'خروجی $/M', 'قیمتِ هر یک میلیون توکنِ خروجی', (r) => r.priceOut1m, 'asc'],
        ['uptime', 'آپ‌تایم', 'درصدِ موفقیتِ ۳۰ دقیقهٔ گذشته', (r) => (r.uptime == null ? -1 : r.uptime), 'desc'],
      ]
      const sortValue = React.useCallback((r) => {
        const col = COLS.find((c) => c[0] === sortKey)
        return col ? col[3](r) : null
      }, [sortKey])
      const clickSort = React.useCallback((key) => {
        const col = COLS.find((c) => c[0] === key)
        if (sortKey === key) {
          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        } else {
          setSortKey(key)
          setSortDir(col ? col[4] : 'desc')
        }
      }, [sortKey])
      const rows = React.useMemo(() => {
        const all = (data && data.rows) || []
        let list = all.filter((r) => r.usable)
        if (family !== 'all') {
          const tail = (m) => { const i = m.indexOf('/'); return i >= 0 ? m.slice(i + 1) : m }
          list = list.filter((r) => r.model === family || tail(r.model) === family)
        }
        const score = (r) => {
          if (task === 'cheap') return -r.priceIn
          if (task === 'fast') return (r.tier === 'priority' ? 100 : r.tier === 'ultrafast' ? 60 : 0) + r.quality
          if (task === 'long') return (r.maxCompletion || 0) * 1e-6 + r.quality
          if (task === 'code') return r.quality + ((r.quantization === 'fp8' || r.quantization === 'fp16') ? 5 : 0)
          return 0.55 * (r.quality / 100) + 0.45 * (Math.max(0, r.realOffPct || 0) / 100)
        }
        const dir = sortDir === 'asc' ? 1 : -1
        const ordered = [...list].sort((a, b) => {
          if (sortKey) {
            const va = sortValue(a)
            const vb = sortValue(b)
            let cmp
            if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
            else cmp = String(va).localeCompare(String(vb), 'fa')
            if (cmp !== 0) return cmp * dir
            return b.quality - a.quality
          }
          const ao = a.official ? 1 : 0
          const bo = b.official ? 1 : 0
          if (ao !== bo) return bo - ao
          return score(b) - score(a)
        })
        return ordered.slice(0, limit)
      }, [data, family, task, limit, sortKey, sortDir, sortValue])

      const fams = React.useMemo(() => {
        if (!data || !data.families) return []
        return Object.keys(data.families).sort()
      }, [data])

      const head = h('div', null,
        h('div', { className: 'mh-head' },
          h('h2', { className: 'mh-title' }, 'شکارچی مدل'),
          h('span', { className: 'mh-sub' },
            data && data.ts ? `اسنپ‌شات: ${new Date(data.ts).toLocaleString('fa-IR')}` : 'در حالِ خواندن از OpenRouter…')),
        h('div', { className: 'mh-rec' },
          h('b', null, 'مدل را از منوی مدلِ پایینِ هر چت عوض کن. '),
          'همان‌جا کنارِ هر گزینه قیمتِ هر پیام، کش‌نخوردنِ اندازه‌گیری‌شده، «ارزان‌ترین» و هشدارِ «عوض کنی پیامِ بعدی بی‌کش چند دلار می‌شود» هست، و ردیفِ «افورت» (سطحِ فکر) هم همان‌جاست. این صفحه فقط گزارش است.',
          data && data.catalog && data.catalog.ts ? h('div', { className: 'mh-sub', style: { marginTop: '4px' } },
            `منوی مدلِ چت: ${data.catalog.listed} گزینه` + (data.catalog.failed && data.catalog.failed.length ? ` · ${data.catalog.failed.length} سرور ساخته نشد` : '') + (data.catalog.error ? ` · خطا: ${data.catalog.error}` : '')) : null))

      const bar = h('div', { className: 'mh-bar' },
        h('button', { className: 'mh-btn', onClick: load, disabled: busy }, 'تازه‌سازی'),
        ['balanced', 'code', 'long', 'cheap', 'fast'].map((t) =>
          h('button', {
            key: t, className: 'mh-btn', 'data-on': task === t ? '1' : '0',
            onClick: () => setTask(t),
          }, { balanced: 'توازن', code: 'کد', long: 'متن بلند', cheap: 'ارزان', fast: 'سریع' }[t])),
        h('span', { style: { flex: 1 } }),
        h('select', {
          className: 'mh-btn', value: family, onChange: (e) => setFamily(e.target.value),
        }, h('option', { value: 'all' }, 'همهٔ خانواده‌ها'),
          fams.map((f) => h('option', { key: f, value: f }, f))),
        h('select', {
          className: 'mh-btn', value: String(limit), onChange: (e) => setLimit(Number(e.target.value)),
        }, [6, 12, 20, 30].map((n) => h('option', { key: n, value: String(n) }, `${n} ردیف`))),
        h('select', {
          className: 'mh-btn', value: scope, onChange: (e) => setScope(e.target.value),
          disabled: !currentSessionId && scope !== 'all',
        }, [
          h('option', { key: 'session', value: 'session' }, 'این چت'),
          h('option', { key: 'project', value: 'project' }, 'همین پروژه'),
          h('option', { key: 'all', value: 'all' }, 'همهٔ پروژه‌ها'),
        ]),
        h('button', {
          className: 'mh-btn', disabled: busy || (!currentSessionId && scope !== 'all'),
          onClick: () => recommend(scope, family),
        }, 'پیشنهاد برای این دامنه'),
        )

      const tableHead = h('tr', null,
        COLS.map(([key, label]) => h('th', {
          key,
          className: sortKey === key ? 'mh-th-active' : 'mh-th',
          onClick: () => clickSort(key),
        }, label + (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''))))

      const recKey = rec && rec.recommended
        ? `${rec.model}|${rec.recommended.provider}|${rec.recommended.quantization}|${rec.recommended.costPerRequest}`
        : null
      const isRec = (r) => recKey !== null
        && r.model === rec.model && r.provider === rec.recommended.provider
        && Math.abs(r.priceIn1m - rec.recommended.priceIn1m) < 1e-9
        && (r.tier || null) === (rec.recommended.tier || null)
      const tableBody = rows.map((r, i) => h('tr', { key: `${r.model}-${r.provider}-${i}`, className: isRec(r) ? 'mh-best' : undefined },
        h('td', { dir: 'ltr', style: { textAlign: 'right' } }, r.model.replace('deepseek/', '')),
        h('td', null,
          r.provider,
          isRec(r) ? h('span', { className: 'mh-best-tag' }, 'بهینه') : null),
        h('td', null, TIER_FA[r.tier || 'default'] || r.tier || 'استاندارد'),
        h('td', null, r.quantization),
        h('td', { className: 'mh-q' }, r.quality.toFixed(1)),
        h('td', { className: 'mh-q' }, r.realOffPct == null ? '—' : `${r.realOffPct > 0 ? '+' : ''}${r.realOffPct.toFixed(1)}٪`),
        h('td', { className: 'mh-q' }, r.costCalib == null ? '—' : r.costCalib.toFixed(5)),
        h('td', { className: 'mh-q', style: r.measured && r.measured.eligible >= 30 && r.measured.missPct > 2 ? { color: '#ef4444', fontWeight: 700 } : undefined },
          r.measured && r.measured.eligible >= 30 ? `${r.measured.missPct}٪ (${r.measured.misses}/${r.measured.eligible})` : '—'),
        h('td', { className: 'mh-q' }, r.measured && r.measured.requests ? `${r.measured.costPerRequest.toFixed(5)} (n=${r.measured.requests})` : '—'),
        h('td', { className: 'mh-q' }, r.priceIn1m.toFixed(4)),
        h('td', { className: 'mh-q' }, (r.cacheRead1m == null || r.cacheKnown === false) ? '—' : r.cacheRead1m.toFixed(4)),
        h('td', { className: 'mh-q' }, r.priceOut1m.toFixed(4)),
        h('td', null, r.uptime == null ? '—' : `${r.uptime.toFixed(0)}%`)))

      const table = h('table', { className: 'mh-table' },
        h('thead', null, tableHead),
        h('tbody', null, tableBody))


      return h('div', { className: 'mh-panel' },
        head,
        bar,
        notice ? h('div', { className: notice.startsWith('خطا') ? 'mh-err' : 'mh-ok' }, notice) : null,
        error ? h('div', { className: 'mh-err' }, `خطای داده: ${error}`) : null,
        !data ? h('div', { className: 'mh-empty' }, 'هنوز داده‌ای نیامده…') : null,
        data && !rows.length ? h('div', { className: 'mh-empty' }, 'برای این فیلتر ردیفی نیست.') : null,
        rec ? h('div', { className: 'mh-rec' },
          h('div', { className: 'mh-rec-title' },
            `پیشنهاد برای ${({ session: 'همین چت', project: 'همین پروژه', all: 'همهٔ پروژه‌ها' })[rec.profile.scope] || rec.profile.scope} — مدل: ${String(rec.model || '').replace('deepseek/', '')}`),
          h('div', { className: 'mh-sub' },
            `${rec.profile.sessions} چت، ${rec.profile.requests} درخواست، کش ${rec.profile.cacheShare}٪ — میانگینِ هر درخواست: ورودی ${rec.profile.avgPromptPerRequest} (کش ${rec.profile.avgCachedPerRequest})، خروجی ${rec.profile.avgOutPerRequest}`),
          h('div', { style: { marginTop: '8px' } },
            h('b', null, rec.recommended.provider),
            ` · سطح ${TIER_FA[rec.recommended.tier || 'default'] || rec.recommended.tier} · ${rec.recommended.quantization} — هزینهٔ هر درخواست $${rec.recommended.costPerRequest}، کیفیت ${rec.recommended.quality}، کش‌نخوردن ${rec.recommended.missPct == null ? '۳٪ (فرض)' : rec.recommended.missPct + '٪'}، ۱۰۰۰ درخواست $${rec.projectedPer1000Requests}`,
            rec.baseline ? ` — در برابر دیپ‌سیک رسمی $${rec.baseline.costPerRequest} (${rec.savingsPct > 0 ? `${rec.savingsPct}٪ ارزان‌تر` : `${Math.abs(rec.savingsPct)}٪ گران‌تر`})` : ''),
          h('div', { className: 'mh-sub', style: { marginTop: '6px' } },
            'گزینه‌های بعدی: ' + rec.alternatives.map((a) => `${a.provider} $${a.costPerRequest}`).join(' · '))) : null,
        data && rows.length ? table : null,
        data && rows.length ? h('div', { className: 'mh-legend' },
          'سطح: استاندارد = ظرفیتِ معمول · flex = ارزان‌تر و دیرتر · priority = سریع‌تر و گران‌تر'
          + '  |  کش = قیمتِ خواندن از حافظهٔ کش (— = منتشر نشده؛ همان توکن‌ها قیمتِ کاملِ ورودی می‌خورند)'
          + '  |  آف واقعی و $/درخواست با الگوی خودمان حساب می‌شوند: '
          + `کش ${(data.calibration || {}).cacheSharePct ?? 97}٪ (وقتی کش می‌خورد) · ورودی ${(data.calibration || {}).promptTokens ?? 338000} · خروجی ${(data.calibration || {}).outputTokens ?? 698} توکن`
          + '  |  «کش‌نخوردن» از چت‌های واقعیِ خودمان اندازه گرفته می‌شود؛ سرورِ ارزانی که کش را نگه نمی‌دارد این‌جا گران درمی‌آید'
          + '  |  — در آف واقعی = این مدل پایهٔ رسمیِ دیپ‌سیک ندارد') : null)
    }

    /* ---------------- منوی مدلِ خودِ چت ----------------
     * حبیب: «انتخابِ مدل باید توی خودِ چت باشه، خودکار بسنجه، همهٔ مدل‌ها اون‌جا باشن و
     * موقعِ عوض کردن هشدارِ قیمتِ مدلِ جدیدِ بی‌کش بده».
     * label: کنارِ نامِ هر گزینه قیمتِ هر پیامِ همین چت، کش‌نخوردن، ارزان‌ترین، هزینهٔ عوض کردن.
     * options: یک خطِ خلاصه زیرِ ردیف‌های مدل و افورت.
     * confirm: کلیک روی گزینه‌ای که عوض کردنش ≥ یک سنت خرج دارد، اول می‌پرسد. */
    const pickerCache = new Map()
    const pickerListeners = new Set()
    const currentKeyBySession = new Map()
    let lastPickerSession = null
    function anthropicKey(id) {
      return String(id || '').replace(/^anthropic\//, '').replace(/:.*$/, '').toLowerCase().replace(/\./g, '-')
    }
    function pickerKey(providerId, modelId) {
      return providerId === 'anthropic' ? 'anthropic|' + anthropicKey(modelId) : providerId + '|' + modelId
    }
    function money(x) {
      if (x == null || !Number.isFinite(x)) return '—'
      if (x >= 1) return '$' + x.toFixed(2)
      if (x >= 0.01) return '$' + x.toFixed(3)
      return '$' + x.toFixed(4)
    }
    function kTok(n) { return n >= 1000 ? Math.round(n / 1000).toLocaleString('fa-IR') + ' هزار' : String(n || 0) }
    function loadPicker(sid, maxAge) {
      if (!sid) return
      const hit = pickerCache.get(sid)
      if (hit && (hit.loading || Date.now() - hit.ts < (maxAge || 15000))) return
      pickerCache.set(sid, { ...(hit || {}), loading: true, ts: hit ? hit.ts : 0 })
      fetch('/plugins/model-hunter/picker?sessionId=' + encodeURIComponent(sid), { credentials: 'same-origin', cache: 'no-store' })
        .then(r => r.json())
        .then(j => { pickerCache.set(sid, { ts: Date.now(), data: j && j.ok ? j : null, loading: false }) })
        .catch(() => { pickerCache.set(sid, { ts: Date.now(), data: hit ? hit.data : null, loading: false }) })
        .finally(() => { for (const f of pickerListeners) f() })
    }
    function usePicker(sid, every) {
      const [, force] = React.useState(0)
      React.useEffect(() => {
        if (!sid) return undefined
        const f = () => force(n => n + 1)
        pickerListeners.add(f)
        loadPicker(sid)
        const t = setInterval(() => loadPicker(sid), every || 30000)
        return () => { pickerListeners.delete(f); clearInterval(t) }
      }, [sid, every])
      const hit = sid ? pickerCache.get(sid) : null
      return hit ? hit.data : null
    }
    function sidOf(props) {
      const sid = (props && props.sessionId) || currentSessionId || null
      if (sid) lastPickerSession = sid
      return sid
    }
    /** هزینهٔ اضافهٔ عوض کردن به این گزینه = پیامِ اولِ بی‌کشِ آن − پیامِ معمولیِ همین الان. */
    function switchExtra(data, sid, item) {
      const cur = data && data.items ? data.items[currentKeyBySession.get(sid)] : null
      return item ? item.cold - (cur ? cur.warm : 0) : null
    }

    function ModelLabel(props) {
      const provider = props.provider || {}
      const model = props.model || {}
      const sid = sidOf(props)
      const key = pickerKey(provider.id, model.id)
      if (props.selected && sid) currentKeyBySession.set(sid, key)
      const data = usePicker(sid, props.placement === 'trigger' ? 60000 : 20000)
      const item = data && data.items ? data.items[key] : null
      const name = model.name || model.id
      if (!item || props.placement === 'menu') return h('span', { className: 'mh-ml' }, name)
      const missRed = item.missPct != null && item.missPct > 2
      if (props.placement === 'trigger') {
        return h('span', { className: 'mh-ml', title: 'هر پیامِ همین چت ≈ ' + money(item.warm) },
          name, h('span', { className: 'mh-chip' + (missRed ? ' mh-red' : '') }, money(item.warm)))
      }
      const best = data.best && data.best[item.model] === model.id
      const tokens = data.tokens || 0
      const extra = !props.selected && tokens > 0 ? switchExtra(data, sid, item) : null
      const tip = [
        name,
        'هر پیامِ همین چت (با کش): ' + money(item.warm),
        'ورودی $' + item.in1m + '/M · کش ' + (item.cache1m == null ? 'ندارد' : '$' + item.cache1m + '/M') + ' · خروجی $' + item.out1m + '/M',
        item.missPct != null ? 'کش‌نخوردنِ اندازه‌گیری‌شده: ' + item.missPct + '٪ از ' + item.missSamples + ' بار' : 'کش‌نخوردن هنوز اندازه گرفته نشده (۳٪ فرض)',
        extra != null ? 'اگر عوض کنی: پیامِ بعدی کلِ تاریخچهٔ این چت (' + kTok(tokens) + ' توکن) را بی‌کش می‌فرستد ≈ ' + money(item.cold) : null,
      ].filter(Boolean).join('\n')
      return h('span', { className: 'mh-ml', title: tip },
        h('span', { className: 'mh-ml-name' }, name),
        h('span', { className: 'mh-chip' }, money(item.warm) + '/پیام'),
        item.missPct != null ? h('span', { className: 'mh-chip' + (missRed ? ' mh-red' : '') }, 'کش‌نخوردن ' + item.missPct + '٪') : null,
        best ? h('span', { className: 'mh-chip mh-green' }, 'ارزان‌ترین') : null,
        extra != null && extra >= 0.001 ? h('span', { className: 'mh-chip ' + (extra >= 0.05 ? 'mh-red' : 'mh-amber') }, 'عوض کنی: ' + money(item.cold)) : null)
    }

    function ModelSummary(props) {
      const sid = sidOf(props)
      const data = usePicker(sid, 20000)
      if (!data || !data.items) return null
      const curKey = currentKeyBySession.get(sid)
      const cur = data.items[curKey]
      const tokens = data.tokens || 0
      if (!cur) {
        return h('div', { className: 'mh-sum' }, 'تاریخچهٔ این چت: ' + kTok(tokens) + ' توکن. قیمتِ مدلِ فعلی معلوم نیست. هر بار عوض کردنِ مدل، پیامِ بعدی کلِ تاریخچه را بی‌کش می‌فرستد.')
      }
      const bestRef = data.best ? data.best[cur.model] : null
      const best = bestRef ? data.items['openrouter|' + bestRef] : null
      const lines = [h('div', { key: 'a' }, 'این چت: ' + kTok(tokens) + ' توکن تاریخچه · الان ' + cur.provider + ' ≈ ' + money(cur.warm) + ' هر پیام'
        + (cur.missPct != null ? ' · کش‌نخوردن ' + cur.missPct + '٪' : ''))]
      if (best && best !== cur && best.warm < cur.warm) {
        const extra = best.cold - cur.warm
        const saving = cur.warm - best.warm
        const pays = saving > 0 ? Math.ceil(extra / saving) : null
        lines.push(h('div', { key: 'b', className: 'mh-sum-hint' },
          'ارزان‌ترین سرورِ همین مدل: ' + best.provider + ' ≈ ' + money(best.warm) + ' هر پیام. عوض کردن یک بار ≈ ' + money(best.cold)
          + (pays ? ' خرج دارد و بعد از حدودِ ' + pays.toLocaleString('fa-IR') + ' پیام جبران می‌شود.' : '.')))
      } else if (best) {
        lines.push(h('div', { key: 'b', className: 'mh-sum-ok' }, '✓ روی ارزان‌ترین سرورِ همین مدل هستی؛ عوض نکن.'))
      }
      return h('div', { className: 'mh-sum' }, lines)
    }

    function installSwitchGuard() {
      const onClick = (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('button[role="menuitemradio"]') : null
        if (!btn || btn.getAttribute('aria-checked') === 'true') return
        const tag = btn.querySelector('[data-model-id][data-provider-id]')
        if (!tag) return
        const sid = lastPickerSession
        const hit = sid ? pickerCache.get(sid) : null
        const data = hit && hit.data
        if (!data || !data.items || !(data.tokens > 0)) return
        const item = data.items[pickerKey(tag.getAttribute('data-provider-id'), tag.getAttribute('data-model-id'))]
        if (!item) return
        const extra = switchExtra(data, sid, item)
        if (extra == null || extra < 0.01) return
        const cur = data.items[currentKeyBySession.get(sid)]
        const msg = 'عوض کردنِ مدلِ این چت به «' + (btn.getAttribute('title') || item.model) + '»\n\n'
          + 'پیامِ بعدی کلِ تاریخچهٔ این چت (' + kTok(data.tokens) + ' توکن) را بی‌کش می‌فرستد ≈ ' + money(item.cold)
          + (cur ? '\nاگر عوض نکنی، پیامِ بعدی ≈ ' + money(cur.warm) : '')
          + '\nبعد از آن هر پیام ≈ ' + money(item.warm) + '\n\nعوض شود؟'
        if (!window.confirm(msg)) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        }
      }
      document.addEventListener('click', onClick, true)
      return () => document.removeEventListener('click', onClick, true)
    }

    function Icon(props) {
      const size = (props && props.size) || 18
      const active = props && props.active
      const color = active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)'
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'none' },
        h('circle', { cx: 11, cy: 11, r: 7, stroke: color, strokeWidth: 2 }),
        h('path', { d: 'M16.5 16.5 21 21', stroke: color, strokeWidth: 2, strokeLinecap: 'round' }),
        h('path', { d: 'M8 11h6M11 8v6', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' }))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => {
          const el = document.createElement('style')
          el.setAttribute('data-model-hunter', '')
          el.textContent = CSS
          document.head.appendChild(el)
          return () => el.remove()
        })
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: 'model-hunter', order: 20, label: 'شکارچی مدل',
        }, wrap(Icon)))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: 'model-hunter',
        }, wrap(Panel)))
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left', id: 'model-hunter-session', order: 90,
        }, wrap(SessionReporter)))
        // منوی مدلِ خودِ چت: قیمت کنارِ هر گزینه + خلاصه زیرِ ردیف‌ها + پرسش پیش از عوض کردنِ گران.
        ctx.slots.inject('conversation.input.model.label', () => ctx.slots.register({
          name: 'conversation.input.model.label',
        }, wrap(ModelLabel)))
        ctx.slots.inject('conversation.input.model.options', () => ctx.slots.register({
          name: 'conversation.input.model.options', id: 'model-hunter-summary', order: 10,
        }, wrap(ModelSummary)))
        ctx.effect(() => installSwitchGuard())
      },
    }
  },
})