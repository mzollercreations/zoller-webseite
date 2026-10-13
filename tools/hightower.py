#!/usr/bin/env python3
"""»highTower« als eigenes Produkt in allen Sprachfassungen, mit Tablar-Rechner (Nutzer 2026-10-13: »wir verkaufen
neben der Loadbox auch einen ZOLLER Hightower … haben wir noch gar nicht auf unserer Webseite«).

Der »highTower« ist ein automatischer Lagerlift, den ZOLLER von Kardex bezieht. zoller.info zeigt ihn nur als Karte ohne
Link auf den Seiten der Add-ons »z.Stock« und »z.Resources« (»optionale Hardware«). Die Texte stehen in
content/hightower.json (eine Fassung je Sprache). Fakten: Gerätedatenblatt (Höhe 2.550–30.050 mm im 100-mm-Raster,
Lagerplatzraster 25 mm, Nutzlast bis 555 kg je Tablar, zwei Tablarsäulen mit Extraktor, Höhenmessung, Lichtvorhang,
Bedienöffnungen vorne/hinten/mehrere Etagen, modular anpassbar) und der Anwenderbericht über die drei Lagerlifte im
Hauptsitz von ZOLLER Inc. in Ann Arbor (je 26 ft hoch, große/schwere Werkzeuge und Ersatzteile, im Regal doppelte
Stellfläche). Kardex wird auf der Seite nicht genannt.

Für jede Sprachfassung (content/pages und content/sites/<src>/pages) schreibt das Skript:
  - die Produktseite <Werkzeuglager>/hightower (de_path /produkte/toolmanagement/werkzeuglager/hightower) mit dem
    Rechner-Block »traycalc« (tools/build.py r_traycalc, assets/js/traycalc.js)
  - den Menüeintrag unter Produkte > Toolmanagement > Werkzeuglager (nach »keeper«)
  - Produktkarten auf den Übersichten Werkzeuglager und Toolmanagement (nach »keeper«)
  - den Link der vorhandenen »highTower«-Karten auf den Seiten »z.Stock« und »z.Resources«

Wiederholbar: vorhandene »highTower«-Einträge werden ersetzt – nach einem Neuabzug der Inhalte einfach erneut ausführen.

    python3 tools/hightower.py
"""
import copy
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from idchip import dump, folder, link, load_pages, nav_label, norm, sources, ui, walk  # noqa: E402

CFG = json.load(open(os.path.join(ROOT, "content", "hightower.json"), encoding="utf-8"))
DE_PATH = "/produkte/toolmanagement/werkzeuglager/hightower"
NAME = "»highTower«"
IMG_HERO = {"src": "/fileadmin/_processed_/e/0/csm_Teaser_hightower_preview_177dbd110e.webp", "w": 1080, "h": 858}
IMG = {
    "tms": {"src": "/fileadmin/_processed_/7/7/csm_TMS_komponenten_a4f7077982.webp", "w": 955, "h": 513},
    "stock": {"src": "/fileadmin/_processed_/1/a/csm_zStock_Feature_01_1c6bb75d1a.webp", "w": 955, "h": 513},
    "res": {"src": "/fileadmin/_processed_/3/6/csm_zResources_Feature_02_637de1b463.webp", "w": 955, "h": 513},
    "ref": {"src": "/fileadmin/_processed_/1/9/csm_csm_automation_fest_travel_header_03_df68e82b27_24c41ac058.webp", "w": 1920, "h": 700},
}
WL = "/produkte/toolmanagement/werkzeuglager"
# Karten im Abschnitt Toolmanagement: Ziel (erste vorhandene Seite der Sprachfassung), Bild, Text
CARDS = (("stock", ("/produkte/toolmanagement/software/add-on-zstock",), "c_stock", "t_stock"),
         ("res", ("/produkte/toolmanagement/software/add-on-zresources",), "c_res", "t_res"))


def is_ht(href, src):
    return norm(href, src).endswith("/hightower")


