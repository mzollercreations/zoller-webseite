#!/usr/bin/env python3
"""»idChip« als eigenes Produkt in allen Sprachfassungen (Nutzer 2026-10-12: »füge den ID-Chip als Produkt hinzu«).

zoller.info hat keine eigene »idChip«-Seite – der Chip wird dort nur auf anderen Seiten erwähnt (Werkzeugaufnahmen,
»zidCode«, »powerShrink« …). Die Texte stehen in content/idchip.json (eine Fassung je Sprache, Fakten aus den
ZOLLER-Broschüren), die Bilder unter docs/fileadmin/02_Products/idChip/ und docs/fileadmin/_processed_/7/9/.

Für jede Sprachfassung (content/pages und content/sites/<src>/pages) schreibt das Skript:
  - die Produktseite <Werkzeugaufnahmen>/idchip (de_path /produkte/werkzeugaufnahmen/idchip)
  - Menüeinträge unter Produkte > Werkzeugaufnahmen (vor dem Tooling-Shop) und unter Toolmanagement > Datentransfer
    (nach »zidCode«)
  - Produktkarten auf den Übersichten Werkzeugaufnahmen, Datentransfer und Toolmanagement (Zeile mit »zidCode«)

Kartentitel (Einstellen & Messen, Schrumpftechnik), Downloads (Broschüren aus dem Info-Pool
Werkzeugaufnahmen) und die Teaser am Seitenende kommen aus der jeweiligen Sprachfassung. Wiederholbar: vorhandene
»idChip«-Einträge werden ersetzt – nach einem Neuabzug der zoller.info-Inhalte einfach erneut ausführen.

    python3 tools/idchip.py
"""
import copy
import glob
import json
import os
import re
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import i18n  # noqa: E402

CFG = json.load(open(os.path.join(ROOT, "content", "idchip.json"), encoding="utf-8"))
SITES = json.load(open(os.path.join(ROOT, "content", "sites.json"), encoding="utf-8"))
DE_PATH = "/produkte/werkzeugaufnahmen/idchip"
NAME = "»idChip«"
IMG_HERO = {"src": "/fileadmin/02_Products/idChip/zoller_idchip_werkzeughalter.webp", "w": 331, "h": 689}
IMG = {
    "dark": {"src": "/fileadmin/_processed_/1/7/csm_zoller_smarte_solutions_171a2dc46c.webp", "w": 1454, "h": 1454},
    "chip": {"src": "/fileadmin/_processed_/7/9/csm_chip_edd3e9cbeb.webp", "w": 1524, "h": 887},
    "scan": {"src": "/fileadmin/_processed_/d/7/csm_software_idchip_9694061981.webp", "w": 1000, "h": 563},
    "c1": {"src": "/fileadmin/_processed_/e/4/csm_venturion_header_2a53427792.webp", "w": 1080, "h": 930},
    "c2": {"src": "/fileadmin/_processed_/6/f/csm_option_zidcode_01_45e04f3e38.webp", "w": 792, "h": 457},
    "c3": {"src": "/fileadmin/_processed_/3/b/csm_software_zidCode4_7a2e75321f.webp", "w": 1920, "h": 1690},
    "vs_chip": {"src": "/fileadmin/02_Products/idChip/zoller_idchip_vergleich_idchip.webp", "w": 1390, "h": 869},
    "vs_label": {"src": "/fileadmin/02_Products/idChip/zoller_idchip_vergleich_idlabel.webp", "w": 1385, "h": 866},
    "retro": {"src": "/fileadmin/_processed_/7/8/csm_zShopfloor_Feature_01_969ecbcfca.webp", "w": 955, "h": 513},
}
# Karten »Ein Code für den ganzen Werkzeugkreislauf« (drei – das Kartenraster zeigt drei je Zeile): Ziel (erste
# vorhandene Seite) und Titel aus dem Menü; Toolmanagement steht als Absatz im Abschnitt »Einmal scannen«
CARDS = (("c1", ("/produkte/einstellen-messen",), "/produkte/einstellen-messen"),
         ("c2", ("/produkte/schrumpftechnik/powershrink", "/produkte/schrumpftechnik"), "/produkte/schrumpftechnik"),
         ("c3", ("/produkte/toolmanagement/zidcode", "/produkte/toolmanagement/datentransfer"), None))
