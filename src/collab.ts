import { useCallback, useEffect, useRef, useState } from 'react';

export type Role = 'admin' | 'engineer';

export interface User {
  login: string;
  name: string;
  role: Role;
  roleLabel?: string;
}

export interface PresenceUser extends User {
  color: string;
  cursor: { x: number; y: number } | null;
}

export interface Op {
  kind: string;
  [key: string]: any;
}

export interface SharedProject {
  version?: number;
  nodes: any[];
  cables: any[];
  walls: any[];
  notes: any[];
  openings?: any[];
  projectTitle: string;
  planRotated?: boolean;
}

type Mode = 'loading' | 'auth' | 'online' | 'offline' | 'demo';

const TOKEN_KEY = 'netmap-v2.auth.v2';
const SERVER_EXPECTED = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);

async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(path, { cache: 'no-store', ...init });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* not json */
  }
  if (!res.ok) {
    const failure: any = new Error(data?.error || `HTTP ${res.status}`);
    failure.status = res.status;
    throw failure;
  }
  return data;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function useCollab(opts: {
  onInit: (project: SharedProject, me: User, empty: boolean) => void;
  onOps: (from: User, ops: Op[], at: string) => void;
  onReset: (project: SharedProject, from: User) => void;
  onToast: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(localStorage.getItem(TOKEN_KEY));
  const manualCloseRef = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const lastMessageRef = useRef(Date.now());
  const attemptsRef = useRef(0);

  const connect = useCallback((token: string) => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    manualCloseRef.current = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
    } catch (e: any) {
      setError('Не удалось подключиться к серверу');
      return;
    }
    wsRef.current = ws;
    lastMessageRef.current = Date.now();
    // при реконнекте не сбрасываем экран в полноэкранную загрузку
    setMode((m) => (m === 'demo' ? m : initializedRef.current ? 'offline' : 'loading'));

    ws.onopen = () => {
      attemptsRef.current = 0;
      lastMessageRef.current = Date.now();
    };

    // heartbeat: если сервер не отвечает дольше 45 с — соединение считается мёртвым
    const heartbeat = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - lastMessageRef.current > 20000) {
        try { ws.close(); } catch { /* ignore */ }
        return;
      }
      try {
        ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
      } catch {
        try { ws.close(); } catch { /* ignore */ }
      }
    }, 8000);

    ws.onmessage = (ev) => {
      lastMessageRef.current = Date.now();
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'init') {
        initializedRef.current = true;
        setUser(msg.you);
        setUsers(Array.isArray(msg.users) ? msg.users : []);
        setMode('online');
        setError('');
        optsRef.current.onInit(msg.project, msg.you, !!msg.empty);
      } else if (msg.type === 'presence') {
        setUsers(Array.isArray(msg.users) ? msg.users : []);
      } else if (msg.type === 'ops') {
        if (msg.from) {
          setUser((me) => (me && me.login === msg.from.login ? me : me));
          setMode('online');
          optsRef.current.onOps(msg.from, msg.ops || [], msg.at || new Date().toISOString());
        }
      } else if (msg.type === 'reset') {
        if (msg.project) optsRef.current.onReset(msg.project, msg.from || { login: '', name: '', role: 'admin' });
      } else if (msg.type === 'error') {
        optsRef.current.onToast(msg.message || 'Ошибка синхронизации');
      }
    };

    ws.onclose = () => {
      clearInterval(heartbeat);
      wsRef.current = null;
      setUsers([]);
      if (manualCloseRef.current) return;
      setMode((m) => (m === 'demo' ? m : 'offline'));
      if (retryRef.current) clearTimeout(retryRef.current);

      // реконнект планируем сразу (с backoff), не дожидаясь проверки токена
      const delay = Math.min(8000, 1200 * Math.pow(2, Math.min(attemptsRef.current, 3)));
      attemptsRef.current += 1;
      retryRef.current = setTimeout(() => {
        if (tokenRef.current && !manualCloseRef.current) connect(tokenRef.current);
      }, delay);

      // параллельно проверяем, не истёк ли токен (с таймаутом, чтобы не висеть)
      const token = tokenRef.current;
      if (!token) return;
      const checkAuth = async () => {
        try {
          const init: RequestInit = { headers: authHeader(token) };
          if (typeof AbortSignal !== 'undefined' && (AbortSignal as any).timeout) {
            init.signal = (AbortSignal as any).timeout(5000);
          }
          await apiFetch('/api/me', init);
        } catch (e: any) {
          if (e?.status === 401) {
            if (retryRef.current) clearTimeout(retryRef.current);
            localStorage.removeItem(TOKEN_KEY);
            tokenRef.current = null;
            initializedRef.current = false;
            setUser(null);
            setUsers([]);
            setMode('auth');
          }
        }
      };
      void checkAuth();
    };
    ws.onerror = () => {
      /* close сработает следом */
    };
  }, []);

  // при возврате вкладки/сети проверяем соединение и переподключаемся без ожидания
  useEffect(() => {
    const reconnectNow = () => {
      if (!tokenRef.current || manualCloseRef.current) return;
      const ws = wsRef.current;
      const stale = Date.now() - lastMessageRef.current > 20000;
      if (!ws || ws.readyState !== WebSocket.OPEN || stale) {
        if (retryRef.current) clearTimeout(retryRef.current);
        try { ws?.close(); } catch { /* ignore */ }
        connect(tokenRef.current);
      }
    };
    const onOnline = () => reconnectNow();
    const onOffline = () => {
      if (manualCloseRef.current) return;
      setMode((m) => (m === 'demo' ? m : 'offline'));
      try { wsRef.current?.close(); } catch { /* ignore */ }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') reconnectNow();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [connect]);

  // первичная загрузка: есть ли сервер и нужно ли входить (с ретраями, без ложного демо)
  useEffect(() => {
    let cancelled = false;
    let bootTimer: ReturnType<typeof setTimeout> | null = null;

    const boot = async () => {
      let cfg: any = null;
      try {
        cfg = await apiFetch('/api/config');
      } catch {
        cfg = null;
      }
      if (cancelled) return;

      if (!cfg?.authRequired) {
        if (cfg === null && SERVER_EXPECTED) {
          // наш сервер временно недоступен — не уходим в демо-режим
          setMode('offline');
          bootTimer = setTimeout(boot, 3000);
          return;
        }
        setMode('demo');
        return;
      }

      const token = tokenRef.current;
      if (!token) {
        setMode('auth');
        return;
      }
      try {
        const me = await apiFetch('/api/me', { headers: authHeader(token) });
        if (cancelled) return;
        setUser(me.user);
        connect(token);
      } catch (e: any) {
        if (cancelled) return;
        if (e?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          tokenRef.current = null;
          setMode('auth');
        } else {
          setMode('offline');
          bootTimer = setTimeout(boot, 3000);
        }
      }
    };

    boot();
    return () => {
      cancelled = true;
      if (bootTimer) clearTimeout(bootTimer);
    };
  }, [connect]);

  const login = useCallback(async (loginName: string, password: string) => {
    setBusy(true);
    setError('');
    try {
      const data = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginName, password }),
      });
      tokenRef.current = data.token;
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      connect(data.token);
    } catch (e: any) {
      setError(e.message || 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  }, [connect]);

  const logout = useCallback(() => {
    manualCloseRef.current = true;
    if (retryRef.current) clearTimeout(retryRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    tokenRef.current = null;
    initializedRef.current = false;
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setUsers([]);
    setMode('auth');
  }, []);

  const sendOps = useCallback((ops: Op[]) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !ops.length) return;
    ws.send(JSON.stringify({ type: 'ops', ops }));
  }, []);

  const sendCursor = useCallback((x: number, y: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'cursor', x, y }));
  }, []);

  const resetProject = useCallback((project: SharedProject) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'reset', project }));
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!tokenRef.current) throw new Error('Нет активной сессии');
    await apiFetch('/api/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(tokenRef.current) },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    return true;
  }, []);

  return {
    mode,
    user,
    users,
    error,
    busy,
    login,
    logout,
    sendOps,
    sendCursor,
    resetProject,
    changePassword,
    setError,
  };
}