def page_for(src, pages, T, lang, labels, new_path):
    def img(key, alt=""):
        return dict(IMG[key], alt=alt)

    def p(*xs):
        return " ".join(f"<p>{x}</p>" for x in xs)

    def first(*cands):
        return next((c for c in cands if c in pages), None)

    space = {"before": "default", "after": "default"}
    contact = "/unternehmen/kontakt" if "/unternehmen/kontakt" in pages else ""
    ask = f'<a class="btn" href="{contact}">{ui(lang, "Jetzt anfragen")}</a>' if contact else ""
    calc = f'<a class="btn btn--ghost" href="#{T["anchor"]}">{T["btn_calc"]}</a>'
    cards = []
    for key, targets, text, name in CARDS:
        href = first(*targets)
        title = labels.get(targets[0]) or T[name]
        cap = f"<figcaption> <h3>{title}</h3> <p>{T[text]}</p> </figcaption>"
        cards.append(dict(img(key), title=title, caption=cap, **({"href": href} if href else {})))
    calc_t = {k: T[k] for k in CFG["calc_keys"]}
    blocks = [
        {"type": "product_header", "title": NAME, "text": f"<p>{T['claim']}</p> <p>{ask} {calc}</p>",
         "img": dict(IMG_HERO, alt=T["kicker"]), "id": "hightower-header", "bg": "", "space": space},
        # Zwischenzeile ohne Produktnamen: die Zeile steht per CSS in Versalien (»HIGHTOWER« wäre falsch geschrieben)
        {"type": "textmedia", "header": f"<h3>{T['kicker']}</h3> <h2>{T['h_intro']}</h2>",
         "body": f"<p class=\"extra-large-text\"><strong>{T['p_intro_b']}</strong></p> <p>{T['p_intro']}</p>",
         "images": [], "videos": [], "pos": "text", "cols": 1, "valign": "top",
         "id": "hightower-intro", "bg": "", "space": {"before": "default", "after": "small"}},
        {"type": "goals", "tiles": [{"value": T[f"g{i}_v"], "text": f"<p>{T[f'g{i}_t']}</p>", "foot": f"<p>{T[f'g{i}_f']}</p>"}
                                    for i in (1, 2, 3)],
         "id": "hightower-facts", "bg": "", "space": {"before": "small", "after": "default"}},
        {"type": "traycalc", "header": f"<h2>{T['h_calc']}</h2>", "intro": f"<p class=\"subheader\">{T['p_calc']}</p>",
         "t": calc_t, "id": T["anchor"], "bg": "lightgray", "space": space},
        {"type": "highlight", "header": f"<h2>{T['h_safe']}</h2>", "items": T["safe"],
         "id": "hightower-safe", "bg": "", "space": space},
        {"type": "textmedia", "header": f"<h2>{T['h_tms']}</h2>", "body": p(f"<strong>{T['p_tms1']}</strong>", T["p_tms2"]),
         "images": [img("tms", T["alt_tms"])], "videos": [], "pos": "right", "cols": 1, "valign": "center",
         "id": "hightower-tms", "bg": "black", "space": space},
        {"type": "textmedia", "header": "", "body": "", "images": cards, "videos": [], "pos": "below", "cols": 2,
         "valign": "top", "id": "hightower-addons", "bg": "black", "space": {"before": "none", "after": "default"}},
        {"type": "textmedia", "header": f"<h2>{T['h_ref']}</h2>", "body": p(T["p_ref1"], T["p_ref2"]),
         "images": [img("ref", T["alt_ref"])], "videos": [], "pos": "left", "cols": 1, "valign": "center",
         "id": "hightower-ref", "bg": "", "space": space},
    ]
    # Teaser am Seitenende wie auf der »keeper«-Seite der Sprachfassung (Toolmanagement-Vorteile, Expertengespräch)
    if WL + "/keeper" in pages:
        last = pages[WL + "/keeper"][1]["blocks"][-1]
        if last.get("type") == "textmedia" and last.get("pos") == "below" and last.get("images") \
                and all(i.get("href") for i in last["images"]):
            blocks.append(dict(copy.deepcopy(last), id="hightower-teaser"))
    if lang == "fr":
        fr = lambda s: re.sub(r" ([:?!;])", "\xa0\\1", s)   # französische Typografie: geschütztes Leerzeichen vor : ? ! ;
        for b in blocks:
            for k in ("header", "body", "text", "intro"):
                if isinstance(b.get(k), str):
                    b[k] = fr(b[k])
            if b.get("items"):
                b["items"] = [fr(x) for x in b["items"]]
            for k, v in b.get("t", {}).items():
                b["t"][k] = [fr(x) for x in v] if isinstance(v, list) else fr(v)
            for i in b.get("images", []):
                if i.get("caption"):
                    i["caption"] = re.sub(r" ([:?!;])(?= )", "\xa0\\1", i["caption"])
    page = {"path": new_path, "url": link(src, new_path), "title": NAME, "description": T["desc"], "og_image": "",
            "breadcrumb": [], "languages": [], "blocks": blocks}
    if src:
        page["src_path"] = link(src, new_path)
        page["de_path"] = DE_PATH
    return page


