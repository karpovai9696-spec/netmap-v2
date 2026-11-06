/*
 * netmap-v2 server: статика + авторизация + роли + WebSocket real-time.
 * Зависимостей нет (только встроенный Node.js >= 18).
 *
 * Переменные окружения:
 *   PORT      — порт (по умолчанию 8092)
 *   DIST      — каталог собранного фронтенда (dist)
 *   DATA_DIR  — каталог users.json / project.json (по умолчанию рядом со скриптом)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8092);
const DIST = process.env.DIST || path.join(ROOT, '..', 'netmap-v2', 'dist');
const DATA_DIR = process.env.DATA_DIR || ROOT;
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROJECT_FILE = path.join(DATA_DIR, 'project.json');
const SESSION_FILE = path.join(DATA_DIR, 'sessions.json');
const DOCS_FILE = path.join(DATA_DIR, 'docs.json');
const PLAN_WALLS_FILE = path.join(DATA_DIR, 'walls.json');
const SESSION_TTL = 72 * 3600 * 1000; // 72 часа
const MAX_OPS_PER_SECOND = 60;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

// ------------------------------- пользователи -------------------------------
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function loadUsers() {
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

function findUser(login) {
  return loadUsers().find((u) => u.login.toLowerCase() === String(login).toLowerCase());
}

function checkPassword(user, password) {
  const hash = hashPassword(password, user.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(user.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function saveUsers(users) {
  const tmp = USERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2));
  fs.renameSync(tmp, USERS_FILE);
}

// ------------------------------- проект --------------------------------------
const EMPTY_PROJECT = () => ({
  version: 2,
  nodes: [],
  cables: [],
  walls: [],
  notes: [],
  openings: [],
  projectTitle: 'Карта сети — 1 этаж (Козина 7, пом. 1080 + 1079)',
  planRotated: false,
  updatedAt: new Date().toISOString(),
});

let project = EMPTY_PROJECT();
try {
  const saved = JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf8'));
  if (saved && Array.isArray(saved.nodes) && Array.isArray(saved.walls)) {
    project = saved;
    if (!Array.isArray(project.openings)) project.openings = [];
  }
} catch {
  /* первый запуск */
}

function loadDocs() {
  try {
    return JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

// актуальные стены плана (обновляются при деплое; заменяют старую модель)
try {
  const planWalls = JSON.parse(fs.readFileSync(PLAN_WALLS_FILE, 'utf8'));
  if (Array.isArray(planWalls) && planWalls.length) {
    project.walls = planWalls;
    project.planRotated = false;
    if (Array.isArray(project.openings)) {
      const wallIds = new Set(planWalls.map((w) => w.id));
      project.openings = project.openings.filter((o) => o && wallIds.has(o.wallId));
    }
    project.updatedAt = new Date().toISOString();
  }
} catch {
  /* нет файла — оставляем стены из project.json */
}

let saveTimer = null;
function persistProject() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = PROJECT_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(project, null, 1));
      fs.renameSync(tmp, PROJECT_FILE);
    } catch (e) {
      console.error('project save failed:', e.message);
    }
  }, 250);
}

// ------------------------------- права ---------------------------------------
const ROLE_LABEL = { admin: 'Системный администратор', engineer: 'Инженер по строительным сооружениям' };
const ENGINEER_KINDS = new Set([
  'wall.add',
  'wall.update',
  'wall.delete',
  'opening.add',
  'opening.update',
  'opening.delete',
  'note.add',
  'note.update',
  'note.delete',
  'title.update',
  'planRotated.update',
]);

function canApply(user, op) {
  if (!op || typeof op.kind !== 'string') return false;
  if (user.role === 'admin') return true;
  return ENGINEER_KINDS.has(op.kind);
}

// ------------------------------- сессии --------------------------------------
const sessions = new Map(); // token -> { login, expires }
const loginAttempts = new Map(); // ip -> { count, first }

let sessionSaveTimer = null;
function persistSessions() {
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(() => {
    try {
      const now = Date.now();
      const obj = {};
      for (const [token, s] of sessions) {
        if (s && s.expires > now) obj[token] = s;
      }
      const tmp = SESSION_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(obj));
      fs.chmodSync(tmp, 0o600);
      fs.renameSync(tmp, SESSION_FILE);
    } catch (e) {
      console.error('sessions save failed:', e.message);
    }
  }, 150);
}

