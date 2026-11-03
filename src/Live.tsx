import React, { useState } from 'react';
import { Lock, LogIn, LogOut, Shield, User as UserIcon, Wrench, KeyRound, X, Radio } from 'lucide-react';
import type { PresenceUser, User } from './collab';

// ------------------------------ вход ----------------------------------------
export function LoginScreen({
  onLogin,
  error,
  busy,
  hint,
}: {
  onLogin: (login: string, password: string) => void;
  error: string;
  busy: boolean;
  hint?: string;
}) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login.trim() && password) onLogin(login.trim(), password);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-cyber-bg text-cyber-text flex items-center justify-center relative dot-grid">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(252,209,22,0.10),transparent_55%)] pointer-events-none" />

      <div className="relative w-[400px] max-w-[92vw] rounded-2xl border border-ink-800 bg-cyber-card/90 backdrop-blur p-7 shadow-glow">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl border border-primary/70 bg-primary/10 flex items-center justify-center glow-primary">
            <span className="font-display font-black text-primary text-2xl leading-none">K</span>
          </div>
          <div>
            <div className="font-display font-extrabold tracking-tight text-lg leading-tight">КАРТА СЕТИ</div>
            <div className="eyebrow">Козина 7 · пом. 1080 + 1079</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold mb-1">
          <Lock className="w-4 h-4 text-primary" /> Вход в систему
        </div>
        <p className="text-xs text-ink-300 mb-5">
          Общий проект с редактированием в реальном времени. Доступ — только для администратора и инженера.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="eyebrow block mb-1">Логин</span>
            <input
              autoFocus
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-cyber-bg border border-ink-800 focus:border-primary/70 outline-none text-sm placeholder:text-ink-500"
              placeholder="mikhail"
              autoComplete="username"
            />
          </label>

          <label className="block">
            <span className="eyebrow block mb-1">Пароль</span>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-16 rounded-xl bg-cyber-bg border border-ink-800 focus:border-primary/70 outline-none text-sm"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase px-2 py-1 rounded-lg border border-ink-800 text-ink-300 hover:text-primary hover:border-primary/50 transition"
              >
                {showPass ? 'скрыть' : 'показать'}
              </button>
            </div>
          </label>

          {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-ink-950 font-semibold text-sm transition"
          >
            <LogIn className="w-4 h-4" />
            {busy ? 'Проверяем…' : 'Войти'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-ink-800 space-y-2">
          <div className="eyebrow">Доступ по ролям</div>
          <div className="flex items-center gap-2 text-xs text-ink-300">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span><b className="text-cyber-text">mikhail</b> — сисадмин: вся схема</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-300">
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span><b className="text-cyber-text">eduard</b> — инженер: стены и пометки</span>
          </div>
          {hint && <div className="text-[11px] text-ink-500 pt-1">{hint}</div>}
        </div>
      </div>

      <div className="absolute bottom-5 text-[11px] text-ink-500 font-mono">
        netmap-v2 · real-time collaboration
      </div>
    </div>
  );
}

