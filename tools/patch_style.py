import io

path = r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2\src\App.tsx"
src = io.open(path, encoding="utf-8").read()

def rep(old, new, label, count=1):
    global src
    if old not in src:
        print("!! NOT FOUND:", label)
        return
    src = src.replace(old, new, count)
    print("ok:", label)

# ---------- 1. оболочка / шапка в стиле визитки ----------
rep("""      className={`h-screen w-screen overflow-hidden flex flex-col select-none font-sans transition-colors duration-200 ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`}""",
"""      className={`h-screen w-screen overflow-hidden flex flex-col select-none font-sans transition-colors duration-200 ${
        darkMode ? 'bg-cyber-bg text-cyber-text' : 'bg-paper text-ink-700'
      }`}""",
"root wrapper")

rep("""        className={`h-13 px-3 border-b flex items-center justify-between gap-2 z-30 shrink-0 ${
          darkMode
            ? 'bg-slate-900/95 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200/90 text-slate-800 shadow-2xs'
        }`}""",
"""        className={`h-13 px-3 border-b flex items-center justify-between gap-2 z-30 shrink-0 ${
          darkMode
            ? 'bg-cyber-card/95 border-ink-800 text-cyber-text backdrop-blur'
            : 'bg-paper border-hairline text-ink-700 shadow-2xs'
        }`}""",
"header")

rep("""          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Network className="w-4 h-4" />
          </div>""",
"""          <div className="w-8 h-8 rounded-lg border border-primary/70 bg-primary/10 flex items-center justify-center shrink-0 glow-primary">
            <span className="font-display font-black text-primary text-lg leading-none">K</span>
          </div>""",
"logo")

rep("className={`text-sm font-semibold bg-transparent border border-transparent hover:border-slate-300",
    "className={`font-display text-sm font-bold tracking-tight bg-transparent border border-transparent hover:border-slate-300",
    "project title font")

rep("<span>Масштаб 1:100 • Высота потолка h=3.96м • Общая площадь 349.1 м²</span>",
    "<span>Масштаб 1:100 · h=3.96 м · площадь {Math.round(TOTAL_AREA)} м² · проверенный план (БТИ)</span>",
    "header subtitle")

# ---------- 2. вписать план в холст ----------
rep("const [zoom, setZoom] = useState(0.88);", "const [zoom, setZoom] = useState(0.62);", "zoom init")
rep("const [pan, setPan] = useState({ x: 38, y: 85 });", "const [pan, setPan] = useState({ x: 55, y: 105 });", "pan init")

rep("""  const handleFitView = () => {
    setZoom(0.88);
    setPan({ x: 38, y: 85 });
  };""",
"""  const handleFitView = () => {
    const svg = svgRef.current;
    const w = svg?.clientWidth || 1000;
    const h = svg?.clientHeight || 700;
    const zx = (w - 130) / (BUILDING.width * SCALE);
    const zy = (h - 160) / (BUILDING.depth * SCALE);
    const z = Math.max(0.35, Math.min(2.0, Math.min(zx, zy)));
    setZoom(Math.round(z * 100) / 100);
    setPan({ x: 60, y: 100 });
  };

  // первично вписываем проверенный план в холст
  useEffect(() => {
    const t = setTimeout(() => handleFitView(), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);""",
"fit view")

# ---------- 3. цвета холста ----------
rep("backgroundColor: darkMode ? '#090d16' : '#f8fafc'", "backgroundColor: darkMode ? '#09090A' : '#FFFDF0'", "canvas bg")
rep("stroke={darkMode ? '#1e293b' : '#e2e8f0'}", "stroke={darkMode ? '#26251D' : '#E6E0C2'}", "grid stroke")
rep("""                <radialGradient id="wifiGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="65%" stopColor="#3b82f6" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </radialGradient>""",
"""                <radialGradient id="wifiGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FCD116" stopOpacity="0.22" />
                  <stop offset="65%" stopColor="#8E751D" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#8E751D" stopOpacity="0.0" />
                </radialGradient>""",
"wifi gradient")