function loadSessions() {
  try {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    const now = Date.now();
    let count = 0;
    for (const [token, s] of Object.entries(data)) {
      if (s && s.expires > now && findUser(s.login)) {
        sessions.set(token, s);
        count += 1;
      }
    }
    if (count) console.log(`[netmap-v2] sessions restored: ${count}`);
  } catch {
    /* первый запуск или файла нет */
  }
}
loadSessions();

function newSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { login: user.login, expires: Date.now() + SESSION_TTL });
  persistSessions();
  return token;
}

function sessionUser(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const s = token && sessions.get(token);
  if (!s || s.expires < Date.now()) {
    if (token) {
      sessions.delete(token);
      persistSessions();
    }
    return null;
  }
  return findUser(s.login) || null;
}

function publicUser(u) {
  return { login: u.login, name: u.name, role: u.role, roleLabel: ROLE_LABEL[u.role] || u.role };
}

// ------------------------------- HTTP ----------------------------------------
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400);
    res.end('bad url');
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(DIST, urlPath));
  if (!filePath.startsWith(path.normalize(DIST))) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // SPA fallback
      const index = path.join(DIST, 'index.html');
      fs.readFile(index, (e2, data) => {
        if (e2) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(data);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    headers['Cache-Control'] = ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}

// ------------------------------- WebSocket -----------------------------------
const clients = new Set(); // { socket, user, color, cursor, lastOpTime }

function wsAccept(key) {
  return crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
}

function encodeFrame(str, opcode = 1) {
  const payload = Buffer.from(str);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function send(wsClient, obj) {
  try {
    wsClient.socket.write(encodeFrame(JSON.stringify(obj)));
  } catch {
    /* сокет уже закрыт */
  }
}

function broadcast(obj, except) {
  for (const c of clients) if (c !== except) send(c, obj);
}

const PRESENCE_COLORS = ['#FCD116', '#34D399', '#A78BFA', '#FB923C', '#FB7185', '#38BDF8'];

function presenceList() {
  return [...clients].map((c) => ({
    login: c.user.login,
    name: c.user.name,
    role: c.user.role,
    color: c.color,
    cursor: c.cursor || null,
  }));
}

function broadcastPresence() {
  broadcast({ type: 'presence', users: presenceList() });
}

function applyOps(user, ops) {
  const applied = [];
  for (const op of ops) {
    if (!canApply(user, op)) continue;
    const ok = applyOne(op);
    if (ok) applied.push(op);
  }
  if (applied.length) {
    project.updatedAt = new Date().toISOString();
    persistProject();
  }
  return applied;
}

function arr(name) {
  if (!Array.isArray(project[name])) project[name] = [];
  return project[name];
}

function upsert(list, id, patch, create) {
  const idx = list.findIndex((x) => x && x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch, id };
    return true;
  }
  if (create) {
    list.push({ id, ...patch });
    return true;
  }
  return false;
}

function applyOne(op) {
  const { kind } = op;
  const [entity, action] = kind.split('.');
  if (entity === 'title' && action === 'update') {
    project.projectTitle = String(op.value || '').slice(0, 300);
    return true;
  }
  if (entity === 'planRotated' && action === 'update') {
    project.planRotated = !!op.value;
    return true;
  }
  const list = arr(
    entity === 'node'
      ? 'nodes'
      : entity === 'cable'
      ? 'cables'
      : entity === 'wall'
      ? 'walls'
      : entity === 'note'
      ? 'notes'
      : entity === 'opening'
      ? 'openings'
      : ''
  );
  if (!list) return false;

  if (action === 'add' && op.item?.id) {
    if (!list.some((x) => x.id === op.item.id)) list.push(op.item);
    return true;
  }
  if (action === 'update' && op.id) {
    return upsert(list, op.id, op.patch || {}, false);
  }
  if (action === 'delete' && op.id) {
    const i = list.findIndex((x) => x && x.id === op.id);
    if (i >= 0) list.splice(i, 1);
    return true;
  }
  if (action === 'replace-all' && Array.isArray(op.items)) {
    project[
      entity === 'node'
        ? 'nodes'
        : entity === 'cable'
        ? 'cables'
        : entity === 'wall'
        ? 'walls'
        : entity === 'opening'
        ? 'openings'
        : 'notes'
    ] = op.items;
    return true;
  }
  return false;
}

function handleWsConnection(req, socket) {
  const url = new URL(req.url, 'http://x');
  const token = url.searchParams.get('token') || '';
  const s = sessions.get(token);
  if (!s || s.expires < Date.now()) {
    socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return;
  }
  const user = findUser(s.login);
  if (!user) {
    socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return;
  }

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${wsAccept(req.headers['sec-websocket-key'])}\r\n\r\n`
  );
  socket.setNoDelay(true);

  const wsClient = {
    socket,
    user,
    color: PRESENCE_COLORS[clients.size % PRESENCE_COLORS.length],
    cursor: null,
    lastOpTime: 0,
    opBudget: MAX_OPS_PER_SECOND,
  };
  clients.add(wsClient);

  send(wsClient, {
    type: 'init',
    project,
    you: publicUser(user),
    users: presenceList(),
    empty: !(project.walls?.length || project.nodes?.length),
  });
  broadcastPresence();

  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const b0 = buffer[0];
      const b1 = buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (buffer.length < 4) return;
        len = buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (buffer.length < 10) return;
        len = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      const maskLen = masked ? 4 : 0;
      if (buffer.length < offset + maskLen + len) return;
      let payload = buffer.subarray(offset + maskLen, offset + maskLen + len);
      if (masked) {
        const mask = buffer.subarray(offset, offset + 4);
        const out = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
        payload = out;
      }
      buffer = buffer.subarray(offset + maskLen + len);

      if (opcode === 8) {
        try {
          socket.end();
        } catch {}
        return;
      }
      if (opcode === 9) {
        socket.write(encodeFrame('', 10));
        continue;
      }
      if (opcode === 10) continue;
      if (opcode === 1 || opcode === 0) {
        if (!fin) continue; // фрагментация не используется клиентом
        let msg;
        try {
          msg = JSON.parse(payload.toString('utf8'));
        } catch {
          continue;
        }
        handleWsMessage(wsClient, msg);
      }
    }
  });

  const cleanup = () => {
    if (!clients.has(wsClient)) return;
    clients.delete(wsClient);
    broadcastPresence();
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
  socket.on('end', cleanup);
}

function handleWsMessage(wsClient, msg) {
  const { user } = wsClient;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'cursor') {
    const x = Number(msg.x);
    const y = Number(msg.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      wsClient.cursor = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
      broadcast({ type: 'presence', users: presenceList() }, wsClient);
    }
    return;
  }

  if (msg.type === 'reset') {
    if (user.role !== 'admin') {
      send(wsClient, { type: 'error', message: 'Сброс проекта доступен только администратору' });
      return;
    }
    const p = msg.project || {};
    project = {
      version: 2,
      nodes: Array.isArray(p.nodes) ? p.nodes : [],
      cables: Array.isArray(p.cables) ? p.cables : [],
      walls: Array.isArray(p.walls) ? p.walls : [],
      notes: Array.isArray(p.notes) ? p.notes : [],
      openings: Array.isArray(p.openings) ? p.openings : [],
      projectTitle: String(p.projectTitle || EMPTY_PROJECT().projectTitle),
      planRotated: !!p.planRotated,
      updatedAt: new Date().toISOString(),
    };
    persistProject();
    broadcast({ type: 'reset', project, from: publicUser(user) });
    broadcastPresence();
    return;
  }

  if (msg.type === 'ops' && Array.isArray(msg.ops)) {
    const now = Date.now();
    if (now - wsClient.lastOpTime > 1000) {
      wsClient.lastOpTime = now;
      wsClient.opBudget = MAX_OPS_PER_SECOND;
    }
    if (msg.ops.length > wsClient.opBudget) {
      send(wsClient, { type: 'error', message: 'Слишком много изменений, подождите секунду' });
      return;
    }
    wsClient.opBudget -= msg.ops.length;

    const applied = applyOps(user, msg.ops);
    if (applied.length) {
      broadcast({ type: 'ops', from: publicUser(user), ops: applied, at: new Date().toISOString() }, wsClient);
    }
    return;
  }
}

// ------------------------------- роутер --------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  try {
    if (p === '/api/config' && req.method === 'GET') {
      return json(res, 200, { authRequired: true, app: 'netmap-v2', version: 2 });
    }

    if (p === '/api/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      let att = loginAttempts.get(ip);
      if (!att || now - att.first > 10 * 60 * 1000) {
        att = { count: 0, first: now };
        loginAttempts.set(ip, att);
      }
      if (att.count >= 12) return json(res, 429, { error: 'Слишком много попыток входа. Подождите 10 минут.' });

      const body = await readBody(req);
      const login = String(body.login || '').trim();
      const password = String(body.password || '');
      if (!login || !password) return json(res, 400, { error: 'Укажите логин и пароль' });

      const user = findUser(login);
      if (!user || !checkPassword(user, password)) {
        att.count += 1;
        return json(res, 401, { error: 'Неверный логин или пароль' });
      }
      const token = newSession(user);
      return json(res, 200, { token, user: publicUser(user) });
    }

    if (p === '/api/me' && req.method === 'GET') {
      const user = sessionUser(req);
      if (!user) return json(res, 401, { error: 'Требуется вход' });
      return json(res, 200, { user: publicUser(user) });
    }

    if (p === '/api/project' && req.method === 'GET') {
      const user = sessionUser(req);
      if (!user) return json(res, 401, { error: 'Требуется вход' });
      return json(res, 200, { project, user: publicUser(user) });
    }

    if (p === '/api/password' && req.method === 'POST') {
      const user = sessionUser(req);
      if (!user) return json(res, 401, { error: 'Требуется вход' });
      const body = await readBody(req);
      const oldPassword = String(body.oldPassword || '');
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 8) return json(res, 400, { error: 'Новый пароль — не короче 8 символов' });
      if (!checkPassword(user, oldPassword)) return json(res, 403, { error: 'Текущий пароль неверен' });
      const users = loadUsers();
      const idx = users.findIndex((u) => u.login.toLowerCase() === user.login.toLowerCase());
      if (idx < 0) return json(res, 404, { error: 'Пользователь не найден' });
      const salt = crypto.randomBytes(16).toString('hex');
      users[idx] = { ...users[idx], salt, hash: hashPassword(newPassword, salt), passwordChangedAt: new Date().toISOString() };
      saveUsers(users);
      // инвалидируем все сессии пользователя
      for (const [tok, s] of sessions) if (s.login.toLowerCase() === user.login.toLowerCase()) sessions.delete(tok);
      persistSessions();
      return json(res, 200, { ok: true });
    }

    if (p === '/api/docs' && req.method === 'GET') {
      const user = sessionUser(req);
      if (!user) return json(res, 401, { error: 'Требуется вход' });
      const docs = loadDocs();
      if (!docs) return json(res, 404, { error: 'Документация не найдена' });
      return json(res, 200, { documentation: docs.documentation || docs });
    }

    if (p === '/api/net-objects' && req.method === 'POST') {
      const user = sessionUser(req);
      if (!user) return json(res, 401, { error: 'Требуется вход' });
      if (user.role !== 'admin') return json(res, 403, { error: 'Доступно только администратору' });
      const docs = loadDocs();
      if (!docs) return json(res, 404, { error: 'Документация не найдена' });

      const added = { nodes: 0, cables: 0, notes: 0 };
      const addMissing = (listName, items) => {
        const list = arr(listName);
        let n = 0;
        for (const item of Array.isArray(items) ? items : []) {
          if (!item || !item.id) continue;
          if (!list.some((x) => x && x.id === item.id)) {
            list.push(item);
            n += 1;
          }
        }
        return n;
      };
      added.nodes = addMissing('nodes', docs.planNodes);
      added.cables = addMissing('cables', docs.planCables);
      added.notes = addMissing('notes', docs.planNotes);

      const total = added.nodes + added.cables + added.notes;
      if (total > 0) {
        project.updatedAt = new Date().toISOString();
        persistProject();
        broadcast({ type: 'reset', project, from: publicUser(user) });
      }
      return json(res, 200, { ok: true, added, total });
    }

    if (p === '/ws') {
      return; // обрабатывается в 'upgrade'
    }

    if (p.startsWith('/api/')) return json(res, 404, { error: 'not found' });

    return serveStatic(req, res);
  } catch (e) {
    console.error('http error:', e);
    if (!res.headersSent) json(res, 500, { error: 'Внутренняя ошибка сервера' });
  }
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  handleWsConnection(req, socket);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[netmap-v2] listening on http://0.0.0.0:${PORT}`);
  console.log(`[netmap-v2] static: ${DIST}`);
  console.log(`[netmap-v2] users: ${USERS_FILE}`);
  if (!fs.existsSync(USERS_FILE)) console.warn('[netmap-v2] ВНИМАНИЕ: users.json отсутствует — создайте пользователей (init-users.mjs)');
});