def card(href, T):
    return {"href": href, "title": NAME, "text": T["nav_desc"], "img": dict(IMG_HERO, alt=""), "full": False, "kind": "product"}


def add_card(page, href, T, src, keeper):
    """Produktkarte auf einer Übersicht hinter »keeper« (Pfad der Sprachfassung, z. B. …/gardien, …/portero)."""
    done = False
    for b in page["blocks"]:
        if b.get("type") != "productlist":
            continue
        for row in b.get("rows", []):
            row["items"] = [it for it in row["items"] if not is_ht(it.get("href"), src)]
        for row in b.get("rows", []):
            at = next((i for i, it in enumerate(row["items"]) if norm(it.get("href"), src) == keeper), None)
            if at is not None and not done:
                row["items"].insert(at + 1, card(href, T))
                done = True
    return done


def link_cards(page, href):
    """Vorhandene »highTower«-Karten (ohne Link) auf den Add-on-Seiten verlinken."""
    n = 0
    for b in page["blocks"]:
        for it in b.get("items", []) if isinstance(b.get("items"), list) else []:
            if isinstance(it, dict) and "highTower" in str(it.get("title", "")):
                it["href"] = href
                n += 1
    return n


def main():
    for src in sources():
        lang = CFG["lang_of_src"][src]
        if lang not in CFG["texts"]:
            print(f"{src or 'de'}: keine Texte für {lang} – übersprungen")
            continue
        T = CFG["texts"][lang]
        missing = [k for k in CFG["texts"]["de"] if k not in T]
        if missing:
            print(f"{src or 'de'}: Texte für {lang} unvollständig ({', '.join(missing)}) – übersprungen")
            continue
        pages = load_pages(src)
        if WL not in pages:
            print(f"{src or 'de'}: keine Seite Werkzeuglager – übersprungen")
            continue
        wl_file, wl = pages[WL]
        new_path = wl["path"].rstrip("/") + "/hightower"
        keeper = pages[WL + "/keeper"][1]["path"].rstrip("/") if WL + "/keeper" in pages else WL + "/keeper"
        href = link(src, new_path)
        tr_file = os.path.join(folder(src), "translations.json")
        tr = json.load(open(tr_file, encoding="utf-8")) if src and os.path.exists(tr_file) else {}
        corr_file = os.path.join(folder(src), "corrections.json")
        corr = json.load(open(corr_file, encoding="utf-8")) if os.path.exists(corr_file) else {}
        nav_file = os.path.join(folder(src), "nav.json")
        nav = json.load(open(nav_file, encoding="utf-8"))
        labels = {}
        for _, targets, _, _ in CARDS:
            dp = targets[0]
            if dp in pages:
                labels[dp] = nav_label(nav, src, pages[dp][1]["path"].rstrip("/"), tr, corr) or pages[dp][1]["title"]
        page = page_for(src, pages, T, lang, labels, new_path)
        dump(wl_file[:-len(".json")] + "__hightower.json", page)

        # Menü: Toolmanagement > Werkzeuglager (nach »keeper«)
        entry = {"label": NAME, "href": href, "claim": T["nav_claim"], "desc": T["nav_desc"], "img": IMG_HERO["src"]}
        done = []
        for n in walk(nav["main"]):
            if n.get("children") is None:
                continue
            n["children"] = [c for c in n["children"] if not is_ht(c.get("href"), src)]
            if norm(n.get("href"), src) == wl["path"].rstrip("/"):
                at = next((i for i, c in enumerate(n["children"]) if norm(c.get("href"), src) == keeper), len(n["children"]) - 1)
                n["children"].insert(at + 1, dict(entry))
                done.append("Werkzeuglager")
        dump(nav_file, nav)

        cards, linked = [], 0
        for dp in (WL, "/produkte/toolmanagement"):
            if dp in pages:
                f, pg = pages[dp]
                if add_card(pg, href, T, src, keeper):
                    dump(f, pg)
                    cards.append(dp.rsplit("/", 1)[-1])
        for dp in ("/produkte/toolmanagement/software/add-on-zstock", "/produkte/toolmanagement/software/add-on-zresources"):
            if dp in pages:
                f, pg = pages[dp]
                n = link_cards(pg, href)
                if n:
                    dump(f, pg)
                    linked += n
        print(f"{src or 'de':6s} {lang:6s} {new_path}  Menü: {', '.join(done) or '–'}  Karten: {', '.join(cards) or '–'}  "
              f"Add-on-Karten verlinkt: {linked}  Teaser: {'ja' if page['blocks'][-1]['id'] == 'hightower-teaser' else 'nein'}")


if __name__ == "__main__":
    main()