# ---------- 4. цвет стен ----------
rep("""                    const strokeColor = isSelected
                      ? '#2563eb'
                      : w.isSeam
                      ? '#dc2626'
                      : w.loadBearing
                      ? darkMode
                        ? '#e2e8f0'
                        : '#0f172a'
                      : darkMode
                      ? '#64748b'
                      : '#475569';""",
"""                    const strokeColor = isSelected
                      ? '#FCD116'
                      : w.isSeam
                      ? '#FCD116'
                      : w.loadBearing
                      ? darkMode
                        ? '#E6E0C2'
                        : '#2E2C1E'
                      : darkMode
                      ? '#6B6552'
                      : '#8F8A6E';""",
"wall colors")

rep("fill={isSelected ? '#2563eb' : darkMode ? '#93c5fd' : '#1d4ed8'}",
    "fill={isSelected ? '#FCD116' : darkMode ? '#FCD116' : '#8E751D'}",
    "wall label color")

# ---------- 5. фирменные цвета слоёв и кабелей ----------
rep("{ id: 'scs', name: 'Интернет / СКС', color: '#2563eb',", "{ id: 'scs', name: 'Интернет / СКС', color: '#FCD116',", "layer scs")
rep("{ id: 'telephony', name: 'Телефония (SIP)', color: '#10b981',", "{ id: 'telephony', name: 'Телефония (SIP)', color: '#34D399',", "layer telephony")
rep("{ id: 'pc', name: 'ПК и рабочие места', color: '#7c3aed',", "{ id: 'pc', name: 'ПК и рабочие места', color: '#A78BFA',", "layer pc")
rep("{ id: 'servers', name: 'Серверы и ядро сети', color: '#ea580c',", "{ id: 'servers', name: 'Серверы и ядро сети', color: '#FB923C',", "layer servers")
rep("{ id: 'cctv', name: 'Видеонаблюдение', color: '#be123c',", "{ id: 'cctv', name: 'Видеонаблюдение', color: '#FB7185',", "layer cctv")
rep("{ id: 'power', name: 'Электрика и питание 220В', color: '#dc2626',", "{ id: 'power', name: 'Электрика и питание 220В', color: '#EF4444',", "layer power")
rep("{ id: 'partitions', name: 'Перегородки (редакт.)', color: '#475569',", "{ id: 'partitions', name: 'Перегородки (редакт.)', color: '#6B6552',", "layer partitions")
rep("{ id: 'notes', name: 'Пометки и размеры', color: '#64748b',", "{ id: 'notes', name: 'Пометки и размеры', color: '#8F8A6E',", "layer notes")

rep("color: '#2563eb', dashed: false, layer: 'scs'", "color: '#FCD116', dashed: false, layer: 'scs'", "cable utp")
rep("color: '#f59e0b', dashed: false, layer: 'servers'", "color: '#F59E0B', dashed: false, layer: 'servers'", "cable fiber")
rep("color: '#10b981', dashed: true, layer: 'telephony'", "color: '#34D399', dashed: true, layer: 'telephony'", "cable phone")
rep("color: '#be123c', dashed: true, layer: 'cctv'", "color: '#FB7185', dashed: true, layer: 'cctv'", "cable cctv")
rep("color: '#dc2626', dashed: false, layer: 'power'", "color: '#EF4444', dashed: false, layer: 'power'", "cable power")

