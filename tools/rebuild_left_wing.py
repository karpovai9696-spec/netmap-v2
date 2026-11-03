"""Перестройка левого крыла (пом. 1080) по актуальному плану БТИ (13 помещений).

Источник: скан kyoScan-11.3.2026-15.50.11.pdf (стр. 1, 1:100), повёрнутый в читаемую
ориентацию (plan1080_new_upright.png). Комнаты 1-9 и 12 получены сегментацией,
10/11/13 заданы прямоугольниками по размерам с плана.

Результат: заменяем строки блока A в out/*.csv, блок B не трогаем.
"""
import csv
import io
import json
import os
import re

ROOT = r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace"
OUT = os.path.join(ROOT, "out")
AUTO = os.path.join(ROOT, "netmap-v2", "tools", "plan1080_rooms.json")

# внешние габариты плана (пиксели 300dpi, читаемая ориентация) -> мм старого конверта A
X0, X1 = 430.0, 2000.0
Y0, Y1 = 935.0, 2700.0
W_MM, H_MM = 15631.0, 16925.0
Y_OFF = 349.0
SX = W_MM / (X1 - X0)
SY = H_MM / (Y1 - Y0)

DECLARED = {
    1: 15.7, 2: 16.6, 3: 20.7, 4: 17.9, 5: 11.7, 6: 1.4, 7: 20.6,
    8: 12.8, 9: 11.6, 10: 2.3, 11: 2.5, 12: 31.2, 13: 11.6,
}

# ручные прямоугольники (x0,y0,x1,y1) в пикселях плана
MANUAL = {
    4: [(1567, 1569), (1963, 1569), (1963, 2035), (1567, 2035)],
    6: [(1850, 2210), (1963, 2210), (1963, 2350), (1850, 2350)],
    7: [(1435, 2350), (1850, 2350), (1850, 2210), (1963, 2210), (1963, 2690), (1435, 2690)],
    10: [(955, 1690), (1075, 1690), (1075, 1900), (955, 1900)],
    11: [(1075, 1690), (1250, 1690), (1250, 1845), (1075, 1845)],
    13: [(450, 2190), (760, 2190), (760, 2620), (450, 2620)],
}

PORCH = [(430, 2700), (980, 2700), (980, 3060), (430, 3060)]


def to_mm(pt):
    x, y = pt
    return (round((x - X0) * SX, 1), round((y - Y0) * SY + Y_OFF, 1))


def poly_area_m2(poly):
    a = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2 / 1e6


def centroid(poly):
    a = cx = cy = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    a *= 0.5
    if abs(a) < 1e-9:
        return (sum(p[0] for p in poly) / n, sum(p[1] for p in poly) / n)
    return (cx / (6 * a), cy / (6 * a))


# ------------------------------- комнаты -------------------------------------
auto = json.load(io.open(AUTO, encoding="utf-8"))
rooms_px = {}
for k, v in auto.items():
    rooms_px[int(k)] = [tuple(p) for p in v["poly"]]
for k, poly in MANUAL.items():
    rooms_px[k] = poly

rooms = {}
for num, poly in rooms_px.items():
    poly_mm = [to_mm(p) for p in poly]
    rooms[num] = {
        "poly": poly_mm,
        "area_calc": round(poly_area_m2(poly_mm), 1),
        "label": to_mm(centroid(poly)),
    }

# ------------------------------- стены ---------------------------------------
def edges(poly):
    out = []
    for i in range(len(poly)):
        a = poly[i]
        b = poly[(i + 1) % len(poly)]
        if abs(a[0] - b[0]) < 1 or abs(a[1] - b[1]) < 1:
            out.append((a, b))
    return out


raw = []
for num, poly in rooms.items():
    for a, b in edges(poly["poly"]):
        if abs(a[1] - b[1]) < 1:  # горизонтальная
            x1, x2 = sorted((a[0], b[0]))
            raw.append(("H", round((a[1] + b[1]) / 2), x1, x2))
        elif abs(a[0] - b[0]) < 1:
            y1, y2 = sorted((a[1], b[1]))
            raw.append(("V", round((a[0] + b[0]) / 2), y1, y2))

# объединение коллинеарных близких отрезков
TOL = 180  # мм
merged = []
for orient, pos, s, e in raw:
    placed = False
    for m in merged:
        if m[0] == orient and abs(m[1] - pos) <= TOL and not (e < m[2] - TOL or s > m[3] + TOL):
            m[1] = round((m[1] + pos) / 2)
            m[2] = min(m[2], s)
            m[3] = max(m[3], e)
            placed = True
            break
    if not placed:
        merged.append([orient, pos, s, e])

