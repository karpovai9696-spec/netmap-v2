/*
 * Создание файла пользователей для netmap-v2 (без зависимостей).
 *
 *   node init-users.mjs                 — создать, если нет; вывести логины/пароли
 *   node init-users.mjs --force         — пересоздать (все сессии и пароли сбросятся)
 *
 * Пароли можно задать заранее: PASS_MIKHAIL=... PASS_EDUARD=... node init-users.mjs --force
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.USERS_FILE || path.join(ROOT, 'users.json');
const FORCE = process.argv.includes('--force');

const DEFS = [
  { login: 'mikhail', name: 'Михаил', role: 'admin', env: 'PASS_MIKHAIL' },
  { login: 'eduard', name: 'Эдуард', role: 'engineer', env: 'PASS_EDUARD' },
];

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function genPassword() {
  // 14 символов без похожих букв/цифр — удобно диктовать и вводить
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(14);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

const exists = fs.existsSync(FILE);
if (exists && !FORCE) {
  console.log(`users.json уже существует: ${FILE}`);
  console.log('Пересоздать: node init-users.mjs --force');
  process.exit(0);
}

const creds = [];
const users = DEFS.map((d) => {
  const password = process.env[d.env] || genPassword();
  const salt = crypto.randomBytes(16).toString('hex');
  creds.push({ login: d.login, name: d.name, role: d.role, password });
  return {
    login: d.login,
    name: d.name,
    role: d.role,
    salt,
    hash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
});

const tmp = FILE + '.tmp';
fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2));
fs.renameSync(tmp, FILE);
fs.chmodSync(FILE, 0o600);

console.log(`Создан ${FILE}`);
for (const c of creds) {
  console.log(`LOGIN=${c.login} PASSWORD=${c.password} ROLE=${c.role} NAME=${c.name}`);
}