/** Сравнение двух срезов проекта и построение операций для сервера. */
export function diffOps(
  prev: SharedProject,
  next: SharedProject
): Op[] {
  const ops: Op[] = [];
  const ents: [string, any[], any[]][] = [
    ['node', prev.nodes || [], next.nodes || []],
    ['cable', prev.cables || [], next.cables || []],
    ['wall', prev.walls || [], next.walls || []],
    ['note', prev.notes || [], next.notes || []],
    ['opening', prev.openings || [], next.openings || []],
  ];
  for (const [entity, a, b] of ents) {
    const am = new Map<any, any>(a.map((x) => [x.id, x]));
    const bm = new Map<any, any>(b.map((x) => [x.id, x]));
    for (const [id, item] of bm) {
      const old = am.get(id);
      if (!old) ops.push({ kind: `${entity}.add`, item });
      else if (JSON.stringify(old) !== JSON.stringify(item)) ops.push({ kind: `${entity}.update`, id, patch: item });
    }
    for (const id of am.keys()) if (!bm.has(id)) ops.push({ kind: `${entity}.delete`, id });
  }
  if ((prev.projectTitle || '') !== (next.projectTitle || '')) {
    ops.push({ kind: 'title.update', value: next.projectTitle || '' });
  }
  if (!!prev.planRotated !== !!next.planRotated) {
    ops.push({ kind: 'planRotated.update', value: !!next.planRotated });
  }
  return ops;
}
