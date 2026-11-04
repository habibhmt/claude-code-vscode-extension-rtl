// The mod's options (plugin.json `userConfig`), read once per load.

import type { Base } from './bidi.ts'
import type { Arabic, Mode } from './layout.ts'
import type { Settings } from './render.ts'

export type Order = Mode | 'off'

export function settingsFrom(options: Record<string, unknown>): { order: Order; settings: Settings; textColor: string; recap: boolean; preview: boolean; suggestion: boolean } {
  const order = (['visual', 'logical', 'off'].includes(String(options.order)) ? options.order : 'visual') as Order
  const base = (options.direction === 'first-strong' ? 'first-strong' : 'rtl-share') as Base
  const textColor = typeof options.textColor === 'string' ? options.textColor : ''
  const arabic: Arabic = options.arabic === 'forms' ? 'forms' : 'letters'
  const recap = options.recap === 'on'
  // `on`: the draft and Claude Code's suggestion; `draft`: the draft alone
  const preview = options.preview !== 'off'
  const suggestion = preview && options.preview !== 'draft'
  return { order, settings: { mode: order === 'logical' ? 'logical' : 'visual', base, share: 0.3, arabic }, textColor, recap, preview, suggestion }
}
