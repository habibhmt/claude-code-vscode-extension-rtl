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
      .mh-btn[data-on="1"] { background: var(--dsw-alias-brand-primary); color: #fff; border-color: transparent; }
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
      .mh-off { color: var(--dsw-alias-state-success-primary); font-weight: 600; }
      .mh-err { color: var(--dsw-alias-state-error-primary); font-size: 12px; }
      .mh-ok { color: var(--dsw-alias-state-success-primary); font-size: 12px; }
      .mh-empty { color: var(--dsw-alias-label-secondary); padding: 24px 0; }
      .mh-rec { border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; padding: 12px 14px; margin: 8px 0 16px; background: var(--dsw-alias-bg-layer-1); }
      .mh-legend { margin-top: 10px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
      .mh-rec-title { font-weight: 600; margin-bottom: 4px; }
      .mh-tier { margin-inline-start: 6px; font-size: 10px; padding: 1px 5px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); border: 1px solid var(--dsw-alias-border-l1); }
      .mh-best-tag { margin-inline-start: 6px; font-size: 10px; padding: 1px 5px; border-radius: 6px; background: var(--dsw-alias-brand-primary); color: #fff; }
      .mh-best td { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent); }
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

      const recommend = React.useCallback(async (scope) => {
        setBusy(true); setNotice(null); setRec(null)
        try {
          const qs = new URLSearchParams({ scope, ...(currentSessionId ? { sessionId: currentSessionId } : {}) })
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
        ['off', 'off', 'تخفیفِ اعلام‌شدهٔ OpenRouter', (r) => r.offPct, 'desc'],
        ['in', 'ورودی $/M', 'قیمتِ هر یک میلیون توکنِ ورودیِ بدونِ کش', (r) => r.priceIn1m, 'asc'],
        ['cache', 'کش $/M', 'قیمتِ هر یک میلیون توکنِ خوانده‌شده از کش', (r) => r.cacheRead1m ?? 0, 'asc'],
        ['out', 'خروجی $/M', 'قیمتِ هر یک میلیون توکنِ خروجی', (r) => r.priceOut1m, 'asc'],
        ['listed', 'اعلامی ورودی/خروجی', 'قیمتِ اعلامیِ ارائه‌دهنده پیش از تخفیف', (r) => r.listedIn1m ?? r.priceIn1m, 'asc'],
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
        if (family !== 'all') list = list.filter((r) => r.model.indexOf(family) >= 0)
        const score = (r) => {
          if (task === 'cheap') return -r.priceIn
          if (task === 'fast') return (r.tier === 'priority' ? 100 : r.tier === 'ultrafast' ? 60 : 0) + r.quality
          if (task === 'long') return (r.maxCompletion || 0) * 1e-6 + r.quality
          if (task === 'code') return r.quality + ((r.quantization === 'fp8' || r.quantization === 'fp16') ? 5 : 0)
          return 0.55 * (r.quality / 100) + 0.45 * (r.offPct / 100)
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

      const head = h('div', { className: 'mh-head' },
        h('h2', { className: 'mh-title' }, 'شکارچی مدل'),
        h('span', { className: 'mh-sub' },
          data && data.ts ? `اسنپ‌شات: ${new Date(data.ts).toLocaleString('fa-IR')}` : 'در حالِ خواندن از OpenRouter…'))

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
          onClick: () => recommend(scope),
        }, 'پیشنهاد برای این دامنه'),
        )

      const tableHead = h('tr', null,
        COLS.map(([key, label]) => h('th', {
          key,
          className: sortKey === key ? 'mh-th-active' : 'mh-th',
          onClick: () => clickSort(key),
        }, label + (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''))).concat([h('th', { key: 'act' }, '')]))

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
        h('td', { className: 'mh-off' }, r.offPct ? `${r.offPct.toFixed(0)}%` : '—'),
        h('td', { className: 'mh-q' }, r.priceIn1m.toFixed(4)),
        h('td', { className: 'mh-q' }, (r.cacheRead1m ?? 0).toFixed(4)),
        h('td', { className: 'mh-q' }, r.priceOut1m.toFixed(4)),
        h('td', { className: 'mh-q' }, `${(r.listedIn1m ?? r.priceIn1m).toFixed(4)} / ${(r.listedOut1m ?? r.priceOut1m).toFixed(4)}`),
        h('td', null, r.uptime == null ? '—' : `${r.uptime.toFixed(0)}%`),
        h('td', null, h('button', {
          className: 'mh-btn', disabled: busy,
          onClick: () => apply(r.model, r.provider, scope),
        }, 'ست کن'))))

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
            `پیشنهاد برای ${({ session: 'همین چت', project: 'همین پروژه', all: 'همهٔ پروژه‌ها' })[rec.profile.scope] || rec.profile.scope}`),
          h('div', { className: 'mh-sub' },
            `${rec.profile.sessions} چت، ${rec.profile.requests} درخواست، کش ${rec.profile.cacheShare}٪ — میانگینِ هر درخواست: ورودی ${rec.profile.avgPromptPerRequest} (کش ${rec.profile.avgCachedPerRequest})، خروجی ${rec.profile.avgOutPerRequest}`),
          h('div', { style: { marginTop: '8px' } },
            h('b', null, rec.recommended.provider),
            ` · سطح ${TIER_FA[rec.recommended.tier || 'default'] || rec.recommended.tier} · ${rec.recommended.quantization} — هزینهٔ هر درخواست $${rec.recommended.costPerRequest}، کیفیت ${rec.recommended.quality}، ۱۰۰۰ درخواست $${rec.projectedPer1000Requests}`,
            rec.baseline ? ` — در برابر دیپ‌سیک رسمی $${rec.baseline.costPerRequest} (${rec.savingsPct > 0 ? `${rec.savingsPct}٪ ارزان‌تر` : `${Math.abs(rec.savingsPct)}٪ گران‌تر`})` : '',
            h('button', {
              className: 'mh-btn', style: { marginInlineStart: '10px' }, disabled: busy,
              onClick: () => apply(rec.model, rec.recommended.provider, rec.profile.scope),
            }, 'ست کن روی همین دامنه')),
          h('div', { className: 'mh-sub', style: { marginTop: '6px' } },
            'گزینه‌های بعدی: ' + rec.alternatives.map((a) => `${a.provider} $${a.costPerRequest}`).join(' · '))) : null,
        data && rows.length ? table : null,
        data && rows.length ? h('div', { className: 'mh-legend' },
          'سطح: استاندارد = ظرفیتِ معمول · flex = ارزان‌تر و دیرتر · priority = سریع‌تر و گران‌تر  |  کش = قیمتِ خواندن از حافظهٔ کش  |  اعلامی = قیمت پیش از تخفیف') : null)
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
      },
    }
  },
})