// --------------------------- бейдж пользователя ------------------------------
export function OnlineBadge({
  mode,
  user,
  users,
  onLogout,
  onChangePassword,
}: {
  mode: string;
  user: User | null;
  users: PresenceUser[];
  onLogout: () => void;
  onChangePassword: () => void;
}) {
  const [open, setOpen] = useState(false);
  const others = users.filter((u) => u.login !== user?.login);
  const online = mode === 'online';

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  if (!user) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full border border-ink-800 text-ink-300">
        <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-ink-500'}`} />
        {online ? 'Демо-режим' : 'Офлайн'}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl border border-ink-800 hover:border-primary/40 bg-cyber-card transition"
        title="Состояние синхронизации и участники"
      >
        <span className="flex -space-x-1.5">
          {users.slice(0, 3).map((u) => (
            <span
              key={u.login}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-ink-950 border-2 border-cyber-card"
              style={{ backgroundColor: u.color }}
              title={`${u.name} — ${u.roleLabel || u.role}`}
            >
              {initials(u.name)}
            </span>
          ))}
          {users.length === 0 && (
            <span className="w-5 h-5 rounded-full bg-ink-800 border-2 border-cyber-card flex items-center justify-center">
              <UserIcon className="w-3 h-3 text-ink-400" />
            </span>
          )}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[11px] font-semibold text-cyber-text max-w-28 truncate">{user.name}</span>
          <span className="text-[9px] font-mono uppercase tracking-wider text-ink-400">
            {user.role === 'admin' ? 'администратор' : 'инженер'}
          </span>
        </span>
        <span
          className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : mode === 'offline' ? 'bg-rose-400' : 'bg-amber-400'}`}
          title={online ? 'На связи' : mode === 'offline' ? 'Нет связи с сервером' : 'Подключение…'}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-ink-800 bg-cyber-card shadow-xl z-50 p-2 text-xs">
            <div className="px-2 py-1.5 flex items-center gap-2 justify-between">
              <span className="eyebrow">Сейчас работают</span>
              <span className={`text-[10px] font-mono ${online ? 'text-emerald-400' : 'text-ink-400'}`}>
                {online ? `${users.length} в сети` : mode === 'offline' ? 'нет связи' : 'подключение'}
              </span>
            </div>
            {users.map((u) => (
              <div key={u.login} className="px-2 py-1.5 rounded-lg flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-ink-950"
                  style={{ backgroundColor: u.color }}
                >
                  {initials(u.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{u.name}</div>
                  <div className="text-[10px] text-ink-400 truncate">{u.roleLabel || u.role}</div>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
            ))}
            {others.length === 0 && <div className="px-2 py-1 text-[10px] text-ink-400">Пока только вы</div>}
            <div className="my-1 border-t border-ink-800" />
            <button
              onClick={() => {
                setOpen(false);
                onChangePassword();
              }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-ink-800/60 text-left"
            >
              <KeyRound className="w-3.5 h-3.5 text-primary" /> Сменить пароль
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-rose-500/10 text-rose-300 text-left"
            >
              <LogOut className="w-3.5 h-3.5" /> Выйти
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------- смена пароля -----------------------------------
export function PasswordDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (oldPassword: string, newPassword: string) => Promise<any>;
}) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (newPass.length < 8) return setErr('Новый пароль — не короче 8 символов');
    if (newPass !== confirm) return setErr('Пароли не совпадают');
    setBusy(true);
    try {
      await onSave(oldPass, newPass);
      setDone(true);
    } catch (e: any) {
      setErr(e.message || 'Не удалось сменить пароль');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="w-[360px] max-w-[92vw] rounded-2xl border border-ink-800 bg-cyber-card p-5 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-display font-bold text-sm">
            <KeyRound className="w-4 h-4 text-primary" /> Смена пароля
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-ink-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="space-y-3 text-xs">
            <div className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
              Пароль изменён. Все сессии завершены — войдите заново.
            </div>
            <button onClick={onClose} className="w-full py-2 rounded-xl bg-primary text-ink-950 font-semibold">
              Понятно
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-2.5 text-xs">
            <div>
              <div className="eyebrow mb-1">Текущий пароль</div>
              <input
                type="password"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-cyber-bg border border-ink-800 focus:border-primary/70 outline-none"
              />
            </div>
            <div>
              <div className="eyebrow mb-1">Новый пароль (мин. 8 символов)</div>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-cyber-bg border border-ink-800 focus:border-primary/70 outline-none"
              />
            </div>
            <div>
              <div className="eyebrow mb-1">Повтор нового пароля</div>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-cyber-bg border border-ink-800 focus:border-primary/70 outline-none"
              />
            </div>
            {err && <div className="text-rose-400 text-[11px]">{err}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-ink-950 font-semibold transition"
            >
              {busy ? 'Сохраняем…' : 'Сменить пароль'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ------------------------------ лента действий -------------------------------
export interface ActivityItem {
  id: string;
  user: string;
  color: string;
  text: string;
  at: string;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items.length) return null;
  return (
    <div className="absolute left-3 bottom-12 z-20 w-64 rounded-xl border border-ink-800 bg-cyber-card/85 backdrop-blur px-2.5 py-2 pointer-events-none">
      <div className="flex items-center gap-1.5 mb-1">
        <Radio className="w-3 h-3 text-emerald-400" />
        <span className="eyebrow">Совместная работа</span>
      </div>
      <div className="space-y-1">
        {items.slice(-4).map((it) => (
          <div key={it.id} className="flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-300">
            <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: it.color }} />
            <span className="min-w-0">
              <b className="text-cyber-text">{it.user}</b> {it.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --------------------------- курсоры коллег ---------------------------------
export function RemoteCursors({
  users,
  me,
  pan,
  zoom,
  rotated,
  centerPx,
}: {
  users: PresenceUser[];
  me: User | null;
  pan: { x: number; y: number };
  zoom: number;
  rotated: boolean;
  centerPx: { x: number; y: number };
}) {
  return (
    <>
      {users
        .filter((u) => u.login !== me?.login && u.cursor)
        .map((u) => {
          let px = u.cursor!.x * 32;
          let py = u.cursor!.y * 32;
          if (rotated) {
            px = 2 * centerPx.x - px;
            py = 2 * centerPx.y - py;
          }
          const left = pan.x + px * zoom;
          const top = pan.y + py * zoom;
          return (
            <div key={u.login} className="absolute z-30 pointer-events-none" style={{ left, top }}>
              <svg width="18" height="20" viewBox="0 0 18 20" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.45))' }}>
                <path d="M2 1 L2 16 L6.5 12.5 L9.5 19 L12.5 17.5 L9.5 11 L15 11 Z" fill={u.color} stroke="#09090A" strokeWidth="1" />
              </svg>
              <span
                className="absolute left-4 top-3 whitespace-nowrap text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-ink-950"
                style={{ backgroundColor: u.color }}
              >
                {u.name}
              </span>
            </div>
          );
        })}
    </>
  );
}
