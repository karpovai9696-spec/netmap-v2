import cv2, numpy as np, json, math
from PIL import Image, ImageDraw

base = r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2"
img = cv2.imdecode(np.fromfile(base + r"\_plan_src.png", dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
H, W = img.shape
X0, Y0, X1, Y1 = 33, 223, 1026, 803
BW, BD = 36.81, 17.27
gray = img[Y0:Y1, X0:X1]
# бинаризация: линии чёрные
bw = (gray < 160).astype(np.uint8) * 255
# убрать мелкий шум
bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, np.ones((1, 1), np.uint8))

lines = cv2.HoughLinesP(bw, 1, np.pi / 360, threshold=18, minLineLength=16, maxLineGap=2)
hs, vs = [], []
for l in (lines if lines is not None else []):
    arr = np.array(l).reshape(-1)
    x1, y1, x2, y2 = map(float, arr[:4])
    if abs(y2 - y1) <= 1.5 and abs(x2 - x1) >= 16:
        if x1 > x2: x1, x2 = x2, x1
        hs.append([min(y1, y2), x1, x2])
    elif abs(x2 - x1) <= 1.5 and abs(y2 - y1) >= 16:
        if y1 > y2: y1, y2 = y2, y1
        vs.append([min(x1, x2), y1, y2])

def merge(lines, orient):
    # lines: [coord, a, b]; merge parallel segments close in coord and overlapping, then merge collinear intervals
    lines = sorted(lines, key=lambda t: (t[0], t[1]))
    clusters = []
    for c, a, b in lines:
        best = None
        for cl in clusters:
            cc = sum(cl["c"]) / len(cl["c"])
            if abs(c - cc) <= 2.5:
                ov = min(b, cl["b"]) - max(a, cl["a"])
                if ov >= -4:
                    best = cl; break
        if best is None:
            clusters.append({"c": [c], "a": a, "b": b})
        else:
            best["c"].append(c); best["a"] = min(best["a"], a); best["b"] = max(best["b"], b)
    # повторно слить пересекающиеся интервалы в одной полосе
    out = []
    for cl in clusters:
        c = sum(cl["c"]) / len(cl["c"])
        out.append([c, cl["a"], cl["b"]])
    out.sort(key=lambda t: (t[0], t[1]))
    merged = []
    for c, a, b in out:
        if merged and abs(c - merged[-1][0]) <= 2.0 and a - merged[-1][2] <= 2.0:
            merged[-1][1] = min(merged[-1][1], a); merged[-1][2] = max(merged[-1][2], b)
        else:
            merged.append([c, a, b])
    return [m for m in merged if m[2] - m[1] >= 14]

hm = merge(hs, True)
vm = merge(vs, False)

def to_m(px, py):
    return ((px) / (X1 - X0) * BW, (py) / (Y1 - Y0) * BD)

walls = []
for y, a, b in hm:
    x1, y1 = to_m(a, y); x2, y2 = to_m(b, y)
    walls.append({"x1": round(x1, 2), "y1": round(y1, 2), "x2": round(x2, 2), "y2": round(y2, 2)})
for x, a, b in vm:
    x1, y1 = to_m(x, a); x2, y2 = to_m(x, b)
    walls.append({"x1": round(x1, 2), "y1": round(y1, 2), "x2": round(x2, 2), "y2": round(y2, 2)})

print("raw h/v:", len(hs), len(vs), "merged:", len(hm), len(vm), "total:", len(walls))

# preview: red centerlines on source
im = Image.open(base + r"\_plan_src.png").convert("RGB")
dr = ImageDraw.Draw(im)
for w in walls:
    px1 = X0 + w["x1"] / BW * (X1 - X0); py1 = Y0 + w["y1"] / BD * (Y1 - Y0)
    px2 = X0 + w["x2"] / BW * (X1 - X0); py2 = Y0 + w["y2"] / BD * (Y1 - Y0)
    dr.line([(px1, py1), (px2, py2)], fill=(255, 0, 0), width=2)
im.save(base + r"\walls-extracted-preview.png")

json.dump(walls, open(base + r"\walls-extracted.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("saved preview + json")