DOWNLOADS = re.compile(r"Broschuere_Tooling|Flyer_TMS_zidCode|tms_zidcode_fltmszc|SmarteFertigung", re.I)


def dump(path, data):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(data, ensure_ascii=False, indent=1))


def sources():
    out = [""]
    for site in SITES.values():
        for loc in site["locales"]:
            if loc["src"] and loc["src"] not in out:
                out.append(loc["src"])
    return out


def folder(src):
    return os.path.join(ROOT, "content", "sites", src) if src else os.path.join(ROOT, "content")


def load_pages(src):
    """Deutscher Pfad -> (Datei, Seite) einer Sprachfassung."""
    pages = {}
    for f in sorted(glob.glob(os.path.join(folder(src), "pages", "*.json"))):
        p = json.load(open(f, encoding="utf-8"))
        dp = p.get("de_path") if src else p["path"].rstrip("/")
        if dp and dp not in pages:
            pages[dp] = (f, p)
    return pages


def norm(href, src):
    """Menü-Link -> lokaler Pfad ohne Sprachpräfix (/ca/products/tool-holders -> /products/tool-holders)."""
    h = urllib.parse.unquote(href or "").split("#")[0].split("?")[0].rstrip("/")
    if src and (h == "/" + src or h.startswith("/" + src + "/")):
        h = h[len(src) + 1:]
    return h


def link(src, path):
    """Lokaler Pfad -> Link, wie ihn die Inhalte dieser Sprachfassung schreiben (mit Sprachpräfix, kodiert)."""
    return path if not src else "/" + src + urllib.parse.quote(path, safe="/-_.~")


def walk(nodes):
    for n in nodes:
        yield n
        yield from walk(n.get("children", []))


def nav_label(nav, src, local, tr, corr):
    for n in walk(nav["main"]):
        if norm(n.get("href"), src) == local:
            label = n["label"]
            label = tr.get(label, label)
            return corr.get(label, label)
    return None


def ui(lang, key):
    code = {"es-MX": "es"}.get(lang, lang)
    if code == "de":
        return key
    return i18n.T.get(code, {}).get(key) or i18n.T.get(code.split("-")[0], {}).get(key) or key


def is_idchip(href, src):
    return norm(href, src).endswith("/idchip")


