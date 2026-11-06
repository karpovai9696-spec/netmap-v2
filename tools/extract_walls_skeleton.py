import cv2, numpy as np, json
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize

base = r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2"
img = cv2.imdecode(np.fromfile(base + r"\_plan_src.png", dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
X0, Y0, X1, Y1 = 33, 223, 1026, 803
BW, BD = 36.81, 17.27
gray = img[Y0:Y1, X0:X1]
binary = ((gray < 200) * 255).astype(np.uint8)
# оставляем только толстые линии (стены), тонкие двери/окна/размеры — прочь
walls_mask = cv2.morphologyEx(binary, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
# лёгкое закрытие разрывов по толщине стены
walls_mask = cv2.morphologyEx(walls_mask, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8))
skel = skeletonize(walls_mask > 0).astype(np.uint8) * 255
# убираем перекрёстки, чтобы получить отдельные сегменты
k = np.array([[1, 1, 1], [1, 10, 1], [1, 1, 1]], dtype=np.uint8)
neigh = cv2.filter2D((skel // 255).astype(np.uint8), -1, k)
seg = skel.copy()
seg[neigh > 12] = 0
cnts, _ = cv2.findContours(seg, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
walls = []
for c in cnts:
    if cv2.arcLength(c, False) < 12:
        continue
    ap = cv2.approxPolyDP(c, 2.5, False).reshape(-1, 2)
    for i in range(len(ap) - 1):
        x1, y1 = map(float, ap[i]); x2, y2 = map(float, ap[i + 1])
        dx, dy = abs(x2 - x1), abs(y2 - y1)
        if dx < 8 and dy < 8:
            continue
        # ортогонализация
        if dx > dy and dy / (dx + 1e-6) < 0.1:
            y = (y1 + y2) / 2; y1 = y2 = y
        elif dy > dx and dx / (dy + 1e-6) < 0.1:
            x = (x1 + x2) / 2; x1 = x2 = x
        if max(abs(x2 - x1), abs(y2 - y1)) < 8:
            continue
        # толщина по distance transform
        dt = cv2.distanceTransform(walls_mask, cv2.DIST_L2, 5)
        n = max(int(np.hypot(x2 - x1, y2 - y1)), 2)
        xs = np.linspace(x1, x2, n).astype(int).clip(0, X1 - X0 - 1)
        ys = np.linspace(y1, y2, n).astype(int).clip(0, Y1 - Y0 - 1)
        thp = float(np.median(dt[ys, xs])) * 2
        walls.append([x1, y1, x2, y2, thp])

# объединяем коллинеарные близкие
def merge_lines(lines):
    out = []
    for w in lines:
        x1, y1, x2, y2, thp = w
        horiz = abs(y2 - y1) < 0.5
        vert = abs(x2 - x1) < 0.5
        merged = False
        for o in out:
            ox1, oy1, ox2, oy2, oth = o
            ohoriz = abs(oy2 - oy1) < 0.5
            overt = abs(ox2 - ox1) < 0.5
            if horiz and ohoriz and abs(y1 - oy1) <= 2:
                a1, b1 = sorted((x1, x2)); a2, b2 = sorted((ox1, ox2))
                if min(b1, b2) + 4 >= max(a1, a2):
                    o[0], o[2] = min(a1, a2), max(b1, b2)
                    o[1] = o[3] = (y1 + oy1) / 2
                    o[4] = max(thp, oth); merged = True; break
            if vert and overt and abs(x1 - ox1) <= 2:
                a1, b1 = sorted((y1, y2)); a2, b2 = sorted((oy1, oy2))
                if min(b1, b2) + 4 >= max(a1, a2):
                    o[1], o[3] = min(a1, a2), max(b1, b2)
                    o[0] = o[2] = (x1 + ox1) / 2
                    o[4] = max(thp, oth); merged = True; break
        if not merged:
            out.append(w[:])
    return out

walls = merge_lines(walls)
def to_w(x, y):
    return round(x / (X1 - X0) * BW, 2), round(y / (Y1 - Y0) * BD, 2)

result = []
for x1, y1, x2, y2, thp in walls:
    if max(abs(x2 - x1), abs(y2 - y1)) < 10:
        continue
    a = to_w(x1, y1); b = to_w(x2, y2)
    th = max(0.08, min(0.5, round((thp if thp > 2 else 4) * BD / (Y1 - Y0), 2)))
    result.append({"x1": a[0], "y1": a[1], "x2": b[0], "y2": b[1], "thickness": th})

print("skeleton segments:", len(result))
im = Image.open(base + r"\_plan_src.png").convert("RGB"); dr = ImageDraw.Draw(im)
for w in result:
    p1 = (X0 + w["x1"] / BW * (X1 - X0), Y0 + w["y1"] / BD * (Y1 - Y0))
    p2 = (X0 + w["x2"] / BW * (X1 - X0), Y0 + w["y2"] / BD * (Y1 - Y0))
    dr.line([p1, p2], fill=(255, 0, 0), width=2)
im.save(base + r"\walls-skeleton-preview.png")
json.dump(result, open(base + r"\walls-skeleton.json", "w", encoding="utf-8"), indent=1)
