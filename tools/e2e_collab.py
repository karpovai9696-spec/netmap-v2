"""E2E: вход по паролю, роли, совместное редактирование в реальном времени."""
import json
import sys
import random
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "http://192.168.1.227:8092/"
MIKHAIL = ("mikhail", "RRbpC6tpgVaRP6")
EDUARD = ("eduard", "B2FfPrsNenddWE")
results = []


def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra and not cond else ""))


def login(page, creds, expect_error=""):
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(1800)
    page.fill('input[placeholder="mikhail"]', creds[0])
    page.fill('input[type="password"]', creds[1])
    page.click('button[type="submit"]')
    page.wait_for_timeout(2500)


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)

    # --- 1. неверный пароль ---
    ctx = b.new_context(viewport={"width": 1680, "height": 1000})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" and "401" not in m.text else None)
    login(page, ("mikhail", "wrong-password"))
    check("неверный пароль не пускает", page.locator('input[type="password"]').count() > 0 or "Неверный" in page.content())
    check("показана ошибка входа", "Неверный логин или пароль" in page.content())

    # --- 2. вход Михаила (админ) ---
    login(page, MIKHAIL)
    page.wait_for_timeout(2000)
    check("админ вошёл", page.locator('button[title*="участники"]').count() > 0)
    counts_a = page.evaluate("window.__netmapV2.counts()")
    print("admin counts:", counts_a)
    check("план загружен и засеян (63 стены)", counts_a["walls"] == 63, counts_a)
    page.screenshot(path=r"C:\Users\Сисадмин\Documents\deepseek-harness\default-workspace\netmap-v2\screenshot-admin.png")

    # --- 3. вход Эдуарда (инженер) ---
    ctx2 = b.new_context(viewport={"width": 1680, "height": 1000})
    page2 = ctx2.new_page()
    errs2 = []
    page2.on("pageerror", lambda e: errs2.append(str(e)))
    page2.on("console", lambda m: errs2.append(m.text) if m.type == "error" and "401" not in m.text else None)
    login(page2, EDUARD)
    page2.wait_for_timeout(2500)
    check("инженер вошёл", page2.locator('button[title*="участники"]').count() > 0)
    check("инженер видит общий план", page2.evaluate("window.__netmapV2.counts().walls") == 63)
    check("у инженера «Узел» заблокирован", page2.locator('button:has-text("Узел")').is_disabled())
    check("у инженера «Перегородка» доступна", not page2.locator('button:has-text("Перегородка")').is_disabled())
    check("у инженера пометка «только просмотр»", "сеть только для просмотра" in page2.content())
    check("в шапке виден второй участник", "Эдуард" in page.content() and "Михаил" in page2.content())

    # --- 4. админ добавляет узел -> инженер видит ---
    nodes_before = page2.evaluate("window.__netmapV2.counts().nodes")
    rndx, rndy = random.uniform(4.0, 8.0), random.uniform(6.0, 12.0)
    pt = page.evaluate(f"window.__netmapV2.screenOf({rndx}, {rndy})")
    page.locator('button[title^="Узел"]').click()
    page.wait_for_timeout(200)
    page.mouse.click(pt["x"], pt["y"])
    page.wait_for_timeout(1200)
    nodes_after = page2.evaluate("window.__netmapV2.counts().nodes")
    check("изменение админа прилетело инженеру", nodes_after == nodes_before + 1, (nodes_before, nodes_after))

    # --- 5. инженер ставит пометку -> админ видит ---
    notes_before = page.evaluate("window.__netmapV2.counts()['notes']") if "notes" in page.evaluate("window.__netmapV2.counts()") else None
    if notes_before is None:
        notes_before = len(page.evaluate("window.__netmapV2.state().notes"))
    rndx2, rndy2 = random.uniform(18.0, 34.0), random.uniform(2.0, 15.0)
    pt2 = page2.evaluate(f"window.__netmapV2.screenOf({rndx2}, {rndy2})")
    page2.locator('button[title^="Текст"]').click()
    page2.wait_for_timeout(200)
    page2.mouse.click(pt2["x"], pt2["y"])
    page2.wait_for_timeout(1500)
    notes_after = len(page.evaluate("window.__netmapV2.state().notes"))
    check("изменение инженера прилетело админу", notes_after == notes_before + 1, (notes_before, notes_after))

    # --- 6. курсор коллеги ---
    page.mouse.move(800, 500)
    page.wait_for_timeout(1200)
    page2.wait_for_timeout(800)
    check("курсор Михаила виден у Эдуарда", page2.locator('div:has-text("Михаил")').count() >= 1)

    # --- 7. перезагрузка инженера: общий проект на месте ---
    page2.reload(wait_until="load")
    page2.wait_for_timeout(3000)
    check("после перезагрузки проект общий", page2.evaluate("window.__netmapV2.counts().walls") == 63)
    check("после перезагрузки видны оба", "Михаил" in page2.content())

    print("errors admin:", errs[:3])
    print("errors engineer:", errs2[:3])
    check("нет JS-ошибок", len(errs) == 0 and len(errs2) == 0, (errs[:2], errs2[:2]))

    b.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} проверок пройдено")
if fails:
    print("ПРОВАЛЫ:")
    for f in fails:
        print(" -", f[0], f[2])
sys.exit(1 if fails else 0)
