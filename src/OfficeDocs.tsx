import React from 'react';
import {
  Router,
  Server,
  ShieldCheck,
  Globe,
  Wifi,
  Terminal,
  ArrowRight,
  MapPin,
  Info,
  Network,
  Cable,
  Lock,
} from 'lucide-react';
import { OFFICE_NET } from './officeNet';

function SectionCard({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-ink-800 bg-cyber-card/70 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon ? <Icon className="w-4 h-4 text-primary" /> : null}
        <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-cyber-text">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function OfficeDocs({
  canPlace,
  onPlace,
  placedCount,
}: {
  canPlace: boolean;
  onPlace: () => void;
  placedCount: number;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* заголовок */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-1">// документация по сети</div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{OFFICE_NET.title}</h1>
            <p className="text-xs text-ink-300 mt-1 max-w-3xl">{OFFICE_NET.subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={onPlace}
              disabled={!canPlace}
              title={canPlace ? 'Добавить объекты документации на план' : 'Доступно только администратору'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-ink-950 text-xs font-semibold transition"
            >
              <MapPin className="w-4 h-4" />
              Разместить на плане
            </button>
            <span className="text-[10px] text-ink-500">
              {placedCount > 0 ? `на плане: ${placedCount} сетевых объектов` : 'объекты ещё не размещены'}
            </span>
          </div>
        </div>

        {/* назначение */}
        <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-[12.5px] text-ink-300 leading-relaxed">
          <Info className="w-4 h-4 text-primary inline-block mr-2 -mt-0.5" />
          {OFFICE_NET.purpose}
        </div>

        {/* архитектура */}
        <SectionCard title="Архитектура" icon={Network}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {OFFICE_NET.chain.map((c, i) => (
              <div key={c.step} className="relative">
                <div className="h-full rounded-xl border border-ink-800 bg-cyber-bg/60 px-3 py-2.5">
                  <div className="eyebrow mb-1">{c.step}</div>
                  <div className="text-xs font-semibold text-cyber-text leading-snug">{c.label}</div>
                  <div className="text-[10.5px] text-ink-400 mt-1 leading-snug">{c.detail}</div>
                </div>
                {i < OFFICE_NET.chain.length - 1 && (
                  <ArrowRight className="hidden md:block absolute -right-[13px] top-1/2 -translate-y-1/2 w-4 h-4 text-ink-600 z-10" />
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* адресация */}
          <SectionCard title="Узлы и адресация" icon={Router}>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-ink-400 text-left">
                    <th className="py-1.5 px-1 font-semibold">Узел</th>
                    <th className="py-1.5 px-1 font-semibold font-mono">IP</th>
                    <th className="py-1.5 px-1 font-semibold">Роль</th>
                  </tr>
                </thead>
                <tbody>
                  {OFFICE_NET.hosts.map((h) => (
                    <tr key={h.name} className="border-t border-ink-800/80 align-top">
                      <td className="py-1.5 px-1 font-medium text-cyber-text whitespace-nowrap">
                        {h.name}
                        <div className="text-[9.5px] text-ink-500">{h.place}</div>
                      </td>
                      <td className="py-1.5 px-1 font-mono text-primary whitespace-nowrap">{h.ip}</td>
                      <td className="py-1.5 px-1 text-ink-300 leading-snug">{h.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* сервисы и порты */}
          <SectionCard title="Сервисы и порты" icon={Server}>
            <div className="space-y-1.5">
              {OFFICE_NET.services.map((s) => (
                <div key={s.service + s.port} className="flex gap-2 text-[11.5px] items-start">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-ink-800/70 text-primary whitespace-nowrap">{s.port}</span>
                  <div className="min-w-0">
                    <span className="font-semibold text-cyber-text">{s.service}</span>
                    <span className="text-ink-400"> — {s.purpose}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* DNS */}
          <SectionCard title="DNS-схема (CoreDNS)" icon={Globe}>
            <ol className="space-y-1.5 text-[11.5px] text-ink-300 list-decimal pl-4">
              {OFFICE_NET.dns.map((d, i) => (
                <li key={i} className="leading-snug">{d}</li>
              ))}
            </ol>
          </SectionCard>

          {/* что в туннеле */}
          <SectionCard title="Что уходит в туннель" icon={ShieldCheck}>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {OFFICE_NET.tunnel.map((t) => (
                <span key={t} className="text-[10.5px] px-2 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
                  {t}
                </span>
              ))}
            </div>
            <div className="text-[11px] text-ink-400 space-y-1">
              {OFFICE_NET.direct.map((d, i) => (
                <div key={i} className="flex gap-1.5">
                  <span className="text-ink-500">—</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* диагностика */}
        <SectionCard title="Диагностика" icon={Terminal}>
          <pre className="text-[11px] leading-relaxed font-mono text-emerald-300/90 bg-cyber-bg rounded-xl border border-ink-800 p-3 overflow-x-auto">
            {OFFICE_NET.diagnostics.join('\n')}
          </pre>
        </SectionCard>

        {/* важные замечания */}
        <SectionCard title="Важно" icon={Lock}>
          <ul className="space-y-1.5 text-[11.5px] text-ink-300">
            {OFFICE_NET.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span className="leading-snug">{n}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-ink-800 text-[10.5px] text-ink-500 flex items-center gap-2">
            <Cable className="w-3.5 h-3.5" />
            Источник: <span className="font-mono">Documents\kimi\Workspaces\VPN\OFFICE-GATEWAY.md</span> · данные только для чтения
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
