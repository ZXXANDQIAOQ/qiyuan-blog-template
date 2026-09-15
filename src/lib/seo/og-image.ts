import { siteConfig } from '@constants/site-config';
// 直接引 utils 而非 barrel：这里只需要 withBase，
// 经 barrel 会连带拉入整套 translations 字典（体积大且与 SEO 无关）。
import { withBase } from '@/i18n/utils';

type OgImageInput =
  | string
  | {
      src?: string;
    }
  | undefined;

function normalizeImagePath(image: OgImageInput): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (typeof image === 'object' && typeof image.src === 'string') return image.src;
  return undefined;
}

/**
 * Get the OG image URL with proper fallback chain
 * Priority: cover → defaultOgImage → avatar
 *
 * @param cover - Optional post cover image path or Astro image metadata
 * @param site - Site URL for absolute URL generation
 * @returns Absolute URL string or undefined
 */
export function getOgImageUrl(cover: OgImageInput, site: URL | undefined): string | undefined {
  if (!site) return undefined;

  const imagePath = normalizeImagePath(cover) || siteConfig.defaultOgImage || siteConfig.avatar;
  if (!imagePath) return undefined;

  // 外部图片已是绝对 URL，直接返回，避免被当作站内路径改写
  if (/^https?:\/\//.test(imagePath)) return imagePath;

  // 站内图片：先补上部署 base 前缀。`site` 已包含 base，而根相对路径
  // （如 /img/a.png）在 `new URL()` 中会覆盖掉 base 的路径部分，
  // 因此必须先 withBase 再解析，否则子路径部署时 OG 图会 404。
  return new URL(withBase(imagePath), site).href;
}