walls = []
for i, (orient, pos, s, e) in enumerate(merged, 1):
    if e - s < 300:
        continue
    # наружная, если проходит по границе конверта
    exterior = (orient == "H" and (pos < 1200 or pos > H_MM - 1200)) or (
        orient == "V" and (pos < 1200 or pos > W_MM - 1200)
    )
    if orient == "H":
        x1, y1, x2, y2 = s, pos, e, pos
    else:
        x1, y1, x2, y2 = pos, s, pos, e
    walls.append(
        {
            "id": f"A-W{i:03d}",
            "type": "наружная стена" if exterior else "перегородка",
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "thickness": 400 if exterior else 120,
            "name": ("Наружная стена" if exterior else "Перегородка") + f" {i}",
        }
    )

# ------------------------------- структуры -----------------------------------
porch_mm = [to_mm(p) for p in PORCH]
structs = [{"id": "A-S01", "type": "porch", "name": "Крыльцо (по актуальному плану 1080)", "poly": porch_mm}]

# ------------------------------- запись CSV ----------------------------------
def read_csv(name):
    with io.open(os.path.join(OUT, name), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def write_csv(name, rows, fields):
    tmp = os.path.join(OUT, name + ".tmp")
    with io.open(tmp, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, delimiter=";")
        w.writeheader()
        w.writerows(rows)
    os.replace(tmp, os.path.join(OUT, name))


# rooms.csv
rows = [r for r in read_csv("rooms.csv") if r["блок"] != "A"]
for num in sorted(rooms):
    r = rooms[num]
    poly_str = " | ".join(f"{x:.1f} {y:.1f}" for x, y in r["poly"])
    rows.append(
        {
            "id": f"A-R{num:02d}",
            "уровень": "1",
            "блок": "A",
            "номер": str(num),
            "название": f"Помещение {num}",
            "площадь_заявленная_м2": str(DECLARED.get(num, "")).replace(".", ","),
            "площадь_расчётная_м2": str(r["area_calc"]).replace(".", ","),
            "центроид_x_мм": f'{r["label"][0]:.1f}',
            "центроид_y_мм": f'{r["label"][1]:.1f}',
            "полигон_мм": poly_str,
        }
    )
write_csv(
    "rooms.csv",
    rows,
    ["id", "уровень", "блок", "номер", "название", "площадь_заявленная_м2",
     "площадь_расчётная_м2", "центроид_x_мм", "центроид_y_мм", "полигон_мм"],
)

# walls.csv
rows = [r for r in read_csv("walls.csv") if r["блок"] != "A"]
for w in walls:
    rows.append(
        {
            "id": w["id"], "уровень": "1", "блок": "A", "тип": w["type"],
            "x1_мм": f'{w["x1"]:.1f}', "y1_мм": f'{w["y1"]:.1f}',
            "x2_мм": f'{w["x2"]:.1f}', "y2_мм": f'{w["y2"]:.1f}',
            "толщина_мм": str(w["thickness"]), "высота_мм": "3960",
            "слой": "WALLS-EXT" if w["type"] == "наружная стена" else "WALLS-INT",
            "примечание": w["name"],
        }
    )
write_csv(
    "walls.csv",
    rows,
    ["id", "уровень", "блок", "тип", "x1_мм", "y1_мм", "x2_мм", "y2_мм",
     "толщина_мм", "высота_мм", "слой", "примечание"],
)

# structures.csv
rows = [r for r in read_csv("structures.csv") if r["блок"] != "A"]
for s in structs:
    poly = " | ".join(f"{x:.1f} {y:.1f}" for x, y in s["poly"])
    rows.append(
        {"id": s["id"], "уровень": "1", "блок": "A", "тип": s["type"],
         "название": s["name"], "полигон_мм": poly, "слой": "STRUCTURES"}
    )
write_csv(
    "structures.csv",
    rows,
    ["id", "уровень", "блок", "тип", "название", "полигон_мм", "слой"],
)

# openings.csv — убрать окна блока A (у нового плана другая разметка)
rows = [r for r in read_csv("openings.csv") if r["блок"] != "A"]
write_csv(
    "openings.csv",
    rows,
    ["id", "уровень", "блок", "стена_id", "тип", "x_мм", "y_мм", "смещение_по_стене_мм",
     "ширина_мм", "высота_мм", "подоконник_мм", "слой", "примечание"],
)

print(f"Комнат A: {len(rooms)}, стен A: {len(walls)}, структур A: {len(structs)}")
print("Площади:", {n: (DECLARED.get(n), rooms[n]['area_calc']) for n in sorted(rooms)})
print("Сумма заявленных:", round(sum(DECLARED.values()), 1))
