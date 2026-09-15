/**
 * i18n Utility Functions
 *
 * Core helpers for translation and locale-aware URL handling.
 * Designed as pure functions for testability and SSR compatibility.
 */

import { defaultLocale, isLocaleSupported } from './config';
import { translations } from './translations';
import { uiStrings as defaultStrings } from './translations/zh';
import type { Locale, TranslationKey, TranslationParams } from './types';

/**
 * Determines the initial locale for SSR, considering URL, cookie, and Accept-Language header.
 * This function is designed to be called on the server during SSR.
 */
export function getInitialLocale(
  pathname: string,
  acceptLanguageHeader: string | null,
  localeCookie: string | null,
): Locale {
  // 1. Prioritize locale from URL
  const urlLocale = getLocaleFromUrl(pathname);
  if (urlLocale !== defaultLocale) {
    return urlLocale;
  }

  // 2. Check for user preference cookie
  if (localeCookie && isLocaleSupported(localeCookie)) {
    return localeCookie;
  }

  // 3. Parse Accept-Language header
  if (acceptLanguageHeader) {
    const acceptedLangs = acceptLanguageHeader.split(',').map((lang) => lang.split(';')[0].trim());
    for (const lang of acceptedLangs) {
      if (isLocaleSupported(lang)) {
        return lang;
      }
    }
  }

  // 4. Fallback to default locale
  return defaultLocale;
}

/** Replace `{param}` placeholders in a string with provided values. */
function interpolate(value: string, params?: TranslationParams): string {
  if (!params) return value;
  let result = value;
  for (const [param, val] of Object.entries(params)) {
    result = result.replaceAll(`{${param}}`, String(val));
  }
  return result;
}

/**
 * Translate a key to the given locale with optional parameter interpolation.
 *
 * Lookup order:
 * 1. Target locale dictionary
 * 2. Default locale dictionary (fallback)
 *
 * Interpolation replaces `{param}` placeholders with provided values.
 *
 * @example
 * ```ts
 * t('zh', 'post.totalPosts', { count: 5 })
 * // => '共 5 篇文章'
 *
 * t('en', 'post.totalPosts', { count: 5 })
 * // => '5 posts'
 * ```
 */
