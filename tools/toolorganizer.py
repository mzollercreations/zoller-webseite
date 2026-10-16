#!/usr/bin/env python3
"""»toolOrganizer«: Konfigurator auf der Seite »Konfiguration« in allen Sprachfassungen (Nutzer 2026-10-16: »baue noch
auf der zoller webseite bei dem toolorganizer einen konfigurator mit ein« – Grundlage ist der Flyer »toolOrganizer«,
Version 13, 2024-08-21, Zoller_fl_tms_toolorganizer_werkzeugschrank_v13_de.pdf).

Für jede Sprachfassung (content/pages und content/sites/<src>/pages) schreibt das Skript:
  - den Block »toolconfig« (tools/build.py r_toolconfig, assets/js/toolconfig.js) auf der Seite
    …/toolorganizer/konfiguration direkt unter die Einleitung; die vorhandenen Tabellen bleiben darunter stehen
  - einen zweiten Knopf »Jetzt konfigurieren« im Produktkopf der »toolOrganizer«-Übersicht

Die Texte stehen in content/toolorganizer.json (eine Fassung je Sprache). Der Link auf den Flyer im Hinweis nimmt das
PDF aus dem Info-Pool der Sprachfassung (das liegt auf der Länderseite sicher vor); gibt es dort keins, entfällt er.
Die Bilder der Auswahlkarten (assets/img/toolorganizer/*.webp) sind aus den Fotos des Flyers geschnitten.

Wiederholbar: vorhandene Konfigurator-Blöcke und Knöpfe werden ersetzt.

    python3 tools/toolorganizer.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from idchip import dump, link, load_pages, sources  # noqa: E402

CFG = json.load(open(os.path.join(ROOT, "content", "toolorganizer.json"), encoding="utf-8"))
TO = "/produkte/toolmanagement/werkzeuglager/toolorganizer"
KONF = TO + "/konfiguration"
BTN = re.compile(r'\s*<a [^>]*data-tcfg-btn[^>]*>.*?</a>', re.S)


def fr_typo(s):
    """Französische Typografie: geschütztes Leerzeichen vor : ? ! ; (nicht in Platzhaltern oder Links)."""
    return re.sub(r" ([:?!;])(?=\s|$|<)", "\xa0\\1", s)


def block_for(T, lang, flyer):
    t = {k: v for k, v in T.items() if k not in CFG["page_keys"]}
    if flyer:
        t["note"] = t["note"].replace("{flyer}", flyer)
    else:
        t["note"] = re.sub(r'<a href="\{flyer\}">(.*?)</a>', r"\1", t["note"])
    header, intro = f"<h2>{T['h_cfg']}</h2>", f"<p class=\"subheader\">{T['p_cfg']}</p>"
    if lang == "fr":
        t = {k: [fr_typo(x) for x in v] if isinstance(v, list) else fr_typo(v) if isinstance(v, str) else v for k, v in t.items()}
        header, intro = fr_typo(header), fr_typo(intro)
    return {"type": "toolconfig", "header": header, "intro": intro, "t": t, "flyer": flyer or "",
            "id": T["anchor"], "bg": "lightgray", "space": {"before": "default", "after": "default"}}


def main():
    for src in sources():
        lang = CFG["lang_of_src"][src]
        T = CFG["texts"].get(lang)
        if not T:
            print(f"{src or 'de':6s} keine Texte für {lang} – übersprungen")
            continue
        missing = [k for k in CFG["texts"]["de"] if k not in T]
        if missing:
            print(f"{src or 'de':6s} Texte für {lang} unvollständig ({', '.join(missing[:6])}…) – übersprungen")
            continue
        pages = load_pages(src)
        if KONF not in pages or TO not in pages:
            print(f"{src or 'de':6s} keine »toolOrganizer«-Konfiguration – übersprungen")
            continue
        flyer = ""
        if TO + "/info-pool" in pages:
            m = re.search(r'"(/fileadmin/[^"]*toolorganizer[^"]*\.pdf)"', json.dumps(pages[TO + "/info-pool"][1]), re.I)
            flyer = m.group(1) if m else ""

        f, page = pages[KONF]
        blocks = [b for b in page["blocks"] if b.get("type") != "toolconfig"]
        at = next((i for i, b in enumerate(blocks) if b.get("type") != "subnav"), 0) + 1
        blocks.insert(at, block_for(T, lang, flyer))
        page["blocks"] = blocks
        dump(f, page)

        f2, over = pages[TO]
        href = link(src, page["path"].rstrip("/")) + "#" + T["anchor"]
        n = 0
        for b in over["blocks"]:
            if b.get("type") == "product_header":
                text = BTN.sub("", b.get("text", ""))
                btn = f' <a class="btn btn--ghost" href="{href}" data-tcfg-btn>{T["btn_cfg"]}</a>'
                i = text.rfind("</p>")
                b["text"] = text[:i] + btn + text[i:] if i >= 0 else text + f"<p>{btn.strip()}</p>"
                n += 1
        dump(f2, over)
        print(f"{src or 'de':6s} {lang:6s} {page['path']}  Block an Stelle {at}  Knopf: {n}  Flyer: {flyer.rsplit('/', 1)[-1] or '–'}")


if __name__ == "__main__":
    main()
