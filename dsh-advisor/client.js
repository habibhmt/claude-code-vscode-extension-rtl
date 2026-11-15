/**
 * دستیار — نیمهٔ کلاینت
 * ---------------------
 * تبِ پنلِ راست (همان الگویِ کارآمدِ dsh-side-panel — بی منوی سرصفحه):
 *   - سرصفحهٔ یک‌خطیِ نتیجه
 *   - ▶ «اجرا» (یک بار، همین حالا)
 *   - ⟳ «پلی» (بعد از هر پایانِ پاسخ به‌طور خودکار)
 *   - وضعیتِ اجرا، زمانِ آخرین اجرا، خرجِ همین اجرا و خرجِ تجمیعیِ چت
 *   - متنِ کاملِ نتیجه با جدول‌های سادهٔ مارک‌داون، راست‌به‌چپ
 *   - کشوی «سرورِ دستیار» با سه گزینه، و کشوی «چطور باز کنم»
 *
 * هیچ دکمه‌ای که اپ‌برایش تضمین ندهد این‌جا نیست: باز‌کردنِ پنل فقط از راهِ سرویس‌های
 * sidebarRight/layout است، مثلِ خودِ dsh-side-panel.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-advisor',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const KIND = 'advisor'
    const TAB_ID = '@local/dsh-advisor/panel'

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
      btn: (active) => ({
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
        background: active ? 'var(--dsw-alias-brand-primary, #3b82f6)' : 'transparent',
        // رنگِ متنِ روی برند: در تمِ تاریک brand-primary تقریباً سفید است (#f9fafb)،
        // پس '#fff' متن را سفید-روی-سفید می‌کرد. label-primary-inverted دقیقاً برعکسِ
        // brand-primary است (تاریک #353638 روی برندِ روشن؛ سفید روی برندِ تیره).
        color: active ? 'var(--dsw-alias-label-primary-inverted, #353638)' : 'inherit',
        borderRadius: 7, padding: '3px 12px', cursor: 'pointer', font: 'inherit',
        fontWeight: active ? 700 : 400,
      }),
      ghost: {
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))', background: 'transparent',
        color: 'inherit', borderRadius: 6, padding: '1px 8px', cursor: 'pointer', font: 'inherit', fontSize: 12,
      },
      card: {
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3))',
        borderRadius: 8, padding: '8px 11px', marginBottom: 9,
      },
      title: { fontWeight: 700, marginBottom: 4 },
      hint: { opacity: 0.68, fontSize: 12 },
      big: { fontSize: 16, fontWeight: 700 },
      row: { padding: '3px 0', borderTop: '1px dashed var(--dsw-alias-border-l1, rgba(128,128,128,.2))' },
      red: { color: '#ef4444' },
      amber: { color: '#f59e0b' },
      ok: { color: '#22c55e' },
      ltr: { direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' },
      tw: { width: '100%', overflowX: 'auto', marginTop: 4 },
      tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
      th: {
        border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))', padding: '3px 6px',
        textAlign: 'start', fontWeight: 700, whiteSpace: 'nowrap',
        background: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,.14))',
      },
      td: {
        border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25))', padding: '3px 6px', verticalAlign: 'top',
      },
      pre: {
        margin: '4px 0 0', padding: '6px 8px',
        border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))', borderRadius: 6,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '50vh', overflow: 'auto',
        fontSize: 11.5, lineHeight: 1.6,
      },
      select: {
        font: 'inherit', fontSize: 12, padding: '2px 6px', borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
        background: 'transparent', color: 'inherit',
      },
    }

    /* ---------- خواندنِ دوره‌ای از host ---------- */
    function usePoll(url, everyMs, enabled) {
      const [state, setState] = React.useState({ status: 'loading' })
      React.useEffect(() => {
        if (!url || enabled === false) return undefined
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
        const timer = setInterval(load, everyMs || 4000)
        return () => { alive = false; clearInterval(timer) }
      }, [url, everyMs, enabled])
      return state
    }

    /** POST به مسیرهای host؛ خطا همیشه به شکلِ {ok:false, error} برمی‌گردد. */
    async function post(url, body) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body || {}),
        })
        let json = null
        try { json = await res.json() } catch { json = null }
        if (!res.ok) return { ok: false, status: res.status, error: (json && (json.message || json.error)) || ('HTTP ' + res.status) }
        return { ok: true, value: json }
      } catch (err) {
        return { ok: false, error: String(err && err.message ? err.message : err) }
      }
    }

    /* ---------- نمایشِ مارک‌داونِ ساده: سرتیتر، جدول، فهرست، پاراگراف ---------- */

    /** یک خط جدول را به خانه‌ها می‌شکند. */
    function cellsOf(line) {
      const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
      return trimmed.split('|').map((cell) => cell.trim())
    }

    /** خطِ جداکنندهٔ جدول: |---|:--:| */
    function isSeparator(line) {
      return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)
    }

    function renderInline(text) {
      const value = String(text == null ? '' : text)
      // **پررنگ** و `کد`
      const nodes = []
      const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
      let last = 0
      let match
      let index = 0
      while ((match = pattern.exec(value)) !== null) {
        if (match.index > last) nodes.push(value.slice(last, match.index))
        const token = match[0]
        if (token.startsWith('**')) nodes.push(h('strong', { key: 'b' + index }, token.slice(2, -2)))
        else nodes.push(h('code', { key: 'c' + index, style: { fontSize: 11.5, padding: '0 3px', background: 'rgba(128,128,128,.16)', borderRadius: 4 } }, token.slice(1, -1)))
        last = match.index + token.length
        index += 1
      }
      if (last < value.length) nodes.push(value.slice(last))
      return nodes.length === 0 ? value : nodes
    }

    /** متنِ کاملِ نتیجه را با جدول‌های ساده به عناصرِ React تبدیل می‌کند. */
    function MarkdownLite(props) {
      const lines = String(props.text || '').split('\n')
      const blocks = []
      let i = 0
      let key = 0
      while (i < lines.length) {
        const line = lines[i]
        const trimmed = line.trim()
        // جدول
        if (trimmed.includes('|') && i + 1 < lines.length && isSeparator(lines[i + 1])) {
          const head = cellsOf(trimmed)
          const rows = []
          i += 2
          while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
            rows.push(cellsOf(lines[i]))
            i += 1
          }
          blocks.push(h('div', { key: 't' + key, style: CSS.tw },
            h('table', { style: CSS.tbl },
              h('thead', null, h('tr', null, head.map((cell, ci) => h('th', { key: 'h' + ci, style: CSS.th }, renderInline(cell))))),
              h('tbody', null, rows.map((cells, ri) => h('tr', { key: 'r' + ri },
                cells.map((cell, ci) => h('td', { key: 'd' + ci, style: CSS.td }, renderInline(cell)))))))))
          key += 1
          continue
        }
        if (/^#{1,6}\s+/.test(trimmed)) {
          const size = trimmed.startsWith('###') ? 13 : trimmed.startsWith('##') ? 14 : 15
          blocks.push(h('div', { key: 'h' + key, style: { fontWeight: 700, fontSize: size, margin: '8px 0 3px' } }, renderInline(trimmed.replace(/^#{1,6}\s+/, ''))))
          key += 1
          i += 1
          continue
        }
        if (/^\s*[-*•]\s+/.test(line) || /^\s*[۰-۹\d]+[.)]\s+/.test(line)) {
          const items = []
          while (i < lines.length && (/^\s*[-*•]\s+/.test(lines[i]) || /^\s*[۰-۹\d]+[.)]\s+/.test(lines[i]))) {
            items.push(lines[i].replace(/^\s*([-*•]|[۰-۹\d]+[.)])\s+/, ''))
            i += 1
          }
          blocks.push(h('ul', { key: 'u' + key, style: { margin: '2px 0 4px', paddingInlineStart: 20 } },
            items.map((item, ii) => h('li', { key: 'i' + ii }, renderInline(item)))))
          key += 1
          continue
        }
        if (trimmed === '') { i += 1; continue }
        blocks.push(h('div', { key: 'p' + key, style: { margin: '2px 0' } }, renderInline(trimmed)))
        key += 1
        i += 1
      }
      return h('div', { 'data-advisor-markdown': '', dir: 'rtl' }, blocks)
    }

    /** عددِ دلاریِ فارسی. */
    function faMoney(value) {
      const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
      const text = Math.abs(n) >= 1 ? Math.abs(n).toFixed(2) : Math.abs(n).toFixed(4)
      const parts = text.split('.')
      const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
      return (n < 0 ? '−' : '') + (whole + '٫' + parts[1]).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
    }

    /** عددِ صحیحِ فارسی. */
    function faNum(value) {
      const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '٬').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
    }

    /** زمانِ خوانا (تهران). */
    function faTime(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—'
      try {
        return new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit',
        }).format(new Date(ms))
      } catch {
        return new Date(ms).toISOString()
      }
    }

    /**
     * ساعتِ پیشنهاد در سرصفحهٔ «پیشنهادها»: «ساعتِ ۱۶:۴۶ (۱۲ دقیقه پیش) · دستی».
     * اگر امروز نباشد تاریخ هم می‌آید: «۱۴ آبان ۱۶:۴۶ (۱ روز پیش) · پلی».
     * بی نتیجه یا بی زمان ⇒ رشتهٔ تهی (هیچ چیزِ اضافه‌ای نشان داده نمی‌شود).
     */
    function adviceWhen(result) {
      const at = result && typeof result.at === 'number' && Number.isFinite(result.at) ? result.at : null
      if (at == null) return ''
      const now = Date.now()
      const source = result.play === true ? 'پلی' : 'دستی'
      let clock
      try {
        clock = new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit',
        }).format(new Date(at))
      } catch {
        clock = faTime(at).slice(-5)
      }
      const days = Math.floor((now - at) / 86400000)
      let when = 'ساعتِ ' + clock + ' (' + (days < 1 ? 'امروز' : days === 1 ? '۱ روز پیش' : faNum(days) + ' روز پیش') + ')'
      if (days >= 1) {
        let date
        try {
          date = new Intl.DateTimeFormat('fa-IR', {
            timeZone: 'Asia/Tehran', month: 'long', day: 'numeric',
          }).format(new Date(at))
        } catch {
          date = ''
        }
        if (date) when = date + ' ' + clock + ' (' + (days === 1 ? '۱ روز پیش' : faNum(days) + ' روز پیش') + ')'
      }
      return when + ' · ' + source
    }

    const SERVER_MODES = [
      { value: 'auto', label: 'خودکار (اجرای دستی بی‌کش، پلی با کش)' },
      { value: 'no-cache', label: 'همیشه بی‌کش' },
      { value: 'with-cache', label: 'همیشه با کش' },
    ]



    /* ---------- چیپِ کوتاهِ سرصفحهٔ چت ---------- */

    /**
     * چیپِ کوچک کنارِ نامِ چت: سرصفحهٔ آخرین نتیجه + وضعیتِ پلی.
     * مالکِ اسلات می‌گوید: «overflow کلیپ و محو می‌شود» ⇒ متن کوتاه می‌ماند (زیرِ ۴۵ نویسه).
     */
    function HeaderChip(props) {
      const sessionId = props.sessionId ? String(props.sessionId) : ''
      const ctx = props.ctx
      const state = usePoll(sessionId ? '/plugins/advisor/state?sessionId=' + encodeURIComponent(sessionId) : null, 6000)
      const value = state.status === 'ok' ? state.value : null
      if (!sessionId || !value) return null
      const result = value.lastResult
      const play = Boolean(value.play)
      const running = Boolean(value.running)
      let text = '💡 دستیار'
      if (running) text = '⋯ دستیار'
      else if (result && result.headline) {
        const flat = String(result.headline).replace(/\s+/g, ' ').trim()
        text = '💡 ' + (flat.length > 34 ? flat.slice(0, 33) + '…' : flat)
      }
      if (play) text += ' ⟳'
      return h('button', {
        type: 'button',
        'data-advisor-chip': '',
        title: (result ? String(result.headline) : 'دستیار: بررسیِ خرج و تنظیمات') + (play ? ' · پلی روشن' : ' · پلی خاموش'),
        style: {
          display: 'inline-flex', alignItems: 'center', gap: 3,
          border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
          background: 'transparent', color: 'inherit', font: 'inherit', fontSize: 12,
          borderRadius: 999, padding: '0 8px', cursor: 'pointer',
          maxWidth: 240, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          opacity: play ? 1 : 0.8,
        },
        onClick: () => openAdvisor(ctx),
      }, text)
    }
    /* ---------- تبِ پنل ---------- */

    /** بدنهٔ تب: سرصفحه، دکمه‌ها، وضعیت، نتیجه. */
    function AdvisorBody(props) {
      const sessionId = props.sessionId ? String(props.sessionId) : ''
      const ctx = props.ctx
      const state = usePoll(sessionId ? '/plugins/advisor/state?sessionId=' + encodeURIComponent(sessionId) : null, 3000)
      const [busy, setBusy] = React.useState('')
      const [flash, setFlash] = React.useState(null)
      const [openServer, setOpenServer] = React.useState(false)
      const [openHelp, setOpenHelp] = React.useState(false)

      const value = state.status === 'ok' ? state.value : null
      const play = Boolean(value && value.play)
      const running = Boolean(value && value.running)
      const result = value && value.lastResult ? value.lastResult : null
      const quota = (value && value.quota) || null
      const cost = (value && value.cost) || null
      const mode = (value && value.serverMode) || 'auto'

      const refreshSoon = () => {
        // بی‌صبر: تا polling بعدی، خودمان دوباره بخوانیم.
        window.setTimeout(() => setFlash(null), 2500)
      }

      const runNow = async () => {
        if (!sessionId || busy === 'run' || running) return
        setBusy('run')
        const res = await post('/plugins/advisor/run', { sessionId })
        setBusy('')
        if (!res.ok) setFlash({ kind: 'err', text: res.status === 429 ? ('اجرا نشد: ' + (res.error || 'سهمیه پر است')) : ('اجرا نشد: ' + (res.error || 'خطای نامعلوم')) })
        else setFlash({ kind: 'ok', text: 'در حال بررسی…' })
        refreshSoon()
      }

      const togglePlay = async () => {
        if (!sessionId) return
        setBusy('play')
        const res = await post('/plugins/advisor/play', { sessionId, on: !play })
        setBusy('')
        if (!res.ok) {
          // سرور خودش گفته چرا و کی دوباره (۴۲۹ = سقفِ اجرا پر است).
          setFlash({ kind: 'err', text: res.status === 429 ? ('پلی روشن نشد: ' + (res.error || 'سقفِ اجرا پر است')) : ('پلی عوض نشد: ' + (res.error || 'خطا')) })
        } else if (res.value && res.value.play) {
          // پلی = هر پایانِ پاسخ یک اجرا؛ روی چتِ بزرگ هر اجرا پول است. کاربر باید بداند.
          const each = result && typeof result.cost === 'number' && result.cost > 0 ? ' (روی این چت هر اجرا حدودِ $' + faMoney(result.cost) + ')'.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : ''
          const left = res.value.quota ? ' — تا ' + faNum(res.value.quota.maxHour - res.value.quota.hour) + ' اجرای دیگر در این ساعت جا دارد' : ''
          setFlash({ kind: 'ok', text: 'پلی روشن شد: بعد از پایانِ هر پاسخ یک بار بررسی می‌کند' + each + left })
        } else {
          setFlash({ kind: 'ok', text: 'پلی خاموش شد' })
        }
        refreshSoon()
      }

      const changeMode = async (next) => {
        if (!sessionId) return
        setBusy('mode')
        const res = await post('/plugins/advisor/server', { sessionId, mode: next })
        setBusy('')
        if (!res.ok) setFlash({ kind: 'err', text: 'تنظیمِ سرور عوض نشد: ' + (res.error || 'خطا') })
        else setFlash({ kind: 'ok', text: 'سرورِ دستیار: ' + (SERVER_MODES.find((m) => m.value === next) || {}).label })
        refreshSoon()
      }

      if (!sessionId) {
        return h('div', { style: CSS.root, dir: 'rtl' }, h('div', { style: CSS.hint }, 'اول یک چت را باز کن؛ دستیار برای همان چت کار می‌کند.'))
      }

      const headlineText = result
        ? (result.headline || 'تغییری لازم نیست')
        : 'هنوز اجرا نشده — دکمهٔ «اجرا» را بزن'

      return h('div', { style: CSS.root, dir: 'rtl', 'data-advisor-panel': '' },
        // سرصفحهٔ نتیجه
        h('div', { style: { ...CSS.card, borderColor: result && result.verdict === 'advice' ? 'var(--dsw-alias-brand-primary, #3b82f6)' : undefined } },
          h('div', { style: { ...CSS.hint, marginBottom: 2 } }, 'سرصفحه'),
          h('div', { style: CSS.big, 'data-advisor-headline': '' }, headlineText)),

        // دکمه‌ها
        h('div', { style: CSS.bar },
          h('button', {
            type: 'button', style: CSS.btn(running || busy === 'run'), disabled: running || busy === 'run',
            title: 'یک بار همین حالا بررسی کن (فقط با همان کلیک)',
            onClick: runNow,
          }, running || busy === 'run' ? '⋯ در حال بررسی' : '▶ اجرا'),
          h('button', {
            type: 'button', style: CSS.btn(play), disabled: busy === 'play',
            title: play
              ? 'روشن است: بعد از پایانِ هر پاسخ یک بار بررسی می‌کند (روی چتِ بزرگ هر اجرا پول است)'
              : quota && quota.blocked
                ? 'سقفِ اجرا پر است؛ ' + quota.reason
                : 'خاموش است: بی اجازهٔ تو هیچ اجرایی نمی‌شود',
            'aria-pressed': play ? 'true' : 'false',
            onClick: togglePlay,
          }, (play && quota && quota.blocked ? '⟳ پلی: روشن (راست است، الان سقف پر است)' : play ? '⟳ پلی: روشن' : '⟳ پلی: خاموش')),
          h('button', { type: 'button', style: CSS.ghost, onClick: () => setOpenServer(!openServer) }, 'سرورِ دستیار ' + (openServer ? '▾' : '▸'))),

        flash ? h('div', { style: { ...CSS.hint, color: flash.kind === 'err' ? '#ef4444' : '#22c55e', marginBottom: 6 } }, flash.text) : null,
        state.status === 'error' ? h('div', { style: { ...CSS.hint, color: '#ef4444' } }, 'وضعیت خوانده نشد: ' + state.error) : null,

        // تنظیمِ سرور
        openServer ? h('div', { style: CSS.card },
          h('div', { style: CSS.title }, 'سرورِ دستیار'),
          h('div', { style: CSS.hint }, 'دستیار و هر ساب‌ایجنتش فقط با دیپ‌سیک فلش کار می‌کند. این تنظیم می‌گوید کدام سرورِ فلش ارزان‌تر حساب شود.'),
          h('div', { style: { marginTop: 6 } },
            h('select', {
              style: CSS.select, value: mode, disabled: busy === 'mode',
              onChange: (event) => changeMode(event.target.value),
            }, SERVER_MODES.map((option) => h('option', { key: option.value, value: option.value }, option.label)))),
          h('div', { style: { ...CSS.hint, marginTop: 6 } },
            'چرا «خودکار»: اجرای دستی معمولاً بعد از یک مکث است و کش سرد ⇒ مقایسهٔ بی‌کش. در پلی اجراها پشتِ سرِ هم‌اند و پیشوندِ ورودی یکی است ⇒ کش گرم است و مقایسهٔ با کش. در حالتِ با کش، سرورِ همین چت عوض نمی‌شود (عوض‌کردنِ سرور = همه‌چیز بی‌کش).')) : null,

        // وضعیت
        h('div', { style: CSS.card },
          h('div', { style: CSS.title }, 'وضعیت'),
          h('div', { style: CSS.row }, 'پلی: ', h('b', { style: play ? CSS.ok : CSS.hint }, play ? 'روشن' : 'خاموش')),
          h('div', { style: CSS.row }, 'اجرا: ', h('b', null, running ? 'در جریان…' : 'آماده')),
          h('div', { style: CSS.row }, 'آخرین اجرا: ', h('b', null, value && value.lastRunAt ? faTime(value.lastRunAt) : '—')),
          quota ? h('div', { style: CSS.row }, 'اجراها (سقف فقط جلوی پلی را می‌گیرد، نه ▶ دستی): ', h('span', { style: quota.blocked ? CSS.red : undefined },
            faNum(quota.hour) + ' از ' + faNum(quota.maxHour) + ' در ساعت · '
            + faNum(quota.day) + ' از ' + faNum(quota.maxDay) + ' در روز'
            + (quota.blocked ? ' — ' + quota.reason : ''))) : null,
          // «پلی روشن است ولی چیزی نکرد» — بی این خط، پلی مثلِ دکمهٔ خراب دیده می‌شود.
          value && value.playIdle ? h('div', { style: { ...CSS.row, color: value.playIdle.kind === 'quota' ? '#f59e0b' : '#ef4444' }, 'data-advisor-play-idle': '' },
            (value.playIdle.kind === 'quota' ? '⏳ پلی الان اجرا نمی‌کند: ' : value.playIdle.kind === 'skipped' ? '⏳ پلی این نوبت را رد کرد: ' : '⚠ پلی '),
            value.playIdle.reason || '',
            value.playIdle.retryAt ? h('span', { style: CSS.hint }, ' · ساعتِ ' + faTime(value.playIdle.retryAt).slice(-5) + ' دوباره') : null) : null,
          result ? h('div', { style: CSS.row }, 'این اجرا: ',
            h('b', null, result.cost == null ? 'هزینه‌اش ثبت نشد' : h('span', { style: CSS.ltr }, '$' + faMoney(result.cost))),
            result.usage ? h('span', { style: CSS.hint }, ' · ورودی ', faNum(result.usage.promptTokens), ' توکن · خروجی ', faNum(result.usage.completionTokens), ' توکن') : null) : null,
          cost ? h('div', { style: CSS.row }, 'خرجِ دستیار در این چت: ',
            h('b', { style: CSS.ltr }, '$' + faMoney(cost.advisorTotal)), ' (' + faNum(cost.advisorRuns) + ' بار اجرای موفق'
            + (cost.advisorFailedCost ? '؛ از این مبلغ $' + faMoney(cost.advisorFailedCost) + ' خرجِ اجراهای ناموفق' : '') + ')') : null,
          cost ? h('div', { style: CSS.row }, 'خرجِ خودِ چت تا الان: ',
            h('b', { style: CSS.ltr }, cost.chatPriced ? '$' + faMoney(cost.chatTotal) : 'نامعلوم')) : null,
          cost ? h('div', { style: CSS.row }, 'جمعِ هر دو: ', h('b', { style: CSS.ltr }, '$' + faMoney(cost.sum))) : null,
          value && value.lastError ? h('div', { style: { ...CSS.row, color: '#ef4444' } }, 'آخرین خطا: ' + value.lastError) : null),

        // مدل و سروری که همین اجرا استفاده کرد
        result && result.serverLabel ? h('div', { style: CSS.card },
          h('div', { style: CSS.title }, 'با چه چیزی بررسی شد'),
          h('div', { style: { ...CSS.hint, ...CSS.ltr, width: '100%' } }, result.serverLabel),
          result.server && result.server.note ? h('div', { style: CSS.hint }, result.server.note) : null,
          Array.isArray(result.failedAttempts) && result.failedAttempts.length > 0
            ? h('div', { style: { ...CSS.hint, color: '#f59e0b' } },
              'تلاشِ ناموفقِ قبلی: ' + result.failedAttempts.map((a) => a.label + ' — ' + a.error
                + (typeof a.cost === 'number' ? ' (خرج: $' + faMoney(a.cost) + ')' : ' (خرج: نامعلوم)')).join(' · '))
            : null,
          result.unread && result.unread.dropped > 0
            ? h('div', { style: { ...CSS.hint, color: '#f59e0b' } }, result.unread.note)
            : null) : null,

        // نتیجهٔ کامل
        result ? h('div', { style: CSS.card },
          h('div', { style: CSS.title }, 'پیشنهادها',
            adviceWhen(result) ? h('span', {
              style: { ...CSS.hint, fontWeight: 400, marginInlineStart: 6 },
              'data-advisor-advice-when': '',
              'data-advice-at': String(result.at),
              'data-advice-source': result.play === true ? 'play' : 'manual',
            }, '— ' + adviceWhen(result)) : null),
          h(MarkdownLite, { text: result.content })) : null,

        // راهنمای باز کردن پنل
        h('div', { style: CSS.card },
          h('div', { style: { ...CSS.title, cursor: 'pointer' }, onClick: () => setOpenHelp(!openHelp) },
            (openHelp ? '▾ ' : '▸ ') + 'چطور دوباره بازش کنم'),
          openHelp ? h('div', null,
            h('div', { style: CSS.hint }, 'این تب در پنلِ راست است. اگر بسته شد، از نوارِ پنلِ راست (کنارِ فایل‌ها) دوباره بازش کن.'),
            h('div', { style: { ...CSS.hint, marginTop: 6 } }, 'دستیار فقط پیشنهاد می‌دهد و هیچ تنظیمی را خودش عوض نمی‌کند.')) : null),
      )
    }

    /** بازکردنِ پنلِ راست روی همین تب — همان راهی که dsh-side-panel می‌رود. */
    function openAdvisor(ctx) {
      try {
        if (ctx && ctx.layout && typeof ctx.layout.openRightbar === 'function') ctx.layout.openRightbar(true, false)
        if (ctx && ctx.sidebarRight && typeof ctx.sidebarRight.openTab === 'function') ctx.sidebarRight.openTab(KIND)
      } catch (err) {
        console.warn('advisor: open failed', (err && err.message) || err)
      }
    }

    return {
      name: '@local/dsh-advisor',
      // بی inject، cordis سرویس‌ها را تزریق نمی‌کند ⇒ ctx.slots تعریف‌نشده ⇒ هیچ ثبتی انجام نمی‌شود.
      inject: ['slots', 'sidebarRightTabs', 'sidebarRight', 'layout'],
      apply(ctx) {
        const warn = (what, err) => console.warn('advisor: ' + what, err)

        // نوعِ تب در پنلِ راست
        try {
          ctx.effect(() => ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: KIND,
            priority: 'extension',
            title: () => 'دستیار',
          }), 'advisor: tab type')
        } catch (err) { warn('tab type', err) }

        // بدنهٔ تب
        try {
          ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
          }, (props) => h(AdvisorBody, { ...props, ctx })))
        } catch (err) { warn('tab body', err) }

        // آیکن در فهرستِ پنل‌ها (اختیاری، بی‌خطا)
        try {
          ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'advisor',
            order: 31,
            label: 'دستیار',
          }, () => h('span', { 'aria-hidden': 'true', style: { fontSize: 14, lineHeight: 1 } }, '💡')))
        } catch (err) { warn('panellist icon', err) }

        // چیپِ کوتاه در سرصفحهٔ چت (الگوی اثبات‌شدهٔ dsh-rtl:2860) — کلیک ⇒ همین تب باز شود.
        try {
          ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
            name: 'conversation.session.header.actions',
            id: 'advisor-chip',
            order: 95,
          }, (props) => h(HeaderChip, { ...props, ctx })))
        } catch (err) { warn('header chip', err) }
      },
    }
  },
})

