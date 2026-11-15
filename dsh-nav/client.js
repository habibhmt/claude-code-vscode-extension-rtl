/**
 * dsh-nav — نیمهٔ مرورگر
 * ----------------------
 * حبیب: «مثلِ همین حالتی که منویی میاد برای ایجنت‌ها، برای فولدرها و برای چت‌های
 * زیرِ فولدرها هم همین‌طوری توی همین ردیف باشه».
 *
 * سرصفحهٔ چت سه تکه دارد: [پوشه] / [چت] / [ساب‌ایجنت].
 * تکهٔ «چت» و «ساب‌ایجنت» مالِ خودِ اپ است: بستهٔ ui-subagent در جای خالیِ
 * conversation.session.header.lineage می‌نشیند. آن جای خالی «single» است،
 * یعنی فقط یک چیز در آن می‌نشیند؛ پس همان جای خالی را با priorityِ کمتر می‌گیریم
 * و همان چیز را می‌سازیم، فقط تکه‌ی «پوشه» و «چت» را هم کنارش می‌گذاریم.
 *
 * داده از سرویس‌های خودِ اپ: ctx.sessions.list و ctx.workspaces.list.
 * ظاهر از اجزای خودِ اپ: MenuSurface، StateDot، آیکون‌ها، متغیرهای --dsw-alias-*.
 *
 * در client.js فقط 'react' و 'react-dom' را می‌توان require کرد.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-nav',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const h = React.createElement
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { MenuSurface, StateDot, IconCheckOutlineRegular } = primitives

    /* ---------- توابعِ خالص ---------- */

    /** یک پوشه (workspace) به شکلی که رابطِ کاربر لازم دارد. */
    // WorkspaceView از خودِ اپ: { workspaceId, path, title, sessionIds, createdAt, updatedAt }

    /**
     * نامِ کوتاهِ پوشه از روی مسیر کامل.
     * سایدبار همین کار را می‌کند: آخرین بخشِ مسیر، و اگر مسیر ته داشت («/») خطا نمی‌دهد.
     * @param {string} path - مسیرِ کاملِ پوشه
     * @returns {string} نامِ پوشه، یا خودِ مسیر اگر نامی پیدا نشد
     */
    function folderName(path) {
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
    function folderLabel(workspace) {
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
    function relativeTime(updatedAt, now) {
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
    function relativeTimeLabel(updatedAt, now) {
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
    function sortByRecency(sessions) {
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
    function folderChats({ sessionIds, byId, archivedSessionIds }) {
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
    function folderList(workspaces, options = {}) {
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
    function workspaceOfSession(workspaces, cwd) {
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
    function chatLineage(byId, sessionId) {
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
    function rootChatId(byId, sessionId) {
      const chain = chatLineage(byId, sessionId)
      return chain.length ? chain[0].id : undefined
    }

    /**
     * خلاصهٔ شمارش برای سرتیترِ منو (مثلِ «۳ چت · ۱ در حال اجرا»).
     * @param {{ total: number, running: number }} counts
     * @returns {string}
     */
    function menuCounter(counts) {
      const total = Number(counts && counts.total) || 0
      const running = Number(counts && counts.running) || 0
      const parts = [`${total} چت`]
      if (running > 0) parts.push(`${running} در حال اجرا`)
      return parts.join(' · ')
    }

    /** استایلِ افزونه؛ یک بار به صفحه تزریق می‌شود. */
    const STYLE = "\n.dsh-nav-root {\n  position: relative;\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  min-width: 0;\n}\n\n/* دکمهٔ هر تکه: دقیقاً اندازه و رنگِ خودِ اپ */\n.dsh-nav-trigger {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  box-sizing: border-box;\n  min-width: 0;\n  max-width: 220px;\n  min-height: 28px;\n  padding: 4px 6px;\n  border: 0;\n  border-radius: var(--dsw-radius-md);\n  background: transparent;\n  font-size: 14px;\n  line-height: 20px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.dsh-nav-trigger-ancestor {\n  font-weight: 400;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dsh-nav-title {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.dsh-nav-trigger svg {\n  flex: none;\n}\n\n.dsh-nav-trigger svg.dsh-nav-chevron {\n  transition: transform 120ms ease;\n}\n\n.dsh-nav-trigger[aria-expanded='true'] svg.dsh-nav-chevron {\n  transform: rotate(180deg);\n}\n\n@media (hover: hover) {\n  .dsh-nav-trigger:hover {\n    background: var(--dsw-alias-interactive-bg-hover);\n    color: var(--dsw-alias-label-primary);\n  }\n}\n\n.dsh-nav-trigger:focus-visible {\n  outline: none;\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n/* منو: همان قابِ منوی اپ */\n.dsh-nav-menu {\n  position: fixed;\n  z-index: 100;\n  box-sizing: border-box;\n  display: flex;\n  flex-direction: column;\n  width: min(360px, calc(100vw - 32px));\n  max-width: calc(100vw - 32px);\n  max-height: min(560px, calc(100dvh - 140px));\n  padding: 6px;\n  overflow: hidden;\n  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);\n  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);\n  box-shadow: var(--dsw-elevation-prominent);\n  top: calc(anchor(bottom) + 5px);\n  left: clamp(16px, anchor(left), calc(100vw - min(360px, calc(100vw - 32px)) - 16px));\n  position-area: none;\n  position-try-fallbacks: --dsh-nav-above, --dsh-nav-window;\n  height: fit-content;\n  min-height: 0;\n  margin: 0;\n}\n\n.dsh-nav-menu-body {\n  display: flex;\n  flex-direction: column;\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow: auto;\n  scrollbar-gutter: stable;\n}\n\n.dsh-nav-section-header {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  padding: 4px 7px 8px;\n}\n\n.dsh-nav-section-title {\n  flex: none;\n  margin: 0;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 24px;\n}\n\n.dsh-nav-section-progress {\n  flex: 1 1 auto;\n  min-width: 0;\n  margin-inline-start: 4px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n  line-height: 20px;\n  overflow-wrap: anywhere;\n}\n\n.dsh-nav-empty {\n  margin: 0;\n  padding: 2px 10px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n/* هر ردیف منو: نقطهٔ سبز، برچسب، زمان، تیک */\n.dsh-nav-row {\n  position: relative;\n  display: flex;\n  align-items: flex-start;\n  gap: 7px;\n  box-sizing: border-box;\n  width: 100%;\n  min-height: 40px;\n  padding: 4px 6px;\n  border: 0;\n  border-radius: var(--dsw-radius-md);\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  line-height: 17px;\n  text-align: start;\n  cursor: pointer;\n  outline: none;\n}\n\n@media (hover: hover) {\n  .dsh-nav-row:hover {\n    background: var(--dsw-alias-interactive-bg-hover);\n  }\n}\n\n.dsh-nav-row:focus-visible {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dsh-nav-row-dot {\n  display: inline-flex;\n  flex: none;\n  align-items: center;\n  justify-content: center;\n  width: 14px;\n  height: 17px;\n}\n\n.dsh-nav-row-content {\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n  min-width: 0;\n}\n\n.dsh-nav-row-label {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 13px;\n  line-height: 17px;\n  font-weight: 400;\n  color: inherit;\n}\n\n.dsh-nav-row-current .dsh-nav-row-label {\n  font-weight: 500;\n}\n\n.dsh-nav-row-secondary {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 15px;\n}\n\n.dsh-nav-row-metrics {\n  flex: none;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 10px;\n  line-height: 15px;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n  text-align: end;\n  display: grid;\n  grid-template-rows: 17px 15px;\n}\n\n.dsh-nav-row-time {\n  grid-row: 1;\n  line-height: 17px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n}\n\n.dsh-nav-row-tick {\n  display: grid;\n  flex: none;\n  place-items: center;\n  width: 28px;\n  height: 28px;\n  margin: 2px 0;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dsh-nav-row-tick-space {\n  flex: none;\n  width: 28px;\n  height: 28px;\n}\n\n@position-try --dsh-nav-above {\n  top: auto;\n  bottom: calc(anchor(top) + 5px);\n}\n\n@position-try --dsh-nav-window {\n  top: max(16px, var(--dsh-frame-overlay-top, 16px));\n  bottom: 16px;\n  align-self: safe start;\n  justify-self: safe start;\n}\n\n/* جهتِ راست‌به‌چپ: آیکونِ ^ به‌جای ⌄ رو به بالا می‌ماند، اندازه‌ها هم‌اند */\nhtml[dir='rtl'] .dsh-nav-row,\nhtml[dir='rtl'] .dsh-nav-row-content {\n  text-align: right;\n}\n\n/* دکمهٔ «+ چتِ جدید» در سرِ منوی چت‌ها */\n.dsh-nav-new-chat {\n  display: inline-flex;\n  flex: none;\n  align-items: center;\n  gap: 4px;\n  margin-inline-start: auto;\n  padding: 2px 8px;\n  border: 0;\n  border-radius: var(--dsw-radius-md);\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  line-height: 20px;\n  cursor: pointer;\n}\n\n.dsh-nav-new-chat:hover,\n.dsh-nav-new-chat:focus-visible {\n  outline: none;\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dsh-nav-new-chat-plus {\n  font-size: 16px;\n  line-height: 16px;\n}\n"

    /** نامِ کلاس‌های CSS. */
    const CLS = {
      root: 'dsh-nav-root', trigger: 'dsh-nav-trigger', title: 'dsh-nav-title',
      chevron: 'dsh-nav-chevron', menu: 'dsh-nav-menu', body: 'dsh-nav-menu-body',
      sectionHeader: 'dsh-nav-section-header', sectionTitle: 'dsh-nav-section-title',
      sectionProgress: 'dsh-nav-section-progress', empty: 'dsh-nav-empty', row: 'dsh-nav-row',
      rowDot: 'dsh-nav-row-dot', rowContent: 'dsh-nav-row-content', rowLabel: 'dsh-nav-row-label',
      rowCurrent: 'dsh-nav-row-current', rowSecondary: 'dsh-nav-row-secondary',
      rowMetrics: 'dsh-nav-row-metrics', rowTime: 'dsh-nav-row-time', rowTick: 'dsh-nav-row-tick',
      rowTickSpace: 'dsh-nav-row-tick-space', newChat: 'dsh-nav-new-chat', newChatPlus: 'dsh-nav-new-chat-plus',
    }

    /** آیکونِ ⌃⌄ خودِ اپ (از ui-subagent). */
    function ChevronSwitcherIcon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': 'true', className: CLS.chevron },
        h('path', {
          d: 'M5.99951 12.7L8.95546 14.9478C9.40011 15.2859 9.62244 15.455 9.87526 15.488C9.95774 15.4988 10.0413 15.4988 10.1238 15.488C10.3766 15.455 10.5989 15.2859 11.0436 14.9478L13.9995 12.7',
          stroke: 'currentColor', strokeWidth: '1.5',
        }),
        h('path', {
          d: 'M13.9995 7.7417L11.0436 5.49387C10.5989 5.15574 10.3766 4.98668 10.1238 4.95362C10.0413 4.94283 9.95775 4.94283 9.87527 4.95362C9.62245 4.98668 9.40012 5.15574 8.95547 5.49387L5.99952 7.7417',
          stroke: 'currentColor', strokeWidth: '1.5',
        }))
    }

    /** مدتِ اجرا مثلِ خودِ اپ: «18m 05s» / «42s» / «2h 10m». */
    function formatClock(ms) {
      const total = Math.floor(Math.max(0, Number(ms) || 0) / 1000)
      const hours = Math.floor(total / 3600)
      const minutes = Math.floor((total % 3600) / 60)
      const seconds = total % 60
      const pad = (value) => String(value).padStart(2, '0')
      if (hours > 0) return String(hours) + 'h ' + pad(minutes) + 'm'
      if (minutes > 0) return String(minutes) + 'm ' + pad(seconds) + 's'
      return String(seconds) + 's'
    }

    /** توکن‌ها مثلِ خودِ اپ: «38.4M tok». */
    function formatTokens(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return ''
      const scaled = (next) => (next >= 100 ? String(Math.round(next)) : String(Math.round(next * 10) / 10))
      if (value < 1000) return String(value) + ' tok'
      if (value < 1000000) return scaled(value / 1000) + 'K tok'
      return scaled(value / 1000000) + 'M tok'
    }

    /** چترِ مشترکِ منوها: باز/بسته، Escape، کلیکِ بیرون، حرکت با کیبورد. */
    function useDropdown() {
      const [open, setOpen] = React.useState(false)
      const rootRef = React.useRef(null)
      const triggerRef = React.useRef(null)
      const menuRef = React.useRef(null)
      const anchorName = React.useMemo(() => '--dsh-nav-' + Math.random().toString(36).slice(2, 9), [])

      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const target = event.target
          if (!target || typeof target.nodeType !== 'number') return
          if (rootRef.current && rootRef.current.contains(target)) return
          if (triggerRef.current && triggerRef.current.contains(target)) return
          if (menuRef.current && menuRef.current.contains(target)) return
          setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          const inside = menuRef.current !== null && menuRef.current.contains(document.activeElement)
          event.preventDefault()
          setOpen(false)
          if (inside) queueMicrotask(() => { if (triggerRef.current) triggerRef.current.focus() })
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [open])

      /** با کیبورد بین ردیف‌ها می‌چرخد. */
      const onMenuKeyDown = (event) => {
        const menu = menuRef.current
        if (!menu) return
        const items = Array.from(menu.querySelectorAll('[data-dsh-nav-row]'))
        if (items.length === 0) return
        const index = items.indexOf(document.activeElement)
        const focusAt = (at) => { const next = items[(at + items.length) % items.length]; if (next) next.focus() }
        if (event.key === 'Home') { event.preventDefault(); focusAt(0) }
        else if (event.key === 'End') { event.preventDefault(); focusAt(items.length - 1) }
        else if (event.key === 'ArrowDown') { event.preventDefault(); focusAt(index < 0 ? 0 : index + 1) }
        else if (event.key === 'ArrowUp') { event.preventDefault(); focusAt(index < 0 ? items.length - 1 : index - 1) }
      }

      return {
        open,
        setOpen,
        toggle: () => setOpen((value) => !value),
        close: () => setOpen(false),
        rootRef, triggerRef, menuRef, anchorName, onMenuKeyDown,
      }
    }

    /** یک ردیفِ منو: نقطهٔ وضعیت، برچسب، خطِ دوم، زمان، تیکِ «همین‌جاست». */
    function NavRow({ id, label, secondary, time, state, current, onPick }) {
      const pick = (event) => {
        event.preventDefault()
        event.stopPropagation()
        onPick(id)
      }
      return h('button', {
        type: 'button',
        className: CLS.row + (current ? ' ' + CLS.rowCurrent : ''),
        'data-dsh-nav-row': id,
        'aria-current': current ? 'true' : undefined,
        title: secondary || label,
        onClick: pick,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onPick(id) }
        },
      },
        h('span', { className: CLS.rowDot }, h(StateDot, { state: state || 'idle' })),
        h('span', { className: CLS.rowContent },
          h('span', { className: CLS.rowLabel }, label),
          secondary ? h('span', { className: CLS.rowSecondary }, secondary) : null),
        h('span', { className: CLS.rowMetrics }, h('span', { className: CLS.rowTime }, time || '')),
        current
          ? h('span', { className: CLS.rowTick, 'data-dsh-nav-current': '' }, h(IconCheckOutlineRegular, { size: 16 }))
          : h('span', { className: CLS.rowTickSpace, 'aria-hidden': 'true' }))
    }

    /** پوستهٔ منو: همان MenuSurface خودِ اپ (شیشه‌ای، سایه، لبه) + بدنهٔ اسکرول‌شو. */
    function MenuShell({ dropdown, label, children }) {
      if (!dropdown.open) return null
      return createPortal(
        h(MenuSurface, {
          ref: dropdown.menuRef,
          className: CLS.menu,
          style: { positionAnchor: dropdown.anchorName },
          role: 'dialog',
          tabIndex: -1,
          'aria-label': label,
          'data-dsh-nav-panel': '',
          onKeyDown: dropdown.onMenuKeyDown,
          onPointerDown: (event) => { event.stopPropagation() },
        }, h('div', { className: CLS.body }, children)),
        document.body)
    }

    /** دکمهٔ یک تکه: عنوان + ⌃⌄. */
    function SegmentTrigger({ dropdown, title, tooltip }) {
      return h('button', {
        ref: dropdown.triggerRef,
        type: 'button',
        className: CLS.trigger,
        style: { anchorName: dropdown.anchorName },
        'aria-haspopup': 'dialog',
        'aria-expanded': dropdown.open ? 'true' : 'false',
        'aria-label': tooltip,
        title: tooltip,
        'data-dsh-nav-trigger': '',
        onClick: (event) => { event.preventDefault(); event.stopPropagation(); dropdown.toggle() },
        onKeyDown: (event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); dropdown.setOpen(true) }
        },
      },
        h('span', { className: CLS.title }, title),
        h(ChevronSwitcherIcon, null))
    }

    /** سرتیترِ منو. */
    function MenuHeader({ title, counter, action }) {
      return h('div', { className: CLS.sectionHeader },
        h('h3', { className: CLS.sectionTitle }, title),
        counter ? h('span', { className: CLS.sectionProgress }, counter) : null,
        action || null)
    }

    /** دکمهٔ «+ چتِ جدید» در سرِ منوی چت‌ها. */
    function NewChatButton({ onClick }) {
      return h('button', {
        type: 'button',
        className: CLS.newChat,
        title: 'چتِ جدید در همین پوشه',
        'aria-label': 'چتِ جدید در همین پوشه',
        'data-dsh-nav-new-chat': '',
        onClick: (event) => { event.preventDefault(); event.stopPropagation(); onClick() },
      }, h('span', { 'aria-hidden': 'true', className: CLS.newChatPlus }, '+'), h('span', null, 'چتِ جدید'))
    }

    /** فرزندانِ مستقیمِ ساب‌ایجنتِ یک چت، از همان داده‌ای که منوی خودِ اپ می‌خواند. */
    function subagentRows(state, rootId, currentId, now) {
      const projections = state && state.projectionsBySession ? state.projectionsBySession : {}
      const catalog = projections[rootId]
      const entries = catalog && catalog.values && Array.isArray(catalog.values.subagentCatalog)
        ? catalog.values.subagentCatalog
        : []
      const byId = (state && state.byId) || {}
      return entries.filter(entry => entry && entry.mode !== 'external').map((entry) => {
        const summary = byId[entry.id]
        const running = Boolean(summary && summary.running)
        const timing = summary && summary.projectionValues ? summary.projectionValues.subagentTiming : undefined
        const usage = summary && summary.projectionValues ? summary.projectionValues.tokenUsage : undefined
        let duration = ''
        if (timing) {
          let ms = typeof timing.settledMs === 'number' ? timing.settledMs : 0
          if (timing.active) ms += Math.max(0, (running ? now : timing.active.through) - timing.active.since)
          duration = formatClock(ms)
        }
        const tokens = usage
          ? (usage.uncachedInputTokens || 0) + (usage.outputTokens || 0) + (usage.cacheReadTokens || 0) + (usage.cacheWriteTokens || 0)
          : null
        return {
          id: entry.id,
          label: entry.label || (summary && summary.displayTitle) || entry.name || entry.id,
          secondary: entry.mode === 'continuable' ? (entry.name || '') : (tokens === null ? '' : formatTokens(tokens)),
          time: duration,
          state: running ? 'ongoing' : (timing && timing.lastTurnCompleted ? 'done' : 'idle'),
          current: entry.id === currentId,
        }
      })
    }

    /** تکهٔ «پوشه» + منوی همهٔ پوشه‌ها. */
    function FolderSegment({ nav, title, workspaceId, onSelect }) {
      const dropdown = useDropdown()
      const state = nav.read()
      const items = folderList(state.items, { currentWorkspaceId: workspaceId })
      const now = nav.now()
      return h('span', { className: CLS.root, 'data-dsh-nav-folder': '' },
        h(SegmentTrigger, { dropdown, title, tooltip: 'انتخاب پوشه — ' + title }),
        h(MenuShell, { dropdown, label: 'پوشه‌ها' },
          h(React.Fragment, null,
            h(MenuHeader, { title: 'پوشه‌ها', counter: items.length ? String(items.length) + ' پوشه' : '' }),
            items.length === 0 ? h('p', { className: CLS.empty }, 'پوشه‌ای نیست') : null,
            items.map(item => h(NavRow, {
              key: item.id,
              id: item.id,
              label: item.label,
              secondary: item.path,
              time: relativeTimeLabel(item.updatedAt, now),
              state: 'idle',
              current: item.current,
              // حبیب: «فولدر رو میزنیم چیزی تغییر نکنه فقط وقتی روی چت میزنیم پنجره تغییر کنه»
              onPick: (id) => { dropdown.close(); onSelect(id) },
            })))))
    }

    /** تکهٔ «چت» + منوی چت‌های همین پوشه (تازه‌ترین اول). */
    function ChatSegment({ nav, title, workspaceId, currentChatId, openSignal }) {
      const dropdown = useDropdown()
      // بعد از انتخابِ پوشه، منوی چت‌هایش خودش باز می‌شود.
      React.useEffect(() => { if (openSignal > 0) dropdown.setOpen(true) }, [openSignal])
      const state = nav.read()
      const workspace = state.items.find(item => item.workspaceId === workspaceId)
      const rows = folderChats({
        sessionIds: workspace && Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [],
        byId: state.byId,
        archivedSessionIds: state.archivedSessionIds,
      })
      const now = nav.now()
      const running = rows.filter(row => row.running).length
      return h('span', { className: CLS.root, 'data-dsh-nav-chat': '' },
        h(SegmentTrigger, { dropdown, title, tooltip: 'انتخاب چت — ' + title }),
        h(MenuShell, { dropdown, label: 'چت‌های این پوشه' },
          h(React.Fragment, null,
            h(MenuHeader, {
              title: 'چت‌های این پوشه',
              counter: rows.length ? menuCounter({ total: rows.length, running }) : '',
              action: workspaceId ? h(NewChatButton, { onClick: () => { dropdown.close(); nav.openWorkspace(workspaceId) } }) : null,
            }),
            rows.length === 0 ? h('p', { className: CLS.empty }, 'چتی در این پوشه نیست') : null,
            rows.map(row => h(NavRow, {
              key: row.id,
              id: row.id,
              label: row.label,
              secondary: '',
              time: relativeTimeLabel(row.updatedAt, now),
              state: row.running ? 'ongoing' : 'idle',
              current: row.id === currentChatId,
              onPick: (id) => { dropdown.close(); nav.openSession(id) },
            })))))
    }

    /** تکهٔ «ساب‌ایجنت» + منوی ساب‌ایجنت‌های همین چت. */
    function SubagentSegment({ nav, title, rootId, currentId }) {
      const dropdown = useDropdown()
      const state = nav.read()
      const rows = subagentRows(state, rootId, currentId, nav.now())
      return h('span', { className: CLS.root, 'data-dsh-nav-subagent': '' },
        h(SegmentTrigger, { dropdown, title, tooltip: 'انتخاب ساب‌ایجنت — ' + title }),
        h(MenuShell, { dropdown, label: 'ساب‌ایجنت‌ها' },
          h(React.Fragment, null,
            h(MenuHeader, { title: 'ساب‌ایجنت‌ها', counter: '' }),
            rows.length === 0 ? h('p', { className: CLS.empty }, 'ساب‌ایجنتِ فعالی نیست') : null,
            rows.map(row => h(NavRow, {
              key: row.id,
              id: row.id,
              label: row.label,
              secondary: row.secondary,
              time: row.time,
              state: row.state,
              current: row.current,
              onPick: (id) => { dropdown.close(); nav.openSession(id) },
            })))))
    }

    /** کلِ ردیفِ سرصفحه: [پوشه] / [چت] / [ساب‌ایجنت]. */
    function NavSegments({ nav, sessionId }) {
      // هر ۳۰ ثانیه تازه می‌شود تا «9min» کهنه نشود.
      const [, tick] = React.useState(0)
      React.useEffect(() => {
        const timer = setInterval(() => tick((value) => value + 1), 30000)
        if (timer && typeof timer.unref === 'function') timer.unref()
        return () => { clearInterval(timer) }
      }, [])
      // با هر تغییرِ چت‌ها یا پوشه‌ها دوباره رندر می‌شود.
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        const sources = [nav.source && nav.source.sessions ? nav.source.sessions() : null,
          nav.source && nav.source.workspaces ? nav.source.workspaces() : null]
        const offs = []
        for (const source of sources) {
          if (!source || typeof source.subscribe !== 'function') continue
          const off = source.subscribe(() => bump((value) => value + 1))
          if (typeof off === 'function') offs.push(off)
        }
        return () => { for (const off of offs) off() }
      }, [])
      // پوشه‌ای که در منو انتخاب شده (فقط فهرستِ چت‌ها را عوض می‌کند، نه پنجره را).
      const [pickedWorkspaceId, setPickedWorkspaceId] = React.useState(null)
      const [openSignal, setOpenSignal] = React.useState(0)
      React.useEffect(() => { setPickedWorkspaceId(null) }, [sessionId])
      const state = nav.read()
      const chain = chatLineage(state.byId, sessionId)
      const rootChat = chain.length ? chain[0] : undefined
      const chatCrumb = chain.length > 1 ? chain[chain.length - 2] : rootChat
      const subCrumb = chain.length > 1 ? chain[chain.length - 1] : undefined
      const rootId = rootChat ? rootChat.id : sessionId
      const rootSummary = state.byId[rootId]
      const byCwd = workspaceOfSession(state.items, rootSummary ? rootSummary.cwd : undefined)
      const byMembership = (state.items.find(item => Array.isArray(item.sessionIds) && item.sessionIds.includes(rootId)) || {}).workspaceId
      const workspaceId = byCwd !== undefined ? byCwd : byMembership
      const shownWorkspaceId = pickedWorkspaceId || workspaceId
      const browsingOther = shownWorkspaceId !== workspaceId
      const workspace = state.items.find(item => item.workspaceId === shownWorkspaceId)
      const folderTitle = folderLabel(workspace) || 'بدونِ پوشه'
      const chatTitle = browsingOther
        ? 'یک چت انتخاب کن'
        : ((chatCrumb && chatCrumb.label) || (rootSummary && rootSummary.displayTitle) || 'چت')
      const selectFolder = (id) => {
        setPickedWorkspaceId(id === workspaceId ? null : id)
        setOpenSignal((value) => value + 1)
      }
      const subTitle = (subCrumb && subCrumb.label) || ''
      return h(React.Fragment, null,
        h(FolderSegment, { nav, title: folderTitle, workspaceId: shownWorkspaceId, onSelect: selectFolder }),
        h('span', { className: 'dsh-nav-sep', 'aria-hidden': 'true' }, '/'),
        h(ChatSegment, { nav, title: chatTitle, workspaceId: shownWorkspaceId, currentChatId: rootId, openSignal }),
        subCrumb && !browsingOther
          ? h(React.Fragment, null,
            h('span', { className: 'dsh-nav-sep', 'aria-hidden': 'true' }, '/'),
            h(SubagentSegment, { nav, title: subTitle, rootId, currentId: sessionId }))
          : null)
    }

    /** استایلِ افزونه را یک بار به صفحه اضافه می‌کند؛ برگشتی هنگامِ برداشتنِ افزونه آن را پاک می‌کند. */
    function installStyles() {
      if (typeof document === 'undefined') return () => {}
      // نسخهٔ کهنه (مثلاً پس از hot-reload) را جایگزین کن، نه این‌که با دیدنش برگردی.
      document.querySelectorAll('style[data-dsh-nav-style]').forEach((old) => { if (old.parentNode) old.parentNode.removeChild(old) })
      const style = document.createElement('style')
      style.setAttribute('data-dsh-nav-style', '')
      style.textContent = STYLE
      document.head.appendChild(style)
      return () => { if (style.parentNode) style.parentNode.removeChild(style) }
    }

    return {
      name: '@local/dsh-nav',
      inject: ['slots', 'sessions', 'workspaces', 'uiWorkspace'],
      apply(ctx) {
        const warn = (what, error) => { console.warn('[dsh-nav] ' + what, error) }

        try { ctx.effect(installStyles, 'dsh-nav: styles') } catch (error) { warn('styles', error) }

        /** خواندنِ امنِ یک منبع. */
        const snapshotOf = (source, fallback) => {
          try {
            if (source && typeof source.getSnapshot === 'function') {
              const value = source.getSnapshot()
              if (value !== undefined && value !== null) return value
            }
          } catch (error) { warn('snapshot', error) }
          return fallback
        }

        const sessionsSource = () => (ctx.sessions && ctx.sessions.list ? ctx.sessions.list : null)
        const workspacesSource = () => (ctx.workspaces && ctx.workspaces.list ? ctx.workspaces.list : null)

        /** چت‌ها و پوشه‌ها، همیشه تازه. */
        const readState = () => {
          const sessions = snapshotOf(sessionsSource(), { byId: {}, ids: [] })
          const workspaces = snapshotOf(workspacesSource(), { items: [], archivedSessionIds: [] })
          return {
            byId: sessions.byId || {},
            ids: sessions.ids || [],
            // فهرستِ ساب‌ایجنت‌ها همین‌جاست؛ منوی خودِ اپ هم از همین می‌خواند.
            projectionsBySession: sessions.projectionsBySession || {},
            items: workspaces.items || [],
            archivedSessionIds: workspaces.archivedSessionIds || [],
          }
        }

        const openSession = (id) => {
          try { ctx.uiWorkspace.openSession(id) } catch (error) { warn('openSession', error) }
        }
        const openWorkspace = (workspaceId) => {
          try { ctx.uiWorkspace.startSession(workspaceId) } catch (error) { warn('startSession', error) }
        }

        const buildNav = () => ({
          now: () => Date.now(),
          read: readState,
          openSession,
          openWorkspace,
          // منبع‌های زنده، برای اشتراک و رندرِ دوباره.
          source: { sessions: sessionsSource, workspaces: workspacesSource },
        })

        try {
          const nav = buildNav()
          ctx.slots.inject('conversation.session.header.lineage', () => ctx.slots.register({
            name: 'conversation.session.header.lineage',
            // ردیفِ تک‌نفرهٔ lineage: عددِ کمتر برنده است.
            priority: -100,
          }, function NavLineage(props) {
            return h(NavSegments, { nav, sessionId: props.lineageSessionId })
          }))
        } catch (error) { warn('lineage slot', error) }
      },
    }
  },
})
