import { useEffect } from 'react';
import {
  BrickWall,
  CheckCircle2,
  HardHat,
  HelpCircle,
  Lightbulb,
  MousePointer,
  Printer,
  RotateCw,
  Ruler,
  Undo2,
  WifiOff,
  X,
} from 'lucide-react';

// Короткие подсказки для строки под панелью инструментов.
export const TOOL_HINTS: Record<string, { label: string; hint: string }> = {
  select: {
    label: 'Выбор',
    hint: 'План редактируется в «Планировщике» RoomCAD; здесь — просмотр плана и сеть.',
  },
  pan: { label: 'Панорама', hint: 'Перетаскивайте план мышью. Колесо мыши — масштаб.' },
  ruler: { label: 'Линейка', hint: 'Кликните две точки на плане, чтобы измерить расстояние.' },
  note: { label: 'Пометка', hint: 'Кликните по плану, чтобы добавить текстовую пометку.' },
  place_node: { label: 'Узел', hint: 'Кликните по плану, чтобы разместить оборудование.' },
  cable: { label: 'Кабель', hint: 'Кликните начальный, затем конечный узел, чтобы проложить трассу.' },
  wall: {
    label: 'Только в RoomCAD',
    hint: 'Старый редактор стен отключён. Откройте «Планировщик» в шапке.',
  },
  door: {
    label: 'Только в RoomCAD',
    hint: 'Двери и окна добавляются в планировщике RoomCAD.',
  },
  window: {
    label: 'Только в RoomCAD',
    hint: 'Двери и окна добавляются в планировщике RoomCAD.',
  },
  opening: {
    label: 'Только в RoomCAD',
    hint: 'Проёмы добавляются в планировщике RoomCAD.',
  },
};

const STEPS = [
  {
    title: 'Откройте планировщик',
    text: 'Нажмите «Планировщик» в шапке — RoomCAD откроется с вашей учётной записью, без второго пароля.',
  },
  {
    title: 'План и подложка',
    text: 'Стены, двери, окна, проёмы и комнаты редактируются в RoomCAD. Растровый чертёж-подложка загружается кнопкой «Подложка»; справа настраиваются положение, размер и прозрачность. Если подложка не нужна — «Удалить подложку».',
  },
  {
    title: 'Печать и экспорт',
    text: 'В RoomCAD меню «Экспорт» → «Печать / PDF» (A4 landscape), «Чертёж (.svg)» или «Файл RoomCAD (.rcad)».',
  },
  {
    title: 'Сеть и документация',
    text: 'Схема сети, оборудование, кабельный журнал и документация остаются в netmap. Сеть доступна администратору, документация — по роли.',
  },
];

const SHORTCUTS: [string, string][] = [
  ['V', 'Выбор'],
  ['H', 'Панорама'],
  ['M', 'Линейка'],
  ['T', 'Текстовая пометка'],
  ['R', 'Поворот плана 180°'],
  ['Esc', 'Отменить текущий инструмент'],
  ['Del', 'Удалить пометку или объект сети'],
  ['Ctrl+Z', 'Отменить действие'],
  ['Ctrl+Shift+Z', 'Вернуть действие'],
  ['Колесо', 'Масштаб'],
];

