import io, re

path = r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2\src\App.tsx"
src = io.open(path, encoding="utf-8").read()
orig_len = len(src)

def replace(old, new, label):
    global src
    if old not in src:
        print("!! NOT FOUND:", label)
        return False
    src = src.replace(old, new, 1)
    print("ok:", label)
    return True

# 1) импорт данных плана
replace(
"} from 'lucide-react';\n",
"} from 'lucide-react';\n\nimport {\n  ROOMS as PLAN_ROOMS,\n  WALLS as PLAN_WALLS,\n  EXTERIOR_ENTRIES as PLAN_EXTERIOR,\n  WINDOWS as PLAN_WINDOWS,\n  BUILDING,\n} from './correctPlan';\n",
"import correctPlan")

# 2) блок данных геометрии -> проверенная модель
start = src.index("// Помещения объединённого здания (из оцифрованного CSV)")
end = src.index("// Слои проекта")
compat = """// ============================================================================
// ГЕОМЕТРИЯ ЗДАНИЯ — ТОЛЬКО ПРОВЕРЕННАЯ МОДЕЛЬ (out/*.csv)
// Метры; единая система координат: пом. 1080 слева + пом. 1079 справа.
// ============================================================================
const INITIAL_ROOMS = PLAN_ROOMS;
const INITIAL_WALLS = PLAN_WALLS;
const EXTERIOR_ENTRIES = PLAN_EXTERIOR;

// Демо-объекты Gemini были заданы в старой системе 32.46 x 16.21 м — приводим к реальной геометрии
const LEGACY_W = 32.46;
const LEGACY_H = 16.21;
const SX = BUILDING.width / LEGACY_W;
const SY = BUILDING.depth / LEGACY_H;
const inMeters = (v: number, k: number) => Math.round(v * k * 100) / 100;

"""
src = src[:start] + compat + src[end:]
print("ok: geometry data")

# 3) определение помещения по точке -> point-in-polygon
old_room = """  // Определение помещения по координатам (X, Y)
  const getRoomForPoint = (x, y) => {
    const found = INITIAL_ROOMS.find(
      (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    );
    return found ? `Пом. ${found.premise} — №${found.num} (${found.name})` : 'Вне контура / Коридор';
  };"""
new_room = """  // Определение помещения по координатам (X, Y) — полигоны проверенной модели
  const pointInPoly = (x: number, y: number, poly: number[][]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
    }
    return inside;
  };
  const getRoomForPoint = (x: number, y: number) => {
    for (const r of INITIAL_ROOMS) {
      const parts: any[] = Array.isArray((r.polygon as any)[0][0]) ? (r.polygon as any) : [r.polygon];
      if (parts.some((p: number[][]) => pointInPoly(x, y, p)))
        return `Пом. ${r.premise} — №${r.num} (${r.name})`;
    }
    return 'Вне контура / Коридор';
  };"""
replace(old_room, new_room, "getRoomForPoint")

# 4) отрисовка входных групп: rect -> polygon
start = src.index("                  {/* Входные крыльца и пандус */}")
end = src.index("                  {/* Контуры и заливка помещений */}")
ext_render = """                  {/* Входные крыльца и пандус — контуры из проверенной модели */}
                  {EXTERIOR_ENTRIES.map((ext) => {
                    const parts: any[] = Array.isArray((ext.polygon as any)[0][0]) ? (ext.polygon as any) : [ext.polygon];
                    const c = parts[0]
                      .reduce((a: number[], p: number[]) => [a[0] + p[0], a[1] + p[1]], [0, 0])
                      .map((v: number) => v / parts[0].length);
                    return (
                      <g key={ext.id}>
                        {parts.map((poly: number[][], i: number) => (
                          <polygon
                            key={i}
                            points={poly.map((p) => `${p[0] * SCALE},${p[1] * SCALE}`).join(' ')}
                            fill={darkMode ? '#17171A' : '#FFFDF0'}
                            stroke={darkMode ? '#8E751D' : '#B9B28F'}
                            strokeWidth="1.5"
                            strokeDasharray="5,4"
                          />
                        ))}
                        <text
                          x={c[0] * SCALE}
                          y={c[1] * SCALE}
                          textAnchor="middle"
                          fontSize="10"
                          fill={darkMode ? '#B9B28F' : '#6B6552'}
                          className="font-medium"
                        >
                          {ext.name}
                        </text>
                      </g>
                    );
                  })}

"""
src = src[:start] + ext_render + src[end:]
print("ok: exterior render")

