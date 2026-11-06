import json, io, os

base = r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2"
raw = json.load(open(base + r"\walls-extracted.json", encoding="utf-8"))
walls = []
for i, w in enumerate(raw, 1):
    walls.append({
        "id": f"DW-{i:03d}",
        "name": "Стена (с чертежа)",
        "x1": w["x1"], "y1": w["y1"], "x2": w["x2"], "y2": w["y2"],
        "thickness": w.get("thickness", 0.12),
        "loadBearing": False,
        "block": "A" if (w["x1"] + w["x2"]) / 2 < 15.6 else "B",
        "kind": "wall",
        "orient": "H" if abs(w["y1"] - w["y2"]) < 0.001 else "V",
    })

# TS-модуль для фронтенда
ts = "// Сгенерировано из актуального чертежа (_plan_src.png) — стены совпадают с подложкой.\n"
ts += "// Регенерация: tools/extract_walls.py\n"
ts += "import type { WallSeg } from './correctPlan';\n\n"
ts += "export const DRAWING_WALLS: WallSeg[] = " + json.dumps(walls, ensure_ascii=False, indent=1) + ";\n"
io.open(base + r"\src\drawingWalls.ts", "w", encoding="utf-8").write(ts)

# серверный baseline стен
old = base + r"\server\walls.json"
if os.path.exists(old):
    json.dump(json.load(open(old, encoding="utf-8")), open(base + r"\server\walls-old-csv.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(walls, open(old, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("walls:", len(walls))
