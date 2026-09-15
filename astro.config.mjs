import fs from 'node:fs';
import path from 'node:path';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import yaml from '@rollup/plugin-yaml';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import mermaid from 'astro-mermaid';
import pagefind from './integrations/safe-pagefind.mjs';
import robotsTxt from 'astro-robots-txt';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import remarkDirective from 'remark-directive';
import remarkMath from 'remark-math';
import Sonda from 'sonda/astro';
import { loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';
import YAML from 'yaml';
import { rehypeEncryptedBlock } from './src/lib/markdown/rehype-encrypted-block.ts';
import { rehypeEncryptedPost } from './src/lib/markdown/rehype-encrypted-post.ts';
import { rehypeImagePlaceholder } from './src/lib/markdown/rehype-image-placeholder.ts';
import { rehypeShokaAttrs } from './src/lib/markdown/rehype-shoka-attrs.ts';
import { remarkEncryptedDirective } from './src/lib/markdown/remark-encrypted-directive.ts';
import { remarkLinkEmbed } from './src/lib/markdown/remark-link-embed.ts';
import { remarkIns, remarkMark } from './src/lib/markdown/remark-shoka-effects.ts';
import { remarkShokaPreprocess } from './src/lib/markdown/remark-shoka-preprocess.ts';
import { remarkShokaRuby } from './src/lib/markdown/remark-shoka-ruby.ts';
import { remarkShokaSpoiler } from './src/lib/markdown/remark-shoka-spoiler.ts';
import { shokaMetaTransformer } from './src/lib/markdown/shiki-meta-transformer.ts';

// Load YAML config directly with Node.js (before Vite plugins are available)
// This is only used in astro.config.mjs - other files use @rollup/plugin-yaml
function loadConfigForAstro() {
  const configPath = path.join(process.cwd(), 'config', 'site.yaml');
  const content = fs.readFileSync(configPath, 'utf8');
  return YAML.parse(content);
}

const yamlConfig = loadConfigForAstro();

// =============================================================================
// 部署平台适配：base 路径与站点 URL
// =============================================================================
// 本站需同时部署到两个平台，它们的路径要求不同：
//   - Cloudflare Pages：部署在域名根路径，base = '/'
//   - GitHub Pages（项目站点）：部署在子路径 /<仓库名>/ 下，base 必须带前缀
//
// 通过环境变量 SITE_BASE 切换（构建脚本会注入），默认 '/' 以便本地开发与
// Cloudflare 部署完全不受影响。
//
//   SITE_BASE=/qiyuan-blog-template/  → GitHub Pages
//   不设置                             → Cloudflare Pages / 本地
//
// 注意：Astro 的 base 必须以 '/' 开头、不以 '/' 结尾（根路径除外），
// 这里做了规范化，避免手写环境变量时出错。
// =============================================================================
const normalizeBase = (raw) => {
  if (!raw || raw === '/') return '/';
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.replace(/\/+$/, '') + '/';
};
const siteBase = normalizeBase(process.env.SITE_BASE);
// 站点 URL 也需同步：GitHub Pages 下 canonical / sitemap / RSS 都应指向 Pages 域名。
// 未显式提供 SITE_URL 时，若 base 带前缀则按 GitHub Pages 约定推导。
const siteUrl =
  process.env.SITE_URL ||
  (siteBase !== '/'
    ? `https://${(process.env.GITHUB_REPOSITORY_OWNER || 'zxxandqiaoq').toLowerCase()}.github.io${siteBase.replace(/\/$/, '')}`
    : yamlConfig.site?.url);

// Bundle analysis mode: ANALYZE=true pnpm build
// Use loadEnv to read .env file (astro.config.mjs runs before Vite loads .env)
const { ANALYZE } = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');
const isAnalyze = ANALYZE === 'true';
// Get robots.txt config from YAML, then resolve relative sitemap filenames
// to absolute https URLs — astro-robots-txt requires sitemap values to be full URLs,
// so we keep YAML readable (filenames only) and build the real URLs here.
const robotsConfigRaw = yamlConfig.seo?.robots ?? {};
// 用解析后的 siteUrl（而非 YAML 原值），子路径部署时 sitemap 才能指向正确域名。
//
// 注意：siteUrl 在 GitHub Pages 场景下**已经包含** base 路径
// （如 https://zxxandqiaoq.github.io/qiyuan-blog-template），所以这里
// 绝对不能再补一次 base，否则会拼成 .../qiyuan-blog-template/qiyuan-blog-template/sitemap-index.xml。
const siteBaseUrl = String(siteUrl ?? '').replace(/\/+$/, '');
const resolveSitemap = (val) => {
  if (Array.isArray(val)) return val.map((f) => `${siteBaseUrl}/${String(f).replace(/^\/+/, '')}`);
  if (typeof val === 'string') return `${siteBaseUrl}/${val.replace(/^\/+/, '')}`;
  return val; // boolean or undefined → let the package apply its default
};
const robotsConfig = {
  ...robotsConfigRaw,
  sitemap: resolveSitemap(robotsConfigRaw.sitemap),
};

// i18n configuration from YAML
const i18nYaml = yamlConfig.i18n;
const i18nDefaultLocale = i18nYaml?.defaultLocale ?? 'zh';
const i18nLocales = (i18nYaml?.locales ?? [{ code: 'zh' }]).map((l) => l.code);
const hasMultipleLocales = i18nLocales.length > 1;

// Build conditional plugin lists based on content config
const contentConfig = yamlConfig.content || {};

// Remark plugins — order matters
// remarkShokaPreprocess MUST be first: it re-parses raw text to fix GFM/remark conflicts
// (+++, ~sub~, {% links %} YAML etc.) before any AST-level plugin runs.
const remarkPlugins = [];
{
  const needsPreprocess =
    contentConfig.enableShokaContainers !== false ||
    contentConfig.enableShokaHexoTags !== false ||
    contentConfig.enableShokaEffects !== false;
  if (needsPreprocess) {
    remarkPlugins.push([
      remarkShokaPreprocess,
      {
        enableContainers: contentConfig.enableShokaContainers !== false,
        enableHexoTags: contentConfig.enableShokaHexoTags !== false,
        enableSuperSub: contentConfig.enableShokaEffects !== false,
        enableMath: contentConfig.enableMath !== false,
        enableEncryptedBlock: contentConfig.enableEncryptedBlock ?? false,
      },
    ]);
  }
}
// remarkMath must run BEFORE ruby/spoiler/effects so that $...$ content
// is already parsed into inlineMath/math nodes and won't be touched by text-scanning plugins.
if (contentConfig.enableMath !== false) remarkPlugins.push(remarkMath);
if (contentConfig.enableShokaSpoiler !== false) remarkPlugins.push(remarkShokaSpoiler);
if (contentConfig.enableShokaRuby !== false) remarkPlugins.push(remarkShokaRuby);
if (contentConfig.enableShokaEffects !== false) {
  remarkPlugins.push(remarkIns, remarkMark);
}
// Encrypted block: remarkDirective is registered in BOTH places —
// here for the main Astro pipeline (when remarkShokaPreprocess skips re-parse),
// and inside remarkShokaPreprocess's re-parse pipeline (when it does re-parse).
if (contentConfig.enableEncryptedBlock) {
  remarkPlugins.push(remarkDirective, remarkEncryptedDirective);
}
// Link embed is always on (existing feature)
remarkPlugins.push([
  remarkLinkEmbed,
  {
    enableLinkEmbed: contentConfig.enableLinkEmbed ?? true,
    enableTweetEmbed: contentConfig.enableTweetEmbed ?? true,
    enableOGPreview: contentConfig.enableOGPreview ?? true,
    enableCodePenEmbed: contentConfig.enableCodePenEmbed ?? true,
    previewCacheTime: contentConfig.previewCacheTime ?? 30,
  },
]);

// Rehype plugins — order matters
const rehypePlugins = [
  rehypeSlug,
  [
    rehypeAutolinkHeadings,
    {
      behavior: 'append',
      properties: {
        className: ['anchor-link'],
        ariaLabel: 'Link to this section',
      },
    },
  ],
];
if (contentConfig.enableShokaAttrs !== false) rehypePlugins.push(rehypeShokaAttrs);
rehypePlugins.push(rehypeImagePlaceholder);
if (contentConfig.enableMath !== false) rehypePlugins.push(rehypeKatex);
// Encrypted block/post MUST be last rehype plugins — encrypt fully-rendered children
if (contentConfig.enableEncryptedBlock) {
  rehypePlugins.push(rehypeEncryptedBlock);
  rehypePlugins.push(rehypeEncryptedPost);
}

// Shiki transformers
const shikiTransformers = [];
if (contentConfig.enableCodeMeta !== false) shikiTransformers.push(shokaMetaTransformer());

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  base: siteBase,
  compressHTML: true,
  redirects: {
    '/blog/[...slug]': '/post/[...slug]',
  },
  markdown: {
    // Enable GitHub Flavored Markdown
    gfm: true,
    remarkPlugins,
    rehypePlugins,
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['mermaid'],
    },
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      transformers: shikiTransformers,
    },
  },
  integrations: [
    react(),
    sitemap(),
    icon({
      include: {
        gg: ['*'],
        'fa6-regular': ['*'],
        'fa6-solid': ['*'],
        ri: ['*'],
      },
    }),
    pagefind(),
    mermaid({
      autoTheme: true,
    }),
    robotsTxt(robotsConfig || {}),
    ...(isAnalyze ? [Sonda()] : []),
  ],
  devToolbar: {
    enabled: true,
  },
  vite: {
    build: {
      // Enable sourcemap for Sonda bundle analysis
      sourcemap: isAnalyze,
    },
    plugins: [yaml(), svgr(), tailwindcss()],
    ssr: {
      noExternal: ['react-tweet'],
    },
    optimizeDeps: {
      include: ['@antv/infographic'],
    },
  },
  // Only enable Astro i18n routing when multiple locales are configured.
  // Single-locale sites skip this entirely — no /[lang]/ routes are generated.
  ...(hasMultipleLocales && {
    i18n: {
      defaultLocale: i18nDefaultLocale,
      locales: i18nLocales,
      routing: {
        prefixDefaultLocale: false,
        redirectToDefaultLocale: true,
      },
    },
  }),
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  trailingSlash: 'ignore',
});
