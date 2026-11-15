/**
 * دستیار — انتخابِ سرور و مدل (بی‌شبکه؛ ورودی‌اش خروجیِ شکارچی مدل است)
 * ------------------------------------------------------------------------
 * قانونِ حبیب: دستیار و هر ساب‌ایجنت فقط دیپ‌سیک فلش.
 * تنظیمِ «سرورِ دستیار» سه حالت دارد:
 *   auto       : خودکار — اجرای دستی (▶) ⇒ رتبه‌بندیِ بی‌کش، پلی (⟳) ⇒ رتبه‌بندیِ با کش
 *   no-cache   : همیشه بی‌کش
 *   with-cache : همیشه با کش
 * دلیلِ auto: هر اجرای دستی بعد از یک مکث است و کش معمولاً سرد است ⇒ مقایسهٔ بی‌کش؛
 * ولی در پلی اجراها پشتِ سرِ هم‌اند و پیشوندِ ورودی یکی است ⇒ کش گرم است و مقایسهٔ با کش.
 *
 * قاعدهٔ پایداری: در حالتِ با کش (و auto وقتی پلی است) سرورِ همان چت عوض نمی‌شود؛
 * عوض‌کردنِ سرور یعنی همه‌چیز بی‌کش = پولِ دوباره. تا خودِ کاربر تنظیم را عوض نکند.
 */

/** اگر شکارچی مدل جواب نداد، همان پریستِ همیشگیِ حبیب. */
export const FALLBACK_MODEL = 'deepseek/deepseek-v4.1-flash-1017@preset/mh-deepseek-v4-1-flash-1017-deepinfra'
export const FALLBACK_PROVIDER = 'DeepInfra'

/** سه گزینهٔ تنظیم، با متنِ ساده برای کاربر. */
export const SERVER_MODES = ['auto', 'no-cache', 'with-cache']
export const SERVER_MODE_LABELS = {
  auto: 'خودکار (اجرای دستی بی‌کش، پلی با کش)',
  'no-cache': 'همیشه بی‌کش',
  'with-cache': 'همیشه با کش',
}

/**
 * حالتِ کش برای این اجرا.
 * @param mode - تنظیمِ کاربر.
 * @param play - این اجرا خودکار است؟
 * @returns 'with' یا 'none'
 */
export function cacheModeFor(mode, play) {
  if (mode === 'no-cache') return 'none'
  if (mode === 'with-cache') return 'with'
  return play ? 'with' : 'none'
}

/** آیا این اجرا باید سرورِ قبلیِ همین چت را نگه دارد؟ */
export function shouldStick(mode, play) {
  return cacheModeFor(mode, play) === 'with'
}

/** فقط دیپ‌سیک فلش: نامِ مدل باید «flash» داشته باشد (pro و هر چیزِ دیگر رد). */
export function isFlashModel(model) {
  return typeof model === 'string' && /flash/i.test(model) && /deepseek/i.test(model)
}

/**
 * اولین انتخابِ فلش از فهرستِ رتبه‌بندی‌شده.
 * @param rows - خروجیِ /plugins/model-hunter/rank ({model, provider, providerSlug, ...}).
 * @returns { model, provider, providerSlug, priceIn1m, cacheRead1m, priceOut1m } یا null.
 */
export function pickFlash(rows) {
  const list = Array.isArray(rows) ? rows : []
  for (const row of list) {
    if (!row || typeof row !== 'object') continue
    if (!isFlashModel(row.model)) continue
    if (typeof row.providerSlug !== 'string' || row.providerSlug === '') continue
    return {
      model: row.model,
      provider: typeof row.provider === 'string' ? row.provider : row.providerSlug,
      providerSlug: row.providerSlug,
      priceIn1m: row.priceIn1m ?? null,
      cacheRead1m: row.cacheRead1m ?? null,
      priceOut1m: row.priceOut1m ?? null,
      contextLength: row.contextLength ?? null,
    }
  }
  return null
}

/**
 * انتخابِ نهایی، با پایبندی به سرورِ قبلیِ همین چت.
 * @param options - { mode, play, ranked, previous }
 *   ranked: فهرستِ رتبه‌بندی‌شده یا null (شکارچی مدل در دسترس نیست)
 *   previous: { model, provider, providerSlug } اجرای قبلیِ همین چت
 * @returns { model, provider, providerSlug, cache: 'with'|'none', source: 'hunter'|'fallback'|'sticky', note }
 */
export function chooseServer(options) {
  const opt = options && typeof options === 'object' ? options : {}
  const cache = cacheModeFor(opt.mode, opt.play)
  const previous = opt.previous && typeof opt.previous === 'object' ? opt.previous : null
  const hasPrevious = previous && typeof previous.model === 'string' && previous.model !== ''

  if (shouldStick(opt.mode, opt.play) && hasPrevious) {
    return {
      model: previous.model,
      provider: previous.provider || previous.providerSlug || null,
      providerSlug: previous.providerSlug || null,
      cache,
      source: 'sticky',
      note: 'همان سرورِ قبلیِ همین چت ماند (عوض‌کردنِ سرور یعنی همه‌چیز بی‌کش).',
    }
  }

  const picked = pickFlash(opt.ranked)
  if (picked) {
    return {
      ...picked,
      cache,
      source: 'hunter',
      note: cache === 'none'
        ? 'ارزان‌ترین سرورِ فلش در حالتِ بی‌کش (از شکارچی مدل).'
        : 'ارزان‌ترین سرورِ فلش در حالتِ با کش (از شکارچی مدل).',
    }
  }

  return {
    model: FALLBACK_MODEL,
    provider: FALLBACK_PROVIDER,
    providerSlug: 'deepinfra',
    cache,
    source: 'fallback',
    note: opt.ranked === null || opt.ranked === undefined
      ? 'شکارچی مدل جواب نداد؛ رفت روی پریستِ همیشگیِ دیپ‌اینفرا.'
      : 'در فهرست، سرورِ فلشِ مناسبی نبود؛ رفت روی پریستِ همیشگیِ دیپ‌اینفرا.',
  }
}

/** متنِ خوانا برای نتیجه: «مدل — سرور (با کش/بی‌کش، از کجا)». */
export function describeServer(server) {
  const s = server && typeof server === 'object' ? server : {}
  const cache = s.cache === 'none' ? 'بی‌کش' : 'با کش'
  const from = s.source === 'hunter' ? 'شکارچی مدل' : s.source === 'sticky' ? 'همان سرورِ قبلی' : 'پیش‌فرض'
  return (s.model || FALLBACK_MODEL) + ' — ' + cache + ' — ' + from
}

/**
 * بدنهٔ درخواست به OpenRouter: همین مدل، پین‌شده روی همین سرور، بی‌فال‌بک.
 * @param params - { model, providerSlug, messages, maxTokens }
 */
export function openRouterBody(params) {
  const p = params && typeof params === 'object' ? params : {}
  const body = {
    model: p.model,
    messages: p.messages,
    max_tokens: p.maxTokens,
    usage: { include: true },
  }
  if (typeof p.providerSlug === 'string' && p.providerSlug !== '') {
    body.provider = { order: [p.providerSlug], allow_fallbacks: false }
  }
  return body
}