export function t(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const dict = translations[locale];
  const value = dict?.[key] ?? defaultStrings[key];

  if (!value) {
    // Development warning for missing keys
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing translation key: "${key}" for locale "${locale}"`);
    }
    return key;
  }

  return interpolate(value, params);
}

/**
 * Try to translate a dynamic key that may or may not exist in the dictionary.
 * Unlike `t()`, accepts an arbitrary string key and returns `undefined` if not found.
 * This avoids `as TranslationKey` casts for dynamically constructed keys.
 */
function tryTranslate(locale: Locale, key: string, params?: TranslationParams): string | undefined {
  const dict = translations[locale];
  const value = dict?.[key as TranslationKey] ?? defaultStrings[key as TranslationKey];

  if (!value) return undefined;

  return interpolate(value, params);
}

/**
 * Strip the deployment `base` prefix from a pathname.
 *
 * When the site is served from a sub-path (GitHub Pages project site,
 * base = '/<repo>/'), every incoming pathname starts with that prefix, which
 * would otherwise be mistaken for a locale segment by `getLocaleFromUrl()` or
 * break route matching. Applied before any route/locale inspection.
 *
 * @example
 * ```ts
 * // base = '/qiyuan-blog-template/'
 * stripBase('/qiyuan-blog-template/en/post/a') // => '/en/post/a'
 * stripBase('/qiyuan-blog-template/')          // => '/'
 * ```
 */
export function stripBase(pathname: string): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return pathname;

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  if (pathname === normalizedBase) return '/';
  if (pathname.startsWith(`${normalizedBase}/`)) {
    return pathname.slice(normalizedBase.length);
  }
  return pathname;
}

/**
 * Extract locale from a URL pathname.
 *
 * Strategy: strip the deployment base prefix, then check if the first path
 * segment is a supported locale code. If not (or for default locale URLs
 * without prefix), return defaultLocale.
 *
 * Note: URLs with the default locale prefix (e.g., '/zh/post/hello') are treated
 * as defaultLocale — the prefix is ignored. This works with Astro's
 * `redirectToDefaultLocale: true` which redirects `/zh/` → `/`. No static pages
 * are generated for the default locale prefix, so such URLs would 404 anyway.
 *
 * @example
 * ```ts
 * getLocaleFromUrl('/en/post/hello')  // => 'en'
 * getLocaleFromUrl('/post/hello')     // => 'zh' (default)
 * getLocaleFromUrl('/en/')            // => 'en'
 * getLocaleFromUrl('/')               // => 'zh' (default)
 * getLocaleFromUrl('/zh/post/hello')  // => 'zh' (default — prefix ignored)
 * // base = '/qiyuan-blog-template/'
 * getLocaleFromUrl('/qiyuan-blog-template/en/post/hello') // => 'en'
 * ```
 */
export function getLocaleFromUrl(pathname: string): Locale {
  const segments = stripBase(pathname).split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && firstSegment !== defaultLocale && isLocaleSupported(firstSegment)) {
    return firstSegment;
  }

  return defaultLocale;
}

/**
 * Prefix a root-absolute path with Astro's configured `base`.
 *
 * Needed for two-platform deployment: the same source tree is published both at
 * a domain root (Cloudflare Pages, base = '/') and under a sub-path
 * (GitHub Pages project site, base = '/<repo>/'). Any hard-coded `/foo` asset
 * or link would 404 in the sub-path case, so route them through here.
 *
 * `import.meta.env.BASE_URL` is always normalized by Astro: either '/' or
 * '/something/'. Values already carrying the base prefix are returned as-is so
 * the helper is safe to apply to URLs that Astro (or a component) already
 * resolved — e.g. `Astro.url.pathname` in a base-prefixed build.
 *
 * @example
 * ```ts
 * // base = '/'
 * withBase('/img/a.png')            // => '/img/a.png'
 * // base = '/qiyuan-blog-template/'
 * withBase('/img/a.png')            // => '/qiyuan-blog-template/img/a.png'
 * withBase('/qiyuan-blog-template/img/a.png') // already prefixed, unchanged
 * ```
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return path;

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  // Already carries the base prefix — do not double-prefix.
  if (path === normalizedBase || path.startsWith(`${normalizedBase}/`)) {
    return path;
  }

  return path.startsWith('/') ? `${normalizedBase}${path}` : `${normalizedBase}/${path}`;
}

/**
 * Generate a locale-aware path, including the deployment base prefix.
 *
 * - Default locale: no locale prefix (e.g., '/post/hello')
 * - Other locales: prefixed (e.g., '/en/post/hello')
 * - Always additionally prefixed with `base` when the site is served from a sub-path
 *
 * @example
 * ```ts
 * // base = '/'
 * localizedPath('/post/hello', 'zh')  // => '/post/hello'
 * localizedPath('/post/hello', 'en')  // => '/en/post/hello'
 * // base = '/qiyuan-blog-template/'
 * localizedPath('/post/hello', 'zh')  // => '/qiyuan-blog-template/post/hello'
 * ```
 */
export function localizedPath(path: string, locale: Locale = defaultLocale): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const localePath = locale === defaultLocale ? normalizedPath : `/${locale}${normalizedPath}`;

  return withBase(localePath);
}

/**
 * Strip the locale prefix from a pathname, returning the locale-free path.
 * The deployment base prefix is removed first so the result is a clean
 * route path (and re-prefixed by `localizedPath` when regenerated).
 *
 * @example
 * ```ts
 * stripLocaleFromPath('/en/post/hello')  // => '/post/hello'
 * stripLocaleFromPath('/post/hello')     // => '/post/hello'
 * stripLocaleFromPath('/en')             // => '/'
 * ```
 */
export function stripLocaleFromPath(pathname: string): string {
  const segments = stripBase(pathname).split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && firstSegment !== defaultLocale && isLocaleSupported(firstSegment)) {
    const rest = segments.slice(1).join('/');
    return rest ? `/${rest}` : '/';
  }

  return stripBase(pathname);
}

/**
 * Get the alternate URL for switching to a different locale.
 * Strips the current locale prefix (and the deployment base) and applies the
 * target locale prefix, then re-applies the base — so the result is directly
 * usable as an href on whichever platform the site is served from.
 *
 * @example
 * ```ts
 * getAlternateUrl('/en/post/hello', 'zh')  // => '/post/hello'
 * getAlternateUrl('/post/hello', 'en')     // => '/en/post/hello'
 * ```
 */
export function getAlternateUrl(currentPathname: string, targetLocale: Locale): string {
  const stripped = stripLocaleFromPath(currentPathname);
  return localizedPath(stripped, targetLocale);
}

/**
 * Map short locale codes to BCP 47 language tags for the HTML `lang` attribute.
 *
 * Short codes like `zh` are valid BCP 47 but less specific. This mapping
 * provides region-specific tags for better SEO and accessibility.
 *
 * @example
 * ```ts
 * getHtmlLang('zh')  // => 'zh-CN'
 * getHtmlLang('en')  // => 'en'
 * getHtmlLang('ja')  // => 'ja'
 * ```
 */
const HTML_LANG_MAP: Record<string, string> = {
  zh: 'zh-CN',
};

export function getHtmlLang(locale: Locale): string {
  return HTML_LANG_MAP[locale] ?? locale;
}

/**
 * Resolve a navigation item's display name using its `nameKey` (translation key)
 * with fallback to the raw `name` string.
 *
 * Used by Navigator, DropdownNav, and HomeInfo to render locale-aware nav labels.
 *
 * @example
 * ```ts
 * resolveNavName('nav.home', '首页', 'en')  // => 'Home'
 * resolveNavName(undefined, '首页', 'en')   // => '首页'
 * ```
 */
export function resolveNavName(nameKey: string | undefined, fallbackName: string | undefined, locale: Locale): string {
  if (nameKey) {
    return tryTranslate(locale, nameKey) ?? fallbackName ?? '';
  }
  return fallbackName ?? '';
}