def page_for(src, pages, T, lang, labels, new_path):
    def img(key, alt=""):
        return dict(IMG[key], alt=alt)

    def p(*xs):
        return " ".join(f"<p>{x}</p>" for x in xs)

    def first(*cands):
        return next((c for c in cands if c in pages), None)

    space = {"before": "default", "after": "default"}
    cards = []
    for key, targets, label_from in CARDS:
        href = first(*targets)
        title = T["c3t"] if key == "c3" else (labels.get(label_from) or label_from)
        cap = f"<figcaption> <h3>{title}</h3> <p>{T[key]}</p> </figcaption>"
        cards.append(dict(img(key), title=title, caption=cap, **({"href": href} if href else {})))
    contact = "/unternehmen/kontakt" if "/unternehmen/kontakt" in pages else ""
    btn = f' <p><a class="btn" href="{contact}">{ui(lang, "Jetzt anfragen")}</a></p>' if contact else ""
    blocks = [
        {"type": "product_header", "title": NAME, "text": f"<p>{T['claim']}</p>{btn}",
         "img": dict(IMG_HERO, alt=T["kicker"]), "id": "idchip-header", "bg": "", "space": space},
        # Zwischenzeile ohne Produktnamen: die Zeile steht per CSS in Versalien (»IDCHIP« wäre falsch geschrieben)
        {"type": "textmedia", "header": f"<h3>{T['desc'].rsplit(' - ', 1)[-1]}</h3> <h2>{T['h_intro']}</h2>",
         "body": f"<p><strong>{T['p_intro_b']}</strong></p> <p>{T['p_intro']}</p>",
         "images": [img("dark", T["kicker"])], "videos": [], "pos": "right", "cols": 1, "valign": "center",
         "id": "idchip-intro", "bg": "", "space": space},
        {"type": "textmedia", "header": f"<h2>{T['h_fix']}</h2>", "body": p(T["p_fix1"], T["p_fix2"]),
         "images": [img("chip", T["alt_chip"])], "videos": [], "pos": "left", "cols": 1, "valign": "center",
         "id": "idchip-fix", "bg": "lightgray", "space": space},
        {"type": "textmedia", "header": f"<h2>{T['h_scan']}</h2>", "body": p(T["p_scan1"], T["p_scan2"], T["p_tms"]),
         "images": [img("scan", T["alt_scan"])], "videos": [], "pos": "right", "cols": 1, "valign": "center",
         "id": "idchip-scan", "bg": "", "space": space},
        {"type": "textmedia", "header": f"<h2>{T['h_cycle']}</h2>", "body": p(T["p_cycle"]), "images": cards,
         "videos": [], "pos": "below", "cols": 4, "valign": "top", "id": "idchip-cycle", "bg": "lightgray", "space": space},
        {"type": "textmedia", "header": f"<h2>{T['h_vs']}</h2>", "body": p(T["p_vs"]),
         "images": [dict(img("vs_chip", NAME), title=NAME, caption=f"<figcaption> <h3>{NAME}</h3> <p>{T['vs_chip']}</p> </figcaption>"),
                    dict(img("vs_label", "»idLabel«"), title="»idLabel«",
                         caption=f"<figcaption> <h3>»idLabel«</h3> <p>{T['vs_label']}</p> </figcaption>")],
         "videos": [], "pos": "below", "cols": 2, "valign": "top", "id": "idchip-vs", "bg": "", "space": space},
        {"type": "textmedia", "header": f"<h2>{T['h_retro']}</h2>", "body": p(T["p_retro1"], T["p_retro2"]) + btn,
         "images": [img("retro", T["kicker"])], "videos": [], "pos": "left", "cols": 1, "valign": "center",
         "id": "idchip-retro", "bg": "black", "space": space},
    ]
    # Broschüren aus dem Info-Pool Werkzeugaufnahmen der Sprachfassung (Tooling, »zidCode«, Smarte Fertigung)
    files, seen = [], set()
    if "/solutions/werkzeugaufnahmen/info-pool" in pages:
        for b in pages["/solutions/werkzeugaufnahmen/info-pool"][1]["blocks"]:
            for f in b.get("files", []) if b.get("type") == "downloads" else []:
                if DOWNLOADS.search(f.get("href", "")) and f["href"] not in seen:
                    seen.add(f["href"])
                    files.append(f)
    if files:
        blocks.append({"type": "downloads", "header": f"<h2>{T['h_dl']}</h2>", "files": files,
                       "id": "idchip-downloads", "bg": "", "space": space})
    # Teaser am Seitenende wie auf der »zidCode«-Seite der Sprachfassung (Toolmanagement-Vorteile, Expertengespräch)
    if "/produkte/toolmanagement/zidcode" in pages:
        last = pages["/produkte/toolmanagement/zidcode"][1]["blocks"][-1]
        if last.get("type") == "textmedia" and last.get("pos") == "below" and last.get("images") \
                and all(i.get("href") for i in last["images"]):
            blocks.append(dict(copy.deepcopy(last), id="idchip-teaser"))
    if lang == "fr":
        for b in blocks:   # französische Typografie: geschütztes Leerzeichen vor : ? !
            for k in ("header", "body", "text"):
                if isinstance(b.get(k), str):
                    b[k] = re.sub(r" ([:?!])", " \\1", b[k])
            for i in b.get("images", []):
                if i.get("caption"):
                    i["caption"] = re.sub(r" ([:?!])(?= )", " \\1", i["caption"])
    page = {"path": new_path, "url": link(src, new_path), "title": NAME, "description": T["desc"], "og_image": "",
            "breadcrumb": [], "languages": [], "blocks": blocks}
    if src:
        page["src_path"] = link(src, new_path)
        page["de_path"] = DE_PATH
    return page


def card(href, T):
    return {"href": href, "title": NAME, "text": T["nav_desc"], "img": dict(IMG_HERO, alt=""), "full": False, "kind": "product"}