# ---------- 6. демо: расстановка по помещениям проверенного плана ----------
marker = "// Стартовые кабельные трассы"
idx = src.index(marker)
demo_block = """// Привязка демонстрационного оборудования к помещениям проверенной модели
const DEMO_ROOM: Record<string, [string, string, number, number]> = {
  'N-RACK-1': ['1079', '14', -0.3, 0.1],
  'N-GW-1': ['1079', '12', 0.6, -0.5],
  'N-SW-1': ['1079', '13', -0.5, 0.1],
  'N-SW-2': ['1080', '11', 0.0, 0.0],
  'N-NVR-1': ['1079', '14', 0.5, 0.6],
  'N-AP-1': ['1080', '12', -2.6, -2.2],
  'N-AP-2': ['1080', '12', -2.6, 2.6],
  'N-AP-3': ['1079', '12', 1.6, 0.9],
  'N-AP-4': ['1079', '5', 0.2, 0.2],
  'N-PC-1': ['1080', '12', -4.2, -0.4],
  'N-PC-2': ['1079', '2', 0.0, 0.3],
  'N-PC-3': ['1079', '3', 0.0, 0.2],
  'N-PC-4': ['1079', '5', 0.8, 0.6],
  'N-PC-5': ['1079', '16', 0.0, 0.0],
  'N-PRN-1': ['1079', '13', -1.8, 0.1],
  'N-TEL-1': ['1080', '12', -5.6, -1.2],
  'N-TEL-2': ['1079', '2', 0.7, 0.5],
  'N-TEL-3': ['1079', '4', 0.2, 0.3],
  'N-TEL-4': ['1079', '6', 0.4, 0.4],
  'N-CAM-1': ['1080', '8', 0.0, 0.0],
  'N-CAM-2': ['1080', '12', -6.2, -3.2],
  'N-CAM-3': ['1079', '30', 0.0, 0.0],
  'N-CAM-4': ['1079', '6', 0.8, -2.2],
  'N-PWR-1': ['1079', '15', 0.0, 0.0],
  'N-PWR-2': ['1080', '11', 0.4, -0.4],
};

const roomPoint = (premise: string, num: string, dx = 0, dy = 0): [number, number] => {
  const room = INITIAL_ROOMS.find((r) => r.premise === premise && r.num === String(num));
  if (!room) return [BUILDING.width / 2, BUILDING.depth / 2];
  return [room.centroid[0] + dx, room.centroid[1] + dy];
};

const DEMO_NODES = INITIAL_NODES.map((n) => {
  const m = DEMO_ROOM[n.id];
  if (!m) return n;
  const [x, y] = roomPoint(m[0], m[1], m[2], m[3]);
  return { ...n, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
});

"""
src = src[:idx] + demo_block + src[idx:]
print("ok: demo mapping")

# useState узлов
rep("""  const [nodes, setNodes] = useState(() =>
    INITIAL_NODES.map((n) => ({ ...n, x: inMeters(n.x, SX), y: inMeters(n.y, SY) }))
  );""",
"""  const [nodes, setNodes] = useState(() => DEMO_NODES.map((n) => ({ ...n })));""",
"nodes useState")

# заметки — по проверенным помещениям
rep("""  const [notes, setNotes] = useState([
    { id: 'NOTE-1', x: inMeters(3.4, SX), y: inMeters(6.2, SY), text: 'Высота потолка h = 3.96 м (разводка в лотках)', layer: 'notes' },
    { id: 'NOTE-2', x: inMeters(14.9, SX), y: inMeters(-1.3, SY), text: 'Стык планов 1080 и 1079', layer: 'notes' }
  ]);""",
"""  const [notes, setNotes] = useState(() => {
    const [n1x, n1y] = roomPoint('1080', '12', -1.8, -2.4);
    return [
      { id: 'NOTE-1', x: n1x, y: n1y, text: 'Высота потолка h = 3.96 м (разводка в лотках)', layer: 'notes' },
      { id: 'NOTE-2', x: 15.63, y: 1.4, text: 'Стык планов 1080 и 1079', layer: 'notes' },
    ];
  });""",
"notes useState")

# сброс демо
rep("""              setNodes(INITIAL_NODES.map((n) => ({ ...n, x: inMeters(n.x, SX), y: inMeters(n.y, SY) })));""",
"""              setNodes(DEMO_NODES.map((n) => ({ ...n })));""",
"demo reset")

# ---------- 7. подписи подложки ----------
rep("""              <option value="unified">Подложка: Единый план (1080 + 1079)</option>
              <option value="1080">Только пом. 1080 (БТИ, 164.1 м²)</option>
              <option value="1079">Только пом. 1079 (Техплан, 185 м²)</option>""",
"""              <option value="unified">План: единый (1080 + 1079)</option>
              <option value="1080">Только пом. 1080 (164.1 м²)</option>
              <option value="1079">Только пом. 1079 (217.9 м²)</option>""",
"underlay options")

# ---------- 8. суммарная площадь ----------
rep("""const inMeters = (v: number, k: number) => Math.round(v * k * 100) / 100;""",
"""const inMeters = (v: number, k: number) => Math.round(v * k * 100) / 100;
const TOTAL_AREA = INITIAL_ROOMS.reduce((s, r) => s + (r.area || 0), 0);""",
"total area")

io.open(path, "w", encoding="utf-8").write(src)
print("written")
