#!/usr/bin/env python3
"""Tooling-Shop in allen Sprachfassungen (Nutzer 2026-10-15: »mach beides« – Schaufenster auf der Webseite,
bestellt wird in MYZOLLER).

Bisher führte »Tooling-Shop« auf jeder Länderseite direkt in den alten Shop auf myzoller.com, die Kategorie-Karten auf
Solutions › Werkzeugaufnahmen trugen maschinell übersetzte Namen (»Morse code recordings«, »Weldona-bilder« …).
Texte aller Sprachen stehen in content/tooling.json. Für jede Sprachfassung (content/pages und
content/sites/<src>/pages) schreibt das Skript:
  - die Seite <Werkzeugaufnahmen>/tooling-shop (de_path /produkte/werkzeugaufnahmen/tooling-shop): Kopf, Finder
    (Block »toolfinder«), Sortiment mit 13 Kategorien, Bestellablauf (Block »steps«), Qualität (Hotspots von
    Solutions › Werkzeugaufnahmen), »idChip« & digitaler Zwilling, FAQ, Broschüren aus dem Info-Pool
  - den Menüeintrag unter Produkte › Werkzeugaufnahmen (richtiger Name statt »Atelier d'outillage«, »Verktygsverkstad« …)
  - die Karte »Tooling-Shop« auf der Übersicht Werkzeugaufnahmen
  - die Kategorie-Karten auf Solutions › Werkzeugaufnahmen: korrekte Namen und Texte, Link direkt in die Kategorie im Shop

Shop-Links schreiben die Seiten als »myzoller:/shop?kind=tooling&category=…«; build.py macht daraus die Adresse aus
content/tooling.json (shop.base) samt Sprache. Alte Links auf myzoller.com/…/shop/tooling biegt build.py ebenfalls um.
Wiederholbar – nach einem Neuabzug der zoller.info-Inhalte einfach erneut ausführen:

    python3 tools/tooling.py
"""
import copy
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from idchip import dump, folder, link, load_pages, norm, sources, walk  # noqa: E402

CFG = json.load(open(os.path.join(ROOT, "content", "tooling.json"), encoding="utf-8"))
DE_PATH = "/produkte/werkzeugaufnahmen/tooling-shop"
SHOP = "myzoller:/shop?kind=tooling"
REGISTER = "myzoller:/registrieren?weiter=%2Fshop%3Fkind%3Dtooling"
OLD = re.compile(r"^https?://(?:www\.)?myzoller\.com/[^#?]*/shop/tooling/?(?:[#?].*)?$", re.I)
DOWNLOADS = re.compile(r"Broschuere_Tooling|Tooling_Solutions_Hawk|Tooling_Solutions_Spannzangenfutter", re.I)
BY_IMG = {c["img"]["src"]: c for c in CFG["categories"]}
SPACE = {"before": "default", "after": "default"}
esc = lambda s: html.escape(s, quote=False)  # noqa: E731


def is_shop(href, src):
    h = href or ""
    return bool(OLD.match(h)) or h.startswith("myzoller:/shop") or norm(h, src).endswith("/tooling-shop")


def cat_href(key):
    return f"{SHOP}&category={key}"


def caption(T, key):
    name, desc = T["cats"][key]
    return f"<figcaption> <h3>{esc(name)}</h3> <p>{esc(desc)}</p> </figcaption>"


def textmedia(**kw):
    b = {"type": "textmedia", "header": "", "body": "", "images": [], "videos": [], "pos": "text", "cols": 1, "valign": "top", "bg": "", "space": SPACE}
    b.update(kw)
    return b


