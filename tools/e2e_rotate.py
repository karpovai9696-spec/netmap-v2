"""Проверка переворота плана на 180°: вид, клики, сохранение."""
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8018/"
OUT = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2\preview-rotated.png"
results = []


def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra and not cond else ""))


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    page = b.new_page(viewport={"width": 1680, "height": 1000})
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(2600)
    check("нет ошибок", len(errs) == 0, errs[:3])

    t0 = page.evaluate("document.querySelector('svg g[transform]').getAttribute('transform')")
    check("исходно без поворота", "rotate(0" in t0 or "rotate(0 " in t0, t0[:120])

    # включаем переворот
    page.locator('button[title^="Перевернуть"]').click()
    page.wait_for_timeout(700)
    t1 = page.evaluate("document.querySelector('svg g[transform]').getAttribute('transform')")
    check("поворот 180° применён", "rotate(180" in t1, t1[:160])
    page.screenshot(path=OUT)

    # клик по точке в повёрнутом виде должен попасть в те же мировые координаты
    target = (7.0, 9.0)
    pt = page.evaluate(f"window.__netmapV2.screenOf({target[0]}, {target[1]})")
    page.locator('button[title^="Узел"]').click()
    page.wait_for_timeout(200)
    page.mouse.click(pt["x"], pt["y"])
    page.wait_for_timeout(500)
    node = page.evaluate("window.__netmapV2.state().nodes.slice(-1)[0]")
    ok = abs(node["x"] - target[0]) < 0.2 and abs(node["y"] - target[1]) < 0.2
    check("клик в повёрнутом плане попадает куда нужно", ok, (node["x"], node["y"], target))

    # сохранение поворота после перезагрузки
    page.wait_for_timeout(1200)
    page.reload(wait_until="load")
    page.wait_for_timeout(2600)
    t2 = page.evaluate("document.querySelector('svg g[transform]').getAttribute('transform')")
    check("поворот сохранился после перезагрузки", "rotate(180" in t2, t2[:160])
    state = page.evaluate("window.__netmapV2.state()")
    check("узел сохранился", any(abs(n["x"] - target[0]) < 0.2 and abs(n["y"] - target[1]) < 0.2 for n in state["nodes"]))

    # выключаем обратно через клавишу R
    page.keyboard.press("r")
    page.wait_for_timeout(600)
    t3 = page.evaluate("document.querySelector('svg g[transform]').getAttribute('transform')")
    check("клавиша R возвращает исходную ориентацию", "rotate(0" in t3, t3[:120])

    b.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} проверок пройдено")
sys.exit(1 if fails else 0)
