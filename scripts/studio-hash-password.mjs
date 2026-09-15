#!/usr/bin/env node
/**
 * 生成管理员口令哈希
 *
 * 用法：
 *   node scripts/studio-hash-password.mjs '你的密码'
 *
 * 输出的字符串填到 EdgeOne 控制台的 STUDIO_PASSWORD_HASH 环境变量。
 * 口令明文不会写入任何文件，也不会出现在仓库里。
 *
 * 与 edge-functions/api/studio.js 中的 verifyPassword() 使用同一套参数
 * （PBKDF2-SHA256 / 100000 次迭代 / 16 字节随机 salt），两边必须保持一致。
 */

import { pbkdf2Sync, randomBytes } from 'node:crypto';

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

const password = process.argv[2];

if (!password) {
  console.error("用法：node scripts/studio-hash-password.mjs '你的密码'");
  process.exit(1);
}

if (password.length < 8) {
  console.error('密码太短了，建议至少 8 位。');
  process.exit(1);
}

const salt = randomBytes(SALT_BYTES);
const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, 'sha256');

const value = `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;

console.log('');
console.log('把下面这一整行填到 EdgeOne 控制台的 STUDIO_PASSWORD_HASH：');
console.log('');
console.log(value);
console.log('');
console.log('另外记得生成一个会话密钥，同样填到控制台：');
console.log(`STUDIO_SESSION_SECRET=${randomBytes(32).toString('base64url')}`);
console.log('');