function Section({
  title,
  icon,
  children,
  darkMode,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  darkMode: boolean;
}) {
  return (
    <section className="space-y-2">
      <h3 className={`flex items-center gap-2 text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function EngineerGuideModal({
  onClose,
  darkMode = true,
  onOpenPlanner,
}: {
  onClose: () => void;
  darkMode?: boolean;
  onOpenPlanner?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const card = darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Инструкция инженера"
    >
      <div
        className={`w-[min(760px,calc(100vw-24px))] max-h-[88vh] overflow-y-auto rounded-2xl border shadow-2xl ${
          darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
        }`}
      >
        <div className={`sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b backdrop-blur ${darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <HardHat className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight">Инструкция инженера</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Планировка — в RoomCAD, сеть и документация — в netmap</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Закрыть (Esc)"
            aria-label="Закрыть инструкцию"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold mb-2">
              <HelpCircle className="w-4 h-4 text-primary" /> Быстрый старт
            </h3>
            <ol className="space-y-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`flex gap-3 p-2.5 rounded-xl border ${card}`}>
                  <span className="w-5 h-5 shrink-0 rounded-full bg-primary text-ink-950 text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{s.title}</div>
                    <div className="text-[11px] leading-relaxed text-slate-400 mt-0.5">{s.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-blue-50/60 border-blue-100'}`}>
            <div className="font-semibold text-primary mb-1">Единый вход</div>
            <div className="text-slate-400">
              Кнопка «Планировщик» открывает RoomCAD в новой вкладке и передаёт вашу сессию. Старый редактор стен в netmap отключён: стены, проёмы и подложка меняются только в RoomCAD.
            </div>
          </div>

          <Section title="Подложка, печать и совместная работа" icon={<Printer className="w-4 h-4" />} darkMode={darkMode}>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className={`p-2.5 rounded-xl border ${card}`}>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <BrickWall className="w-3.5 h-3.5 text-primary" /> Подложка
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  В RoomCAD: «Подложка» → выберите файл. Справа задайте X/Z, ширину, длину и прозрачность. «Удалить подложку» убирает серый чертёж, оставляя модель.
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${card}`}>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Printer className="w-3.5 h-3.5 text-primary" /> Печать / PDF
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  В RoomCAD меню «Экспорт» → «Печать / PDF». Там же SVG для другого ПО и .rcad для переноса проекта.
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${card}`}>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Совместная работа
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  В RoomCAD нажмите «Совместно»: изменения синхронизируются для всех участников и сохраняются на сервере.
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${card}`}>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Ruler className="w-3.5 h-3.5 text-primary" /> Сеть
                </div>
                <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  В netmap — оборудование, IP/VLAN, кабели, кабельный журнал и документация. У инженера сеть скрыта.
                </div>
              </div>
            </div>
          </Section>

          <Section title="Клавиши и навигация в netmap" icon={<MousePointer className="w-4 h-4" />} darkMode={darkMode}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {SHORTCUTS.map(([key, label]) => (
                <div key={key} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] ${card}`}>
                  <kbd className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>
                    {key}
                  </kbd>
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <Undo2 className="w-3.5 h-3.5 inline mr-1 text-primary" />
              Отмена — Ctrl+Z или кнопка «Отменить» в шапке; вернуть — Ctrl+Shift+Z. Кнопка «Вписать» возвращает весь план в экран.
            </p>
          </Section>

          <Section title="Связь, сохранение и печать схемы" icon={<WifiOff className="w-4 h-4" />} darkMode={darkMode}>
            <ul className="space-y-1.5 text-[11px] leading-relaxed">
              <li className="flex gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                Сеть, оборудование и кабели сохраняются на сервере и синхронизируются с другими администраторами.
              </li>
              <li className="flex gap-2">
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                Если сверху появился баннер «Нет связи…» — дождитесь переподключения. При долгом обрыве проверьте Wi-Fi и обновите страницу.
              </li>
              <li className="flex gap-2">
                <Printer className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                Меню «Экспорт» в netmap печатает схему сети и кабельный журнал. Печать планировки — в RoomCAD.
              </li>
              <li className="flex gap-2">
                <RotateCw className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                Поворот плана на 180° — клавиша R или кнопка ⟲ внизу справа; на печать планировки это не влияет.
              </li>
            </ul>
          </Section>

          <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${darkMode ? 'bg-primary/5 border-primary/20 text-slate-300' : 'bg-amber-50 border-amber-200 text-slate-700'}`}>
            <b>Важно:</b> в netmap больше нельзя рисовать и удалять стены, ставить двери/окна/проёмы. Все изменения планировки — в RoomCAD; здесь план нужен для привязки сети и документов.
          </div>
        </div>

        <div className={`sticky bottom-0 flex items-center justify-between gap-2 px-5 py-3 border-t backdrop-blur ${darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-primary" />
            Инструкция всегда доступна по кнопке «?» в шапке
          </div>
          <div className="flex items-center gap-2">
            {onOpenPlanner && (
              <button
                onClick={onOpenPlanner}
                className="px-3 py-1.5 rounded-lg bg-primary text-ink-950 text-xs font-bold hover:opacity-90 transition flex items-center gap-1.5"
              >
                <BrickWall className="w-3.5 h-3.5" /> Открыть планировщик
              </button>
            )}
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              Понятно
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
