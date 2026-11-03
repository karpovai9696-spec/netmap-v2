import io

path = r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2\src\App.tsx"
src = io.open(path, encoding="utf-8").read()

def rep(old, new, label):
    global src
    if old not in src:
        print("!! NOT FOUND:", label)
        return
    src = src.replace(old, new, 1)
    print("ok:", label)

# 1) storage helpers
rep("const SCALE = 32; // 1m = 32px",
"""const STORAGE_KEY = 'netmap-v2.project.v1';

const loadSavedProject = (): any | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const SAVED = loadSavedProject();

const SCALE = 32; // 1m = 32px""",
"storage helpers")

# 2) начальные состояния из сохранения
rep("const [darkMode, setDarkMode] = useState(true);", "const [darkMode, setDarkMode] = useState(SAVED?.darkMode ?? true);", "darkMode")
rep("const [projectTitle, setProjectTitle] = useState('Карта сети — 1 этаж (Козина 7, пом. 1080 + 1079)');",
    "const [projectTitle, setProjectTitle] = useState(\n    SAVED?.projectTitle ?? 'Карта сети — 1 этаж (Козина 7, пом. 1080 + 1079)'\n  );", "projectTitle")
rep("const [planFilter, setPlanFilter] = useState('unified');", "const [planFilter, setPlanFilter] = useState(SAVED?.planFilter ?? 'unified');", "planFilter")
rep("const [underlayOpacity, setUnderlayOpacity] = useState(95);", "const [underlayOpacity, setUnderlayOpacity] = useState(SAVED?.underlayOpacity ?? 95);", "underlayOpacity")
rep("const [showGrid, setShowGrid] = useState(true);", "const [showGrid, setShowGrid] = useState(SAVED?.showGrid ?? true);", "showGrid")
rep("const [showWifiHeatmap, setShowWifiHeatmap] = useState(true);", "const [showWifiHeatmap, setShowWifiHeatmap] = useState(SAVED?.showWifiHeatmap ?? true);", "showWifiHeatmap")
rep("const [showRoomLabels, setShowRoomLabels] = useState(true);", "const [showRoomLabels, setShowRoomLabels] = useState(SAVED?.showRoomLabels ?? true);", "showRoomLabels")
rep("const [showDimensions, setShowDimensions] = useState(true);", "const [showDimensions, setShowDimensions] = useState(SAVED?.showDimensions ?? true);", "showDimensions")
rep("const [calibration, setCalibration] = useState({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 });",
    "const [calibration, setCalibration] = useState(\n    SAVED?.calibration ?? { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }\n  );", "calibration")
rep("const [activeLayerId, setActiveLayerId] = useState('scs');", "const [activeLayerId, setActiveLayerId] = useState(SAVED?.activeLayerId ?? 'scs');", "activeLayerId")

rep("const [layers, setLayers] = useState(INITIAL_LAYERS);", "const [layers, setLayers] = useState(SAVED?.layers ?? INITIAL_LAYERS);", "layers state")
rep("const [walls, setWalls] = useState(INITIAL_WALLS);", "const [walls, setWalls] = useState(SAVED?.walls ?? INITIAL_WALLS);", "walls state")
rep("const [nodes, setNodes] = useState(() => DEMO_NODES.map((n) => ({ ...n })));",
    "const [nodes, setNodes] = useState(() => SAVED?.nodes ?? DEMO_NODES.map((n) => ({ ...n })));", "nodes state")
rep("const [cables, setCables] = useState(INITIAL_CABLES);", "const [cables, setCables] = useState(SAVED?.cables ?? INITIAL_CABLES);", "cables state")

rep("""  const [notes, setNotes] = useState(() => {
    const [n1x, n1y] = roomPoint('1080', '12', -1.8, -2.4);
    return [
      { id: 'NOTE-1', x: n1x, y: n1y, text: 'Высота потолка h = 3.96 м (разводка в лотках)', layer: 'notes' },
      { id: 'NOTE-2', x: 15.63, y: 1.4, text: 'Стык планов 1080 и 1079', layer: 'notes' },
    ];
  });""",
"""  const [notes, setNotes] = useState(() => {
    if (Array.isArray(SAVED?.notes)) return SAVED.notes;
    const [n1x, n1y] = roomPoint('1080', '12', -1.8, -2.4);
    return [
      { id: 'NOTE-1', x: n1x, y: n1y, text: 'Высота потолка h = 3.96 м (разводка в лотках)', layer: 'notes' },
      { id: 'NOTE-2', x: 15.63, y: 1.4, text: 'Стык планов 1080 и 1079', layer: 'notes' },
    ];
  });""",
"notes state")

