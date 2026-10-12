#!/usr/bin/env python3
"""
Legt eine Sprachfassung als Kopie einer bestehenden an – für Länder, die es auf zoller.info nicht (mehr) gibt
(Russland, Türkei). Grundlage ist die fertig korrigierte Fassung: Übersetzungen, Ersetzungen, Produktnamen und
Korrekturen der Quelle sind schon eingearbeitet. Die neue Sprache bekommt ihre Texte dann ganz normal über
content/sites/<neu>/translations.json (Schlüssel = englischer Text der Kopie).

Aufruf:  python3 tools/clone_locale.py en_DE ru
         python3 tools/clone_locale.py en_DE tr

Kopiert pages/*.json, nav.json, queries.json und images.json, schreibt Adressen /en_DE/… auf /ru/… um und
übernimmt die Umbenennungen aus content/renames.json. translations.json der neuen Fassung bleibt unberührt.
"""
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import build  # noqa: E402
import names  # noqa: E402


def load(path, default=None):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else default


def main():
    src, dst = sys.argv[1], sys.argv[2]
    s_dir, d_dir = (os.path.join(ROOT, "content", "sites", x) for x in (src, dst))
    lang = next(l["lang"] for site in build.SITES.values() for l in site["locales"] if l["src"] == src)
    tr = load(os.path.join(s_dir, "translations.json"), {})
    reps = load(os.path.join(s_dir, "replace.json"), {})
    corr = load(os.path.join(s_dir, "corrections.json"), {})

    def sub(o):
        if isinstance(o, dict):
            return {k: (v if k in build.TEXT_SKIP else sub(v)) for k, v in o.items()}
        if isinstance(o, list):
            return [sub(v) for v in o]
        if isinstance(o, str):
            for a, b in reps.items():
                o = o.replace(a, b)
        return o

    def bake(obj):
        """Wie use_locale(): Übersetzungen -> Ersetzungen -> Produktnamen -> Korrekturen."""
        obj = build.translate(obj, tr)
        obj = sub(obj)
        obj = names.fix_all(obj, lang, build.TEXT_SKIP)
        return build.translate(obj, corr, skip=build.TEXT_SKIP)

    def relocate(obj):
        s = json.dumps(obj, ensure_ascii=False)
        s = s.replace(f"/{src}/", f"/{dst}/").replace(f'/{src}"', f'/{dst}"').replace(f"/{src}\\\"", f"/{dst}\\\"")
        return json.loads(s)

    out = os.path.join(d_dir, "pages")
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    n = 0
    for f in sorted(os.listdir(os.path.join(s_dir, "pages"))):
        if not f.endswith(".json"):
            continue
        page = relocate(bake(load(os.path.join(s_dir, "pages", f))))
        page["cloned_from"] = src
        json.dump(page, open(os.path.join(out, f), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        n += 1
    json.dump(relocate(bake(load(os.path.join(s_dir, "nav.json")))), open(os.path.join(d_dir, "nav.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    for name in ("queries.json", "images.json"):
        data = load(os.path.join(s_dir, name))
        if data is not None:
            json.dump(relocate(data), open(os.path.join(d_dir, name), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ren_file = os.path.join(ROOT, "content", "renames.json")
    ren = load(ren_file, {})
    if src in ren:
        ren[dst] = ren[src]
        json.dump(ren, open(ren_file, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{n} Seiten von {src} nach {dst} kopiert -> {out}")


if __name__ == "__main__":
    main()
