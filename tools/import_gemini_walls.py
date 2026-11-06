import json, io, os, math

base = r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2"
src = base + r"\handoff\gemini-walls-final.json"
data = json.load(open(src, encoding="utf-8"))
walls_raw = data["walls"]
openings_raw = data["openings"]
wall_by_id = {w["id"]: w for w in walls_raw}

def wall_len(w):
    return math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"])

walls = []
for w in walls_raw:
    walls.append({
        "id": w["id"],
        "x1": round(float(w["x1"]), 2),
        "y1": round(float(w["y1"]), 2),
        "x2": round(float(w["x2"]), 2),
        "y2": round(float(w["y2"]), 2),
        "thickness": round(float(w.get("thickness", 0.12)), 2),
        "loadBearing": bool(w.get("loadBearing", False)),
        "name": w.get("comment") or "Стена (модель)",
        "block": "A" if (float(w["x1"]) + float(w["x2"])) / 2 < 15.6 else "B",
        "kind": "wall",
        "orient": "H" if abs(float(w["y2"]) - float(w["y1"])) < 0.001 else "V",
    })

openings = []
for o in openings_raw:
    w = wall_by_id.get(o["wallId"])
    if not w:
        print("skip opening: no wall", o["id"])
        continue
    L = wall_len(w)
    offset = max(0.0, min(float(o["offset"]), max(0.0, L - 0.4)))
    width = max(0.4, min(float(o["width"]), L - offset))
    openings.append({
        "id": o["id"],
        "wallId": o["wallId"],
        "type": o.get("type") if o.get("type") in ("door", "window", "opening") else "door",
        "offset": round(offset, 2),
        "width": round(width, 2),
        "height": 2.1 if o.get("type") == "door" else 1.5,
    })

ts = "// Сгенерировано из точной модели Gemini (64 стены, 44 проёма).\n"
ts += "// Регенерация: tools/import_gemini_walls.py\n"
ts += "import type { WallSeg } from './correctPlan';\n\n"
ts += "export const DRAWING_WALLS: WallSeg[] = " + json.dumps(walls, ensure_ascii=False, indent=1) + ";\n\n"
ts += "export const DRAWING_OPENINGS: any[] = " + json.dumps(openings, ensure_ascii=False, indent=1) + ";\n"
io.open(base + r"\src\drawingWalls.ts", "w", encoding="utf-8").write(ts)

# серверные baseline
for name, payload in (("walls.json", walls), ("openings.json", openings)):
    path = base + r"\server" + "\\" + name
    if os.path.exists(path):
        try:
            old = json.load(open(path, encoding="utf-8"))
            json.dump(old, open(base + r"\server\backup-" + name, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        except Exception:
            pass
    json.dump(payload, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("walls:", len(walls), "openings:", len(openings))