rep("const [zoom, setZoom] = useState(0.62);", "const [zoom, setZoom] = useState(SAVED?.zoom ?? 0.62);", "zoom")
rep("const [pan, setPan] = useState({ x: 55, y: 105 });", "const [pan, setPan] = useState(SAVED?.pan ?? { x: 55, y: 105 });", "pan")

# 3) file input ref
rep("const svgRef = useRef(null);", "const svgRef = useRef(null);\n  const fileInputRef = useRef<HTMLInputElement>(null);", "file ref")

# 4) не перекрывать восстановленный вид первичным fit
rep("""  useEffect(() => {
    const t = setTimeout(() => handleFitView(), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);""",
"""  useEffect(() => {
    if (SAVED?.zoom && SAVED?.pan) return; // вид восстановлен из сохранения
    const t = setTimeout(() => handleFitView(), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автосохранение проекта в браузере
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            projectTitle, nodes, cables, walls, layers, notes, activeLayerId,
            darkMode, planFilter, underlayOpacity, calibration,
            showGrid, showRoomLabels, showDimensions, showWifiHeatmap,
            zoom, pan,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {
        /* ignore quota errors */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [
    projectTitle, nodes, cables, walls, layers, notes, activeLayerId,
    darkMode, planFilter, underlayOpacity, calibration,
    showGrid, showRoomLabels, showDimensions, showWifiHeatmap, zoom, pan,
  ]);""",
"autosave")

# 5) экспорт: полный проект
rep("""  const handleExportJSON = () => {
    const payload = { projectTitle, nodes, cables, walls, layers, calibration };""",
"""  const handleExportJSON = () => {
    const payload = {
      version: 2,
      projectTitle, nodes, cables, walls, layers, notes, activeLayerId,
      darkMode, planFilter, underlayOpacity, calibration,
      showGrid, showRoomLabels, showDimensions, showWifiHeatmap, zoom, pan,
      exportedAt: new Date().toISOString(),
    };""",
"export payload")

# 6) импорт JSON
rep("""  // --- Вычисляемая статистика по проекту и выбранному объекту ---""",
"""  // Импорт проекта из JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || (!Array.isArray(data.nodes) && !Array.isArray(data.cables))) {
          throw new Error('bad file');
        }
        if (data.projectTitle) setProjectTitle(data.projectTitle);
        if (Array.isArray(data.nodes)) setNodes(data.nodes);
        if (Array.isArray(data.cables)) setCables(data.cables);
        if (Array.isArray(data.walls)) setWalls(data.walls);
        if (Array.isArray(data.layers)) setLayers(data.layers);
        if (Array.isArray(data.notes)) setNotes(data.notes);
        if (data.activeLayerId) setActiveLayerId(data.activeLayerId);
        if (typeof data.darkMode === 'boolean') setDarkMode(data.darkMode);
        if (data.planFilter) setPlanFilter(data.planFilter);
        if (typeof data.underlayOpacity === 'number') setUnderlayOpacity(data.underlayOpacity);
        if (data.calibration) setCalibration(data.calibration);
        if (typeof data.zoom === 'number') setZoom(data.zoom);
        if (data.pan) setPan(data.pan);
        triggerToast('Проект загружен из JSON');
      } catch {
        triggerToast('Не удалось прочитать JSON проекта');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Вычисляемая статистика по проекту и выбранному объекту ---""",
"import handler")

# 7) скрытый input + пункт меню
rep("""    <div
      className={`h-screen w-screen overflow-hidden flex flex-col select-none font-sans transition-colors duration-200 ${""",
"""    <div
      className={`h-screen w-screen overflow-hidden flex flex-col select-none font-sans transition-colors duration-200 ${""",
"root marker (noop)")

rep("""      <header
        className={`h-13 px-3 border-b flex items-center justify-between gap-2 z-30 shrink-0 ${""",
"""      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportJSON}
      />

      <header
        className={`h-13 px-3 border-b flex items-center justify-between gap-2 z-30 shrink-0 ${""",
"hidden input")

rep("""                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />""",
"""                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition"
                >
                  <Upload className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="font-semibold">Загрузить проект (JSON)</div>
                    <div className="text-[10px] text-slate-400">Восстановить сохранённую схему</div>
                  </div>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />""",
"import menu item")

io.open(path, "w", encoding="utf-8").write(src)
print("persistence patch done")