def add_card(page, href, T, first):
    """Produktkarte auf einer Übersicht: vorne (Werkzeugaufnahmen) oder hinter »zidCode« (Datentransfer, Toolmanagement)."""
    for b in page["blocks"]:
        if b.get("type") != "productlist":
            continue
        for row in b.get("rows", []):
            row["items"] = [it for it in row["items"] if not is_idchip(it.get("href"), SRC)]
        rows = b.get("rows", [])
        if first and rows:
            rows[0]["items"].insert(0, card(href, T))
            return True
        for row in rows:
            at = next((i for i, it in enumerate(row["items"]) if norm(it.get("href"), SRC).endswith("/zidcode")), None)
            if at is not None:
                row["items"].insert(at + 1, card(href, T))
                return True
    return False


SRC = ""


def main():
    global SRC
    for src in sources():
        SRC = src
        lang = CFG["lang_of_src"][src]
        T = CFG["texts"][lang]
        pages = load_pages(src)
        if "/produkte/werkzeugaufnahmen" not in pages:
            print(f"{src or 'de'}: keine Seite Werkzeugaufnahmen – übersprungen")
            continue
        wa_file, wa = pages["/produkte/werkzeugaufnahmen"]
        new_path = wa["path"].rstrip("/") + "/idchip"
        href = link(src, new_path)
        tr = json.load(open(os.path.join(folder(src), "translations.json"), encoding="utf-8")) if src and os.path.exists(os.path.join(folder(src), "translations.json")) else {}
        corr_file = os.path.join(folder(src), "corrections.json")
        corr = json.load(open(corr_file, encoding="utf-8")) if os.path.exists(corr_file) else {}
        nav_file = os.path.join(folder(src), "nav.json")
        nav = json.load(open(nav_file, encoding="utf-8"))
        labels = {}
        for dp in ("/produkte/einstellen-messen", "/produkte/schrumpftechnik"):
            local = pages[dp][1]["path"].rstrip("/") if dp in pages else dp
            labels[dp] = nav_label(nav, src, local, tr, corr) or (pages[dp][1]["title"] if dp in pages else dp)
        page = page_for(src, pages, T, lang, labels, new_path)
        dump(wa_file[:-len(".json")] + "__idchip.json", page)

        # Menü: Werkzeugaufnahmen (vor dem Tooling-Shop) und Toolmanagement > Datentransfer (nach »zidCode«)
        entry = {"label": NAME, "href": href, "claim": T["nav_claim"], "desc": T["nav_desc"], "img": IMG_HERO["src"]}
        dt_local = pages["/produkte/toolmanagement/datentransfer"][1]["path"].rstrip("/") if "/produkte/toolmanagement/datentransfer" in pages else None
        done = []
        for n in walk(nav["main"]):
            if n.get("children") is None:
                continue
            n["children"] = [c for c in n["children"] if not is_idchip(c.get("href"), src)]
            here = norm(n.get("href"), src)
            if here == wa["path"].rstrip("/"):
                n["children"].insert(0, dict(entry))
                done.append("Werkzeugaufnahmen")
            elif dt_local and here == dt_local:
                at = next((i for i, c in enumerate(n["children"]) if norm(c.get("href"), src).endswith("/zidcode")), len(n["children"]) - 1)
                n["children"].insert(at + 1, dict(entry))
                done.append("Datentransfer")
        dump(nav_file, nav)

        # Produktübersichten
        cards = []
        for dp, first in (("/produkte/werkzeugaufnahmen", True), ("/produkte/toolmanagement/datentransfer", False),
                          ("/produkte/toolmanagement", False)):
            if dp in pages:
                f, pg = pages[dp]
                if add_card(pg, href, T, first):
                    dump(f, pg)
                    cards.append(dp.rsplit("/", 1)[-1])
        print(f"{src or 'de':6s} {lang:6s} {new_path}  Menü: {', '.join(done) or '–'}  Karten: {', '.join(cards) or '–'}  "
              f"Downloads: {sum(len(b.get('files', [])) for b in page['blocks'] if b['type'] == 'downloads')}  "
              f"Teaser: {'ja' if page['blocks'][-1]['id'] == 'idchip-teaser' else 'nein'}")


if __name__ == "__main__":
    main()