# 5) отрисовка помещений: rect -> polygon
start = src.index("                  {/* Контуры и заливка помещений */}")
end = src.index("                  {/* Внешние размерные цепочки здания */}")
rooms_render = """                  {/* Контуры и заливка помещений — полигоны проверенной модели */}
                  {INITIAL_ROOMS.filter((r) => planFilter === 'unified' || r.premise === planFilter).map((room) => {
                    const is1080 = room.premise === '1080';
                    const fillLight = is1080 ? '#FFFDF0' : '#FFF8D6';
                    const fillDark = is1080 ? '#101012' : '#17171A';
                    const parts: any[] = Array.isArray((room.polygon as any)[0][0]) ? (room.polygon as any) : [room.polygon];
                    return (
                      <g key={room.id} data-bg="true">
                        {parts.map((poly: number[][], i: number) => (
                          <polygon
                            key={i}
                            points={poly.map((p) => `${p[0] * SCALE},${p[1] * SCALE}`).join(' ')}
                            fill={darkMode ? fillDark : fillLight}
                            stroke={darkMode ? '#2E2C1E' : '#E6E0C2'}
                            strokeWidth="1"
                            data-bg="true"
                          />
                        ))}

                        {/* Подписи: № / площадь / название из паспорта */}
                        {showRoomLabels && (
                          <g
                            transform={`translate(${room.label[0] * SCALE}, ${room.label[1] * SCALE})`}
                            className="pointer-events-none"
                          >
                            <text x="0" y="-5" textAnchor="middle" fontSize="11" fontWeight="700"
                              fill={darkMode ? '#FFF5B8' : '#2E2C1E'}>{room.num}</text>
                            <line x1="-14" y1="-1" x2="14" y2="-1"
                              stroke={darkMode ? '#8E751D' : '#6B6552'} strokeWidth="1.2" />
                            <text x="0" y="11" textAnchor="middle" fontSize="10.5" fontWeight="600"
                              fill={darkMode ? '#B9B28F' : '#6B6552'}>{room.area ?? ''}</text>
                            {room.area !== null && room.area >= 7 && (
                              <text x="0" y="22" textAnchor="middle" fontSize="8.5"
                                fill={darkMode ? '#8F8A6E' : '#B9B28F'}>{room.name}</text>
                            )}
                          </g>
                        )}
                      </g>
                    );
                  })}

"""
src = src[:start] + rooms_render + src[end:]
print("ok: rooms render")

# 6) размерные цепочки — реальные габариты
start = src.index("                  {/* Внешние размерные цепочки здания */}")
end = src.index("                  {/* СТЕНА И ПЕРЕГОРОДКИ")
dims = """                  {/* Внешние размерные цепочки — реальные габариты проверенной модели */}
                  {showDimensions && (
                    <g className="pointer-events-none" fill={darkMode ? '#8F8A6E' : '#6B6552'} fontSize="10">
                      <line
                        x1={0}
                        y1={(BUILDING.depth + 0.9) * SCALE}
                        x2={BUILDING.width * SCALE}
                        y2={(BUILDING.depth + 0.9) * SCALE}
                        stroke={darkMode ? '#2E2C1E' : '#E6E0C2'}
                        strokeWidth="1"
                        strokeDasharray="3,3"
                      />
                      <text x={(BUILDING.width / 2) * SCALE} y={(BUILDING.depth + 1.35) * SCALE} textAnchor="middle" fontWeight="600">
                        Общая длина здания: {BUILDING.width} м (пом. 1080 + пом. 1079)
                      </text>
                      <text
                        x={-0.7 * SCALE}
                        y={(BUILDING.depth / 2) * SCALE}
                        textAnchor="middle"
                        transform={`rotate(-90, ${-0.7 * SCALE}, ${(BUILDING.depth / 2) * SCALE})`}
                        fontWeight="600"
                      >
                        Глубина: {BUILDING.depth} м
                      </text>
                    </g>
                  )}

"""
src = src[:start] + dims + src[end:]
print("ok: dimensions")

# 7) окна — из openings.csv
start = src.index("                  {/* Оконные проёмы по северному и южному фасадам */}")
end = src.index("                </g>\n\n                {/* 3. ТЕПЛОВАЯ КАРТА")
windows = """                  {/* Оконные проёмы — из проверенной модели (openings.csv) */}
                  {PLAN_WINDOWS.map((win) => (
                    <rect
                      key={win.id}
                      x={win.rect[0] * SCALE}
                      y={win.rect[1] * SCALE}
                      width={win.rect[2] * SCALE}
                      height={win.rect[3] * SCALE}
                      fill={darkMode ? '#FCD116' : '#FCD116'}
                      stroke={darkMode ? '#8E751D' : '#B9B28F'}
                      strokeWidth="1"
                      fillOpacity="0.85"
                    />
                  ))}
"""
src = src[:start] + windows + src[end:]
print("ok: windows")

# 8) демо-координаты — масштабируем под реальную геометрию
replace(
"  const [nodes, setNodes] = useState(INITIAL_NODES);",
"  const [nodes, setNodes] = useState(() =>\n    INITIAL_NODES.map((n) => ({ ...n, x: inMeters(n.x, SX), y: inMeters(n.y, SY) }))\n  );",
"nodes init")

replace(
"""  const [notes, setNotes] = useState([
    { id: 'NOTE-1', x: 3.4, y: 6.2, text: 'Высота потолка h = 3.96 м (разводка в лотках)', layer: 'notes' },
    { id: 'NOTE-2', x: 14.9, y: -1.3, text: 'Стык планов 1080 и 1079', layer: 'notes' }
  ]);""",
"""  const [notes, setNotes] = useState([
    { id: 'NOTE-1', x: inMeters(3.4, SX), y: inMeters(6.2, SY), text: 'Высота потолка h = 3.96 м (разводка в лотках)', layer: 'notes' },
    { id: 'NOTE-2', x: inMeters(14.9, SX), y: inMeters(-1.3, SY), text: 'Стык планов 1080 и 1079', layer: 'notes' }
  ]);""",
"notes init")

replace(
"""              setNodes(INITIAL_NODES);
              setCables(INITIAL_CABLES);""",
"""              setNodes(INITIAL_NODES.map((n) => ({ ...n, x: inMeters(n.x, SX), y: inMeters(n.y, SY) })));
              setCables(INITIAL_CABLES);""",
"reset demo")

io.open(path, "w", encoding="utf-8").write(src)
print("size:", orig_len, "->", len(src))

