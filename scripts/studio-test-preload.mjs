/**
 * 测试预加载：注册一个 ESM loader，把 @edgeone/pages-blob 重定向到内存替身。
 * 用法：node --import ./scripts/studio-test-preload.mjs scripts/studio-test-api.mjs
 * （或直接 npm run studio:test）
 */
import { writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname;
const mockUrl = pathToFileURL(join(here, 'studio-test-mock-blob.mjs')).href;
const loaderUrl = pathToFileURL(join(here, 'studio-test-loader.mjs')).href;

writeFileSync(
  join(here, 'studio-test-mock-blob.mjs'),
  `export function getStore() { return globalThis.__STUDIO_MOCK_BLOB__?.store ?? null; }
export async function listStores() { return { stores: [] }; }
export default { getStore };
`,
  'utf8',
);

writeFileSync(
  join(here, 'studio-test-loader.mjs'),
  `export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@edgeone/pages-blob') {
    return { url: ${JSON.stringify(mockUrl)}, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`,
  'utf8',
);

register(loaderUrl);
