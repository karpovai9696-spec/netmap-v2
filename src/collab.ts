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
  projectTitle: string;
  planRotated?: boolean;
}

type Mode = 'loading' | 'auth' | 'online' | 'offline' | 'demo';

const TOKEN_KEY = 'netmap-v2.auth.v2';

async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(path, { cache: 'no-store', ...init });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* not json */
  }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
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
    setMode((m) => (m === 'demo' ? m : 'loading'));

    ws.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'init') {
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
      wsRef.current = null;
      setUsers([]);
      if (manualCloseRef.current) return;
      setMode((m) => (m === 'demo' ? m : 'offline'));
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => {
        if (tokenRef.current && !manualCloseRef.current) connect(tokenRef.current);
      }, 2500);
    };
    ws.onerror = () => {
      /* close сработает следом */
    };
  }, []);

  // первичная загрузка: есть ли сервер и нужно ли входить
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let cfg: any = null;
      try {
        cfg = await apiFetch('/api/config');
      } catch {
        cfg = null;
      }
      if (cancelled) return;
      if (!cfg?.authRequired) {
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
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        tokenRef.current = null;
        setMode('auth');
      }
    })();
    return () => {
      cancelled = true;
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
