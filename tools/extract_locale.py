"""
Extrahiert eine Sprachfassung von zoller.info (heruntergeladen mit fetch_locale.py)
nach content/sites/<sprachpfad>/ – im selben Format wie die deutsche Seite.

Aufruf:  .venv/bin/python tools/extract_locale.py <sprachpfad> <raw-ordner>
         z. B. .venv/bin/python tools/extract_locale.py ca .cache/raw/ca

Ergebnis:
  content/sites/<sprachpfad>/pages/*.json   Seiten (Pfade ohne Sprachpräfix, Startseite = /startseite)
  content/sites/<sprachpfad>/nav.json       Hauptnavigation
  content/sites/<sprachpfad>/images.json    verwendete Bilder
Jede Seite bekommt »de_path« (deutsches Gegenstück laut hreflang) für Länderwechsel,
3D-Produktbühnen und feste Links (Kontakt, Datenschutz …).
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import extract  # noqa: E402
import extract_nav  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGIN = "https://www.zoller.info"
HOME = "/startseite"
# Häufige Funktionswörter: News, die auf zoller.info noch nicht übersetzt sind, erkennen
# (je Sprache Wörter, die in den anderen Sprachen nicht vorkommen)
STOPWORDS = {
    "de": ("und", "der", "die", "das", "mit", "für", "nicht", "wird", "sich", "auch"),
    "en": ("and", "the", "with", "for", "that", "this", "are", "from", "which", "our"),
    "fr": ("et", "les", "des", "pour", "avec", "une", "dans", "est", "sur", "qui"),
    "es": ("y", "los", "las", "para", "con", "una", "del", "que", "por", "más"),
    "it": ("il", "di", "che", "della", "sono", "nel", "alla", "degli", "delle", "anche"),
    "pt": ("os", "das", "com", "uma", "não", "são", "também", "pelo", "dos", "às"),
    "sv": ("och", "att", "som", "för", "med", "är", "av", "på", "till", "inte"),
    "pl": ("się", "jest", "oraz", "dla", "przez", "jako", "może", "także", "nie", "są"),
    "sl": ("in", "je", "za", "ki", "so", "tudi", "lahko", "pri", "ali", "kot"),
    "cs": ("pro", "jsou", "které", "také", "jako", "nebo", "při", "jejich", "může", "této"),
    "hu": ("és", "az", "egy", "hogy", "nem", "van", "vagy", "is", "ezt", "által"),
    "sk": ("pre", "sú", "ktoré", "tiež", "ako", "alebo", "pri", "ich", "môže", "tejto"),
}
# Chinesisch, Japanisch, Koreanisch: Schriftzeichen statt Funktionswörter
SCRIPTS = {"zh": r"[\u4e00-\u9fff]", "ja": r"[\u3040-\u30ff]", "ko": r"[\uac00-\ud7af]"}
# Pfadteil der News-Detailseiten in den Sprachfassungen (…/your-success/detail/<artikel>)
DETAIL_SEGS = ("detail", "details", "detalle", "dettaglio", "detalhe", "detaljer", "szczegoly", "podrobnosti",
               "reszletek", "详情", "詳細", "상세-정보")
DETAIL_RE = "(?:" + "|".join(DETAIL_SEGS) + ")"


def lang_score(text, lang):
    """Anteil der Sprache lang an einem Text (Funktionswörter bzw. Schriftzeichen)."""
    if lang in SCRIPTS:
        return len(re.findall(SCRIPTS[lang], text))
    words = re.findall(r"[^\W\d_]+", text.lower())
    return sum(words.count(w) for w in STOPWORDS[lang])


def language_ok(page, lang):
    text = json.dumps(page["blocks"], ensure_ascii=False)
    if lang in SCRIPTS:   # mindestens so viele Schriftzeichen wie deutsche Funktionswörter x 10
        return lang_score(text, lang) >= 10 * lang_score(text, "de") and lang_score(text, lang) >= 20
    return lang_score(text, lang) >= lang_score(text, "de")


def main():
    loc, raw_dir = sys.argv[1], sys.argv[2]
    sites = json.load(open(os.path.join(ROOT, "content", "sites.json"), encoding="utf-8"))
    conf = next(l for s in sites.values() for l in s["locales"] if l["src"] == loc)
    home = conf["home"]
    prefix = "/" + loc
    out = os.path.join(ROOT, "content", "sites", loc)
    pages_dir = os.path.join(out, "pages")
    os.makedirs(pages_dir, exist_ok=True)
    for f in glob.glob(os.path.join(pages_dir, "*.json")):
        if '"hand": true' in open(f, encoding="utf-8").read():
            continue   # handgebaute Seiten (Eventseiten Automation Week / Automation Days …) bleiben
        os.remove(f)
    extract.images.clear()
    pages = {}
    skipped = 0
    for fn in sorted(glob.glob(os.path.join(raw_dir, "*.html"))):
        raw = open(fn, encoding="utf-8", errors="ignore").read()
        p = extract.extract_page(fn)
        if p is None:
            print("  - kein <main>:", fn, file=sys.stderr)
            continue
        path = p["path"]
        if path == home:
            path = HOME
        elif path.startswith(prefix + "/"):
            path = path[len(prefix):]
        else:
            continue
        if path == "/404":
            continue
        m = re.search(r'<link rel="alternate" hreflang="de-DE" href="([^"]+)"', raw)
        de = m.group(1).replace(ORIGIN, "").rstrip("/") if m else ""
        if re.search(r"/" + DETAIL_RE + "/", path):
            if not language_ok(p, conf["lang"]):
                skipped += 1  # wird über content/sites/<sprachpfad>/translations.json übersetzt
            if re.search(r"/" + DETAIL_RE + "$", de):
                de = ""  # hreflang zeigt hier nur auf die allgemeine Detailseite
        p["path"] = path
        p["src_path"] = extract.page_path_from_file(fn)
        p["de_path"] = de if de.startswith("/") else ""
        pages[path] = p
    for path, p in pages.items():
        with open(os.path.join(pages_dir, extract.slug_for(path) + ".json"), "w", encoding="utf-8") as fh:
            json.dump(p, fh, ensure_ascii=False, indent=1)
    nav = extract_nav.extract_nav(os.path.join(raw_dir, extract.slug_for(home) + ".html"))
    json.dump(nav, open(os.path.join(out, "nav.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(sorted(extract.images), open(os.path.join(out, "images.json"), "w"), indent=0)
    # Alte Abfrage-Links der News (…/details?tx_news_pi1…) -> Pfad des übernommenen Artikels
    qfile = os.path.join(raw_dir, "_queries.json")
    queries = json.load(open(qfile)) if os.path.exists(qfile) else {}
    queries = {k: v[len(prefix):] for k, v in queries.items() if v[len(prefix):] in pages}
    json.dump(queries, open(os.path.join(out, "queries.json"), "w"), ensure_ascii=False, indent=1)
    mapped = sum(1 for p in pages.values() if p["de_path"])
    if skipped:
        print(f"{loc}: {skipped} News noch nicht in der richtigen Sprache – Übersetzung über translations.json")
    print(f"{loc}: {len(pages)} Seiten ({mapped} mit deutschem Gegenstück), {len(extract.images)} Bilder, "
          f"Navigation: {', '.join(n['label'] for n in nav['main'])}")


if __name__ == "__main__":
    main()