def page_for(src, pages, T, new_path):
    cards = [dict(c["img"], alt=T["cats"][c["key"]][0], title=T["cats"][c["key"]][0], href=cat_href(c["key"]), caption=caption(T, c["key"]))
             for c in CFG["categories"]]
    blocks = [
        {"type": "product_header", "title": T["title"], "id": "tooling-header", "bg": "", "space": SPACE,
         "text": f'<p>{esc(T["claim"])}</p> <p><a class="btn" href="#finder">{esc(T["b_find"])}</a> '
                 f'<a class="btn btn--ghost" href="{SHOP}" target="_blank" rel="noopener">{esc(T["b_shop"])}</a></p>',
         "img": dict(CFG["header_img"], alt=T["alt"])},
        {"type": "toolfinder", "id": "finder", "bg": "lightgray", "space": SPACE,
         "header": f'<h2>{esc(T["h_finder"])}</h2>', "intro": f'<p>{esc(T["p_finder"])}</p>',
         "t": {k: T[k] for k in ("s1", "s2", "s2_none", "all_cats", "all_ifaces", "cta", "note")},
         "cats": [{"key": c["key"], "name": T["cats"][c["key"]][0], "iface": c["iface"]} for c in CFG["categories"]],
         "ifaces": CFG["interfaces"]},
        textmedia(id="sortiment", header=f'<h2>{esc(T["h_cats"])}</h2>', body=f'<p>{esc(T["p_cats"])}</p>', images=cards, pos="below", cols=3),
        {"type": "steps", "id": "bestellen", "bg": "black", "space": SPACE, "header": f'<h2>{esc(T["h_order"])}</h2>',
         "items": [{"title": T[f"o{i}t"], "text": T[f"o{i}"]} for i in range(1, 5)],
         "actions": [{"label": T["b_shop"], "href": SHOP}, {"label": T["b_register"], "href": REGISTER, "ghost": True}]},
    ]
    # Qualität: die Hotspot-Grafik von Solutions › Werkzeugaufnahmen dieser Sprachfassung (Texte dort schon korrigiert)
    sol = pages.get("/solutions/werkzeugaufnahmen")
    hot = next((b for b in sol[1]["blocks"] if b.get("type") == "hotspots"), None) if sol else None
    if hot:
        blocks.append(dict(copy.deepcopy(hot), id="qualitaet", bg="", space=SPACE))
    idchip = pages.get("/produkte/werkzeugaufnahmen/idchip")
    more = f' <p><a class="btn" href="{link(src, idchip[1]["path"].rstrip("/"))}">{esc(T["l_idchip"])}</a></p>' if idchip else ""
    blocks.append(textmedia(id="idchip", header=f'<h2>{esc(T["h_system"])}</h2>', body=f'<p>{esc(T["p_system1"])}</p> <p>{esc(T["p_system2"])}</p>{more}',
                            images=[dict(CFG["system_img"], alt=T["alt"])], pos="right", valign="center", bg="lightgray"))
    blocks.append({"type": "accordion", "id": "faq", "bg": "", "space": SPACE, "header": f'<h2>{esc(T["h_faq"])}</h2>',
                   "items": [{"title": T[f"q{i}"], "blocks": [textmedia(body=f'<p>{esc(T[f"a{i}"])}</p>', space={})]} for i in range(1, 7)]})
    # Broschüren aus dem Info-Pool Werkzeugaufnahmen der Sprachfassung (Tooling, HAWK EYE®, ER)
    files, seen = [], set()
    pool = pages.get("/solutions/werkzeugaufnahmen/info-pool")
    for b in (pool[1]["blocks"] if pool else []):
        for f in b.get("files", []) if b.get("type") == "downloads" else []:
            if DOWNLOADS.search(f.get("href", "")) and f["href"] not in seen:
                seen.add(f["href"])
                files.append(f)
    if files:
        blocks.append({"type": "downloads", "id": "downloads", "bg": "lightgray", "space": SPACE, "header": f'<h2>{esc(T["h_dl"])}</h2>', "files": files})
    page = {"path": new_path, "url": link(src, new_path), "title": T["title"], "description": T["desc"], "og_image": CFG["header_img"]["src"],
            "breadcrumb": [], "languages": [], "blocks": blocks}
    if src:
        page["src_path"] = link(src, new_path)
        page["de_path"] = DE_PATH
    return page


def fr_typo(o):
    """Französische Typografie: geschütztes Leerzeichen vor : ? ! (nicht in Links/IDs)."""
    if isinstance(o, dict):
        return {k: (v if k in ("href", "src", "id", "key", "type") else fr_typo(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [fr_typo(v) for v in o]
    return re.sub(r" ([:?!])(?=\s|<|$)", " \\1", o) if isinstance(o, str) else o


def main():
    for src in sources():
        lang = CFG["lang_of_src"][src]
        T = CFG["texts"][lang]
        pages = load_pages(src)
        if "/produkte/werkzeugaufnahmen" not in pages:
            print(f"{src or 'de'}: keine Seite Werkzeugaufnahmen – übersprungen")
            continue
        wa_file, wa = pages["/produkte/werkzeugaufnahmen"]
        new_path = wa["path"].rstrip("/") + "/tooling-shop"
        href = link(src, new_path)
        page = page_for(src, pages, T, new_path)
        if lang == "fr":
            page = fr_typo(page)
        dump(wa_file[:-len(".json")] + "__tooling-shop.json", page)

        # Menü: Eintrag unter Produkte › Werkzeugaufnahmen (und jeder andere Menülink auf den alten Shop)
        nav_file = os.path.join(folder(src), "nav.json")
        nav = json.load(open(nav_file, encoding="utf-8"))
        n_nav = 0
        for part in ("main", "meta", "footer_links"):
            for n in walk(nav.get(part, [])) if isinstance(nav.get(part), list) else []:
                if is_shop(n.get("href"), src):
                    n.update(label=T["title"], href=href)
                    if "claim" in n:
                        n["claim"] = T["nav_claim"]
                    n_nav += 1
        dump(nav_file, nav)

        # Übersicht Werkzeugaufnahmen: Karte »Tooling-Shop« zeigt auf die neue Seite
        n_card = 0
        for b in wa["blocks"]:
            for row in b.get("rows", []) if b.get("type") == "productlist" else []:
                for it in row.get("items", []):
                    if is_shop(it.get("href"), src):
                        it.update(href=href, title=T["title"])
                        n_card += 1
        if n_card:
            dump(wa_file, wa)

        # Solutions › Werkzeugaufnahmen: Kategorie-Karten mit korrekten Namen, direkt in die Kategorie im Shop
        n_cat = 0
        if "/solutions/werkzeugaufnahmen" in pages:
            sol_file, sol = pages["/solutions/werkzeugaufnahmen"]
            for b in sol["blocks"]:
                for im in b.get("images", []) if b.get("type") == "textmedia" else []:
                    c = BY_IMG.get(im.get("src"))
                    if c and (is_shop(im.get("href"), src) or "category" in (im.get("href") or "")):
                        name = T["cats"][c["key"]][0]
                        cap = caption(T, c["key"])
                        im.update(title=name, alt=name, href=cat_href(c["key"]), caption=fr_typo(cap) if lang == "fr" else cap)
                        n_cat += 1
            if n_cat:
                dump(sol_file, sol)
        print(f"{src or 'de':6s} {lang:6s} {new_path}  Menü: {n_nav}  Karte: {n_card}  Kategorien: {n_cat}  "
              f"Abschnitte: {len(page['blocks'])}")


if __name__ == "__main__":
    main()
