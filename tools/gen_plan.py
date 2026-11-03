"""Генерация корректного плана (из проверенной CSV-модели) для нового React-UI.

Вход:  out/walls.csv, out/rooms.csv, out/structures.csv, out/openings.csv  (мм)
Выход: netmap-v2/src/correctPlan.ts  (метры, единая система координат здания)
"""
import csv
import io
import json
import os

ROOT = r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace"
OUT = os.path.join(ROOT, "out")
DEST = os.path.join(ROOT, "netmap-v2", "src", "correctPlan.ts")


def num(s):
    if s is None or s == "":
        return None
    return float(str(s).replace(",", "."))


def read(name):
    with io.open(os.path.join(OUT, name), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def parse_poly(s):
    parts = []
    for part in s.split("||"):
        pts = []
        for chunk in part.split("|"):
            if not chunk.strip():
                continue
            x, y = chunk.strip().split()
            pts.append([round(float(x.replace(",", ".")) / 1000.0, 3), round(float(y.replace(",", ".")) / 1000.0, 3)])
        if len(pts) >= 3:
            parts.append(pts)
    return parts


def centroid(pts):
    a = cx = cy = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    a *= 0.5
    if abs(a) < 1e-9:
        return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
    return cx / (6 * a), cy / (6 * a)


walls_raw = read("walls.csv")
rooms_raw = read("rooms.csv")
struct_raw = read("structures.csv")
open_raw = read("openings.csv")

WALLS = []
wall_by_id = {}
for w in walls_raw:
    orient = "H" if abs(float(w["y2_мм"].replace(",", ".")) - float(w["y1_мм"].replace(",", "."))) < \
                    abs(float(w["x2_мм"].replace(",", ".")) - float(w["x1_мм"].replace(",", "."))) else "V"
    rec = {
        "id": w["id"],
        "x1": round(num(w["x1_мм"]) / 1000, 3),
        "y1": round(num(w["y1_мм"]) / 1000, 3),
        "x2": round(num(w["x2_мм"]) / 1000, 3),
        "y2": round(num(w["y2_мм"]) / 1000, 3),
        "thickness": round(num(w["толщина_мм"]) / 1000, 3),
        "loadBearing": w["тип"] != "перегородка",
        "name": (w["примечание"] or "").replace('"', "'"),
        "block": w["блок"],
        "kind": w["тип"],
        "orient": orient,
    }
    WALLS.append(rec)
    wall_by_id[w["id"]] = rec

ROOMS = []
for r in rooms_raw:
    polys = parse_poly(r["полигон_мм"])
    if not polys:
        continue
    # все части (полигоны) в метрах; крупнейшая — для подписи
    parts = polys
    big = max(parts, key=lambda p: abs(sum(
        p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))))
    cx, cy = centroid(big)
    area_decl = num(r["площадь_заявленная_м2"])
    area_calc = num(r["площадь_расчётная_м2"])
    rooms = {
        "id": r["id"],
        "premise": "1080" if r["блок"] == "A" else "1079",
        "num": (r["номер"] or "").strip() or "—",
        "name": (r["название"] or "").replace('"', "'"),
        "area": area_decl if area_decl else area_calc,
        "areaCalc": area_calc,
        "polygon": parts[0] if len(parts) == 1 else parts,
        "label": [round(cx, 2), round(cy, 2)],
        "centroid": [round(cx, 2), round(cy, 2)],
    }
    ROOMS.append(rooms)

STRUCTS = []
for s in struct_raw:
    polys = parse_poly(s["полигон_мм"])
    if not polys:
        continue
    STRUCTS.append({
        "id": s["id"],
        "name": (s["название"] or "").replace('"', "'"),
        "type": s["тип"],
        "polygon": polys[0] if len(polys) == 1 else polys,
    })

WINDOWS = []
for o in open_raw:
    if o["тип"] != "window":
        continue
    wid = o["стена_id"]
    wall = wall_by_id.get(wid)
    if not wall:
        continue
    cx = num(o["x_мм"]) / 1000
    cy = num(o["y_мм"]) / 1000
    wdt = num(o["ширина_мм"]) / 1000
    depth = 0.28
    if wall["orient"] == "H":
        rect = [round(cx - wdt / 2, 3), round(cy - depth / 2, 3), round(wdt, 3), round(depth, 3)]
    else:
        rect = [round(cx - depth / 2, 3), round(cy - wdt / 2, 3), round(depth, 3), round(wdt, 3)]
    WINDOWS.append({"id": o["id"], "rect": rect, "block": o["блок"]})

# габариты
xs = [v for w in WALLS for v in (w["x1"], w["x2"])]
ys = [v for w in WALLS for v in (w["y1"], w["y2"])]
for s in STRUCTS:
    polys = s["polygon"] if isinstance(s["polygon"][0], list) and isinstance(s["polygon"][0][0], list) else [s["polygon"]]
    for poly in polys:
        xs += [p[0] for p in poly]
        ys += [p[1] for p in poly]
MINX, MAXX = min(xs), max(xs)
MINY, MAXY = min(ys), max(ys)
wall_y = [w["y2"] for w in WALLS] + [w["y1"] for w in WALLS]
BUILDING = {
    "width": round(MAXX - MINX, 2),
    "height": round(MAXY - MINY, 2),
    "depth": round(max(wall_y) - 0.0, 2),
    "minX": round(MINX, 2),
    "minY": round(MINY, 2),
}

header = '''/* СГЕНЕРИРОВАНО автоматически из проверенной CSV-модели здания
   (out/walls.csv, out/rooms.csv, out/structures.csv, out/openings.csv).
   Система координат: метры, начало — внешний северо-западный угол пом. 1080 (блок A),
   X вправо (запад→восток), Y вниз (север→юг). Блок B (пом. 1079) уже смещён в общую систему. */

export type Pt = [number, number];

export interface RoomPoly {
  id: string;
  premise: '1080' | '1079';
  num: string;
  name: string;
  area: number | null;
  areaCalc: number | null;
  polygon: Pt[] | Pt[][];
  label: Pt;
  centroid: Pt;
}

export interface WallSeg {
  id: string;
  x1: number; y1: number; x2: number; y2: number;
  thickness: number;
  loadBearing: boolean;
  name: string;
  block: string;
  kind: string;
  orient: 'H' | 'V';
}

export interface ExtPoly { id: string; name: string; type: string; polygon: Pt[] | Pt[][]; }
export interface WindowRect { id: string; block: string; rect: [number, number, number, number]; }

'''

body = (
    "export const BUILDING = " + json.dumps(BUILDING, ensure_ascii=False) + ";\n\n"
    "export const WALLS: WallSeg[] = " + json.dumps(WALLS, ensure_ascii=False, indent=1) + ";\n\n"
    "export const ROOMS: RoomPoly[] = " + json.dumps(ROOMS, ensure_ascii=False, indent=1) + ";\n\n"
    "export const EXTERIOR_ENTRIES: ExtPoly[] = " + json.dumps(STRUCTS, ensure_ascii=False, indent=1) + ";\n\n"
    "export const WINDOWS: WindowRect[] = " + json.dumps(WINDOWS, ensure_ascii=False, indent=1) + ";\n"
)

with io.open(DEST, "w", encoding="utf-8") as f:
    f.write(header + body)

print("BUILDING:", BUILDING)
print("walls:", len(WALLS), "rooms:", len(ROOMS), "structures:", len(STRUCTS), "windows:", len(WINDOWS))
print("->", DEST)

