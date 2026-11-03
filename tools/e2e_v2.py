"""E2E-проверка нового React-UI (v2): корректный план, слои, инструменты, сохранение."""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8018/"
OUT = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2\preview-final-dark.png"
results = []


def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra and not cond else ""))


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    ctx = b.new_context(viewport={"width": 1680, "height": 1000}, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(2600)
    check("приложение загрузилось (API)", page.evaluate("typeof window.__netmapV2 === 'object'"))
    check("нет JS-ошибок", len(errors) == 0, errors[:3])

    c0 = page.evaluate("window.__netmapV2.counts()")
    print("counts:", c0)
    check("проверенный план: 63 стены", c0["walls"] == 63, c0)
    check("полигоны помещений на холсте", page.evaluate("document.querySelectorAll('svg polygon').length") >= 20)
    check("тёмная тема по умолчанию", page.evaluate("document.querySelector('#root > div').classList.contains('dark')"))
    check("шапка: стиль визитки (K)", page.evaluate("document.querySelector('header').innerText.includes('K')"))

    # размещение узла
    page.locator('button[title^="Узел"]').click()
    page.wait_for_timeout(300)
    pt = page.evaluate("window.__netmapV2.screenOf(6.0, 9.0)")
    page.mouse.click(pt["x"], pt["y"])
    page.wait_for_timeout(500)
    c1 = page.evaluate("window.__netmapV2.counts()")
    check("узел добавлен кликом", c1["nodes"] == c0["nodes"] + 1, (c0["nodes"], c1["nodes"]))

    # кабель между двумя узлами
    page.locator('button[title^="Кабель"]').click()
    page.wait_for_timeout(300)
    nodes = page.evaluate("window.__netmapV2.state().nodes.slice(0,2).map(n=>[n.x,n.y])")
    a = page.evaluate(f"window.__netmapV2.screenOf({nodes[0][0]}, {nodes[0][1]})")
    page.mouse.click(a["x"], a["y"])
    page.wait_for_timeout(300)
    bb = page.evaluate(f"window.__netmapV2.screenOf({nodes[1][0]}, {nodes[1][1]})")
    page.mouse.click(bb["x"], bb["y"])
    page.wait_for_timeout(500)
    c2 = page.evaluate("window.__netmapV2.counts()")
    check("кабель проложен между узлами", c2["cables"] == c0["cables"] + 1, (c0["cables"], c2["cables"]))

    # автосохранение -> перезагрузка
    page.wait_for_timeout(1200)
    page.reload(wait_until="load")
    page.wait_for_timeout(2600)
    c3 = page.evaluate("window.__netmapV2.counts()")
    check("состояние сохранилось в localStorage", c3["nodes"] == c2["nodes"] and c3["cables"] == c2["cables"], (c2, c3))

    # экспорт JSON
    page.locator('header button:has-text("Экспорт")').click()
    page.wait_for_timeout(300)
    with page.expect_download(timeout=15000) as dl:
        page.locator('button:has-text("Сохранить проект (JSON)")').click()
    f = dl.value
    data = json.load(open(f.path(), encoding="utf-8"))
    check("JSON-экспорт: полный проект", data.get("version") == 2 and isinstance(data.get("nodes"), list) and isinstance(data.get("walls"), list), list(data.keys())[:6])
    check("JSON-экспорт: 63 стены", len(data.get("walls", [])) == 63, len(data.get("walls", [])))

    # импорт JSON (меняем заголовок)
    data["projectTitle"] = "ИМПОРТ-ТЕСТ"
    tmp = os.path.join(os.environ.get("TEMP", "."), "netmap_v2_import.json")
    json.dump(data, open(tmp, "w", encoding="utf-8"), ensure_ascii=False)
    page.locator('header button:has-text("Экспорт")').click()
    page.wait_for_timeout(200)
    page.locator('button:has-text("Загрузить проект (JSON)")').click()
    page.locator('input[type=file]').set_input_files(tmp)
    page.wait_for_timeout(1200)
    title = page.evaluate("window.__netmapV2.state().projectTitle")
    check("импорт JSON восстановил проект", title == "ИМПОРТ-ТЕСТ", title)

    # светлая тема
    page.locator('header button[title*="тема"]').first.click()
    page.wait_for_timeout(800)
    check("переключение на светлую тему", not page.evaluate("document.querySelector('#root > div').classList.contains('dark')"))
    page.screenshot(path=OUT.replace("final-dark", "final-light"))
    # обратно тёмная
    page.locator('header button[title*="тема"]').first.click()
    page.wait_for_timeout(800)
    page.screenshot(path=OUT)

    # скриншот светлой/тёмной и финал
    b.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} проверок пройдено")
if fails:
    print("ПРОВАЛЫ:")
    for f in fails:
        print(" -", f[0], f[2])
sys.exit(1 if fails else 0)
