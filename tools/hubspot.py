"""
Länderseiten für HubSpot (Content Hub) aufbereiten, lokal ansehen und hochladen.

Aufruf:  python3 tools/hubspot.py export us|ca|mx|de|all    gebaute Seite -> dist/hubspot/ (vorher tools/build.py --site …)
         python3 tools/hubspot.py preview us [--port 8795]   lokal so wie auf HubSpot (Seiten ohne / am Ende, Dateien unter /hubfs/)
         python3 tools/hubspot.py status                     Zugang, Portal und verbundene Domains prüfen
         python3 tools/hubspot.py upload us [files] [theme] [pages] [--test] [--publish] [--force]
                                    --test: nur Startseite, eine Produktbühne, Standort-Globus und 404 (erster Test)
         python3 tools/hubspot.py check us                   Live-Seite und Dateitypen auf der Domain prüfen

Aufbau auf HubSpot:
  Dateimanager   /<files_folder>/…   Bilder, Videos, PDFs, Schriften, CSS und JS aller Länderseiten. Die Ordnerstruktur
                                     bleibt erhalten, deshalb funktionieren die relativen Importe der 3D-Module und url()
                                     im CSS. Nicht als Design-Manager-Dateien, weil HubSpot die dort minifiziert und
                                     umbenennt (bricht ES-Module und Importmap).
  Design-Manager <theme>/            ein Theme je Länderseite: templates/layouts/base.html (Kopf mit den HubSpot-Pflicht-
                                     tags), je Seite ein Template templates/pages/<pfad>.html, templates/system/404.html
  Website-Seiten eine Seite je Template, Slug = Pfad der Länderseite, Titel und Beschreibung in den Seiteneinstellungen

Inhalte werden weiter in content/ gepflegt: build.py -> hubspot.py export -> hubspot.py upload. Seiteninhalte stehen in
den Templates (live, sobald hochgeladen), Änderungen im HubSpot-Seiteneditor würden beim nächsten Upload überschrieben.

Zugang: Private App (in neueren Konten „Legacy-App“) mit den Scopes `content` und `files`. Token in der Umgebungsvariable
HUBSPOT_TOKEN oder in der Datei ~/.config/zoller/hubspot-token. Das Token wird nie ausgegeben.
Domains, Theme-Namen und Dateiordner: content/hubspot.json. Nur Python-Standardbibliothek nötig.
"""
import hashlib
import html
import http.server
import json
import mimetypes
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITES = json.load(open(os.path.join(ROOT, "content", "sites.json"), encoding="utf-8"))
CFG = json.load(open(os.path.join(ROOT, "content", "hubspot.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "dist", "hubspot")
FOLDER = CFG["files_folder"].strip("/")
ASSET_BASE = f"/hubfs/{FOLDER}/"
FILES = os.path.join(OUT, "files")
FILE_DIRS = ("assets", "fileadmin", "_assets", "typo3temp", "typo3conf")
API = "https://api.hubapi.com"
WARN = []

esc = html.escape


def warn(msg):
    if msg not in WARN:
        WARN.append(msg)


def site_url(sid):
    """Adresse der Länderseite auf HubSpot (https://domain/) – leer, solange keine Domain eingetragen ist."""
    d = CFG["sites"].get(sid, {}).get("domain", "").strip().strip("/")
    d = re.sub(r"^https?://", "", d)
    return f"https://{d}/" if d else ""


def theme_of(sid):
    return CFG["sites"][sid]["theme"]


# ======================================================= Dateinamen ====
TRANS = {"ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss", "μ": "mu", "µ": "mu",
         "–": "-", "—": "-", "&": "-", "+": "-"}
SAFE_OF = {}   # Dateipfad (Original) -> sicherer Pfad
ORIG_OF = {}   # sicherer Pfad -> Original (Kollisionen erkennen)


def safe_path(rel):
    """Dateipfad, den der HubSpot-Dateimanager unverändert übernimmt: nur A–Z, 0–9, . _ - (Umlaute umschreiben)."""
    rel = unicodedata.normalize("NFC", urllib.parse.unquote(rel))
    if rel in SAFE_OF:
        return SAFE_OF[rel]
    segs = []
    for seg in rel.split("/"):
        s = "".join(TRANS.get(c, c) for c in seg)
        s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
        s = re.sub(r"[^A-Za-z0-9._-]+", "-", s)
        segs.append(s)
    out = "/".join(segs)
    if ORIG_OF.get(out, rel) != rel:   # zwei Originale ergeben denselben Namen
        stem, ext = os.path.splitext(out)
        out = f"{stem}-{hashlib.md5(rel.encode()).hexdigest()[:6]}{ext}"
    SAFE_OF[rel], ORIG_OF[out] = out, rel
    return out


# ============================================================ URLs ====
GH = sorted(((sid, s["url"]) for sid, s in SITES.items()), key=lambda kv: -len(kv[1]))   # bisherige Adressen (GitHub Pages)
URLISH = re.compile(r"^(?:\.\.?/|(?:assets|fileadmin|_assets|typo3temp|typo3conf)/|https://mzollercreations\.github\.io/)")
URL_ATTRS = {"href", "src", "poster", "action", "data-src", "data-href", "data-poster", "data-cutout", "data-base"}


class Page:
    def __init__(self, sid, rel_dir):
        self.sid = sid
        self.url = SITES[sid]["url"] + (rel_dir + "/" if rel_dir else "")   # Adresse der statischen Seite (Bezug für relative Links)

    def map(self, val, absolute=False):
        """Link oder Dateipfad der statischen Seite -> Ziel auf HubSpot. absolute=True: volle Adresse (hreflang, og:image)."""
        if not val or val.startswith(("#", "mailto:", "tel:", "javascript:", "data:", "blob:")):
            return val
        full = urllib.parse.urljoin(self.url, val)
        for sid, base in GH:
            if not (full.startswith(base) or full + "/" == base):
                continue
            rest = full[len(base):]
            path, frag = (rest.split("#", 1) + [""])[:2]
            path, query = (path.split("?", 1) + [""])[:2]
            tail = ("?" + query if query else "") + ("#" + frag if frag else "")
            own = site_url(self.sid)
            if path.split("/")[0] in FILE_DIRS:
                return (own.rstrip("/") if absolute and own else "") + ASSET_BASE + safe_path(path) + tail
            path = re.sub(r"(^|/)index\.html$", "", path).rstrip("/")
            target = site_url(sid)
            if sid == self.sid:
                if absolute and not target:
                    warn(f"Keine Domain für »{sid}« in content/hubspot.json – hreflang/og:image bleiben relativ.")
                return (target.rstrip("/") if absolute and target else "") + "/" + path + tail
            if not target:
                warn(f"Keine Domain für »{sid}« in content/hubspot.json – Links dorthin zeigen weiter auf GitHub Pages.")
                return val if val.startswith("http") else full
            return target + path + tail
        return val

    def attrs(self, tag, s):
        """Attribute eines Tags umschreiben (s = Attributteil inkl. führendem Leerraum)."""
        rel = re.search(r'\srel="([^"]*)"', s)
        alternate = tag == "link" and rel and "alternate" in rel.group(1).split()

        def one(m):
            lead, name, raw = m.group(1), m.group(2), m.group(3)
            low = name.lower()
            val = html.unescape(raw)
            if low == "srcset":
                new = ", ".join(" ".join([self.map(p.split()[0])] + p.split()[1:]) for p in re.split(r",\s+", val.strip()) if p.strip())
            elif low == "style" and "url(" in val:
                new = css_urls(val, self.map)
            elif low in URL_ATTRS or (URLISH.match(val) and low not in ("data-root", "data-index")):
                new = self.map(val, absolute=alternate or low == "content")
            else:
                return m.group(0)
            if new == val:
                return m.group(0)
            return f'{lead}{name}="{new.replace("&", "&amp;").replace(chr(34), "&quot;")}"'
        return re.sub(r'(\s+)([^\s=>/"\']+)="([^"]*)"', one, s)

    def rewrite(self, doc):
        """Alle Links und Dateipfade eines HTML-Stücks: Tags, Inline-JSON (Importmap, Globus-Daten) und <style>."""
        def tag(m):
            return f"<{m.group(1)}{self.attrs(m.group(1).lower(), m.group(2) or '')}{m.group(3)}>"
        doc = re.sub(r"<([a-zA-Z][\w-]*)((?:\s+[^\s=>/\"']+(?:\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>\"']+))?)*)(\s*/?)>", tag, doc)

        def script(m):
            body = re.sub(r'"((?:\.\.?/)+(?:assets|fileadmin)/[^"]*|(?:assets|fileadmin)/[^"]*\.js|https://mzollercreations\.github\.io/[^"]*)"',
                          lambda u: '"' + self.map(u.group(1)).replace('"', '\\"') + '"', m.group(2))
            return m.group(1) + body + m.group(3)
        doc = re.sub(r"(<script\b[^>]*>)(.*?)(</script>)", script, doc, flags=re.S)
        doc = re.sub(r"(<style\b[^>]*>)(.*?)(</style>)", lambda m: m.group(1) + css_urls(m.group(2), self.map) + m.group(3), doc, flags=re.S)
        return doc


def css_urls(css, fn):
    def rep(m):
        q, u = m.group(1) or "", m.group(2)
        return f"url({q}{fn(u)}{q})" if not u.startswith(("data:", "#")) else m.group(0)
    return re.sub(r"url\(\s*(&quot;|['\"])?([^'\")&]+?)\1?\s*\)", rep, css)


# ========================================================== Export ====
def site_dir(sid):
    return os.path.join(ROOT, SITES[sid]["out"])


def page_dirs(src):
    """Relative Ordner aller Seiten (index.html) einer gebauten Länderseite, ohne Weiterleitungen."""
    for dirpath, dirnames, filenames in os.walk(src):
        rel = os.path.relpath(dirpath, src)
        rel = "" if rel == "." else rel
        dirnames[:] = sorted(d for d in dirnames if not d.startswith(".") and not (rel == "" and d in FILE_DIRS))
        if "index.html" in filenames:
            doc = open(os.path.join(dirpath, "index.html"), encoding="utf-8").read()
            if 'http-equiv="refresh"' not in doc[:600]:
                yield rel.replace(os.sep, "/"), doc


def link_file(src, dest):
    """Datei in den Upload-Ordner legen (harter Link, sonst Kopie) – nur wenn sie sich geändert hat."""
    try:
        if os.path.samefile(src, dest):
            return False
        os.remove(dest)
    except FileNotFoundError:
        pass
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        os.link(src, dest)
    except OSError:
        import shutil
        shutil.copy2(src, dest)
    return True


def export_files(sid):
    """Dateien der Länderseite in dist/hubspot/files/<ordner>/ (gemeinsam für alle Länderseiten)."""
    src = site_dir(sid)
    dest = os.path.join(FILES, FOLDER)
    n = changed = size = 0
    sources = [(os.path.join(ROOT, "assets"), "assets")] + [(os.path.join(src, d), d) for d in FILE_DIRS if d != "assets"]
    for base, prefix in sources:
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if not d.startswith(".")]
            for f in filenames:
                if f.startswith(".") or (prefix == "assets" and f.startswith("search-index")):
                    continue
                full = os.path.join(dirpath, f)
                rel = prefix + "/" + os.path.relpath(full, base).replace(os.sep, "/")
                changed += link_file(full, os.path.join(dest, safe_path(rel)))
                n += 1
                size += os.path.getsize(full)
    # Suchindex je Länderseite und Sprache: Pfade ohne / am Ende (so liefert HubSpot die Seiten aus)
    for loc in SITES[sid]["locales"]:
        name = "search-index.json" if not loc["dir"] else f"search-index-{loc['lang']}.json"
        idx = json.load(open(os.path.join(src, "assets", name), encoding="utf-8"))
        for e in idx:
            e["u"] = e["u"].rstrip("/")
        target = os.path.join(dest, "assets", "search", f"{sid}-{loc['lang']}.json")
        os.makedirs(os.path.dirname(target), exist_ok=True)
        data = json.dumps(idx, ensure_ascii=False, separators=(",", ":"))
        if not os.path.exists(target) or open(target, encoding="utf-8").read() != data:
            open(target, "w", encoding="utf-8").write(data)
            changed += 1
        n += 1
    return n, changed, size


DOC_RE = re.compile(r"(?s)\s*<!doctype html>\s*<html([^>]*)>\s*<head>(.*?)</head>\s*<body([^>]*)>(.*)</body>\s*</html>\s*$", re.I)


def split_doc(doc):
    m = DOC_RE.match(doc)
    if not m:
        raise ValueError("unerwarteter Seitenaufbau")
    return m.groups()


def attr(s, name):
    m = re.search(rf'\s{name}="([^"]*)"', s)
    return html.unescape(m.group(1)) if m else ""


def raw(s):
    if "{% endraw %}" in s:
        raise ValueError("{% endraw %} im Seiteninhalt")
    return "{% raw %}" + s + "{% endraw %}"


def template(label, kind, tpl_rel, lang, title, desc, head, body_attrs, body):
    """HubL-Template einer Seite: erbt den Kopf aus templates/layouts/base.html, Inhalt unverändert in {% raw %}."""
    base = os.path.relpath("templates/layouts/base.html", os.path.dirname(tpl_rel)).replace(os.sep, "/")
    return f"""<!--
  templateType: {kind}
  isAvailableForNewContent: true
  label: {label}
-->
{{% extends "{base}" %}}
{{% block lang %}}{lang}{{% endblock lang %}}
{{% block title %}}{{% if page_meta.html_title %}}{{{{ page_meta.html_title }}}}{{% else %}}{raw(esc(title, quote=False))}{{% endif %}}{{% endblock title %}}
{{% block description %}}{{% if page_meta.meta_description %}}<meta name="description" content="{{{{ page_meta.meta_description|escape_attr }}}}">{{% else %}}{raw(f'<meta name="description" content="{esc(desc)}">')}{{% endif %}}{{% endblock description %}}
{{% block head %}}{raw(head)}{{% endblock head %}}
{{% block body_attrs %}}{raw(body_attrs)}{{% endblock body_attrs %}}
{{% block body %}}{raw(body)}{{% endblock body %}}
"""


BASE = """<!--
  templateType: none
-->
<!doctype html>
<html lang="{% block lang %}{{ html_lang }}{% endblock lang %}" class="no-js">
<head>
<meta charset="utf-8">
<title>{% block title %}{{ page_meta.html_title }}{% endblock title %}</title>
{% block description %}{% if page_meta.meta_description %}<meta name="description" content="{{ page_meta.meta_description|escape_attr }}">{% endif %}{% endblock description %}
{% block head %}{% endblock head %}
{{ standard_header_includes }}
</head>
<body {% block body_attrs %}{% endblock body_attrs %}>
{% block body %}{% endblock body %}
{{ standard_footer_includes }}
</body>
</html>
"""

# Vom Kopf der statischen Seite entfallen: Titel/Beschreibung (Seiteneinstellungen), canonical und og:title (setzt HubSpot)
HEAD_DROP = re.compile(r'<meta charset="[^"]*">\n?|<title>.*?</title>\n?|<meta name="description"[^>]*>\n?|<link rel="canonical"[^>]*>\n?'
                       r'|<meta property="og:title"[^>]*>\n?|<base [^>]*>\n?', re.S)


def convert(sid, rel_dir, doc, index_of):
    """Statische Seite -> (Template-Text, Seitendaten)."""
    html_attrs, head, body_attrs, body = split_doc(doc)
    page = Page(sid, rel_dir)
    lang = attr(html_attrs, "lang") or "en"
    title = html.unescape(re.search(r"<title>(.*?)</title>", head, re.S).group(1)).strip()
    desc = attr(re.search(r'<meta name="description"[^>]*>', head).group(0), "content") if '<meta name="description"' in head else ""
    head = page.rewrite(HEAD_DROP.sub("", head)).strip("\n")
    head = re.sub(r"\n{2,}", "\n", head)
    idx = index_of(attr(body_attrs, "data-index"))
    cls = attr(body_attrs, "class")
    body_attrs = f'class="{esc(cls)}" data-root="/" data-assets="{ASSET_BASE}" data-index="{idx}"'
    return lang, title, desc, head, body_attrs, page.rewrite(body).strip("\n")


def export(sid):
    t0 = time.time()
    src = site_dir(sid)
    if not os.path.exists(os.path.join(src, "index.html")):
        sys.exit(f"{src} fehlt – zuerst: python3 tools/build.py --site {sid}")
    cfg = CFG["sites"][sid]
    theme = cfg["theme"]
    label = cfg["label"]
    out = os.path.join(OUT, sid)
    tdir = os.path.join(out, "theme", theme)
    import shutil
    shutil.rmtree(os.path.join(out, "theme"), ignore_errors=True)
    os.makedirs(os.path.join(tdir, "templates", "layouts"))
    n_files, n_changed, size = export_files(sid)

    default_lang = SITES[sid]["locales"][0]["lang"]

    def index_of(data_index):
        m = re.search(r"search-index-(\w+)\.json", data_index or "")
        return f"assets/search/{sid}-{m.group(1) if m else default_lang}.json"

    pages = []
    for rel_dir, doc in page_dirs(src):
        lang, title, desc, head, battrs, body = convert(sid, rel_dir, doc, index_of)
        tpl_rel = f"templates/pages/{rel_dir or 'index'}.html"
        if not re.fullmatch(r"[a-z0-9/-]*", rel_dir):
            warn(f"Ungewöhnlicher Seitenpfad (HubSpot-Slug prüfen): /{rel_dir}")
        target = os.path.join(tdir, tpl_rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        open(target, "w", encoding="utf-8").write(template(f"{label} · /{rel_dir}", "page", tpl_rel, lang, title, desc, head, battrs, body))
        short = re.sub(r"\s*\|\s*ZOLLER\s*$", "", title)
        pages.append({"slug": rel_dir, "template": f"{theme}/{tpl_rel}", "title": title, "description": desc,
                      "language": lang.lower(), "name": f"{label} · {short}"[:250]})
    # 404-Seite als HubSpot-Systemseite (Einstellungen > Website > Seiten > Systemseiten)
    doc404 = open(os.path.join(src, "404.html"), encoding="utf-8").read()
    lang, title, desc, head, battrs, body = convert(sid, "", doc404, index_of)
    tpl_rel = "templates/system/404.html"
    os.makedirs(os.path.join(tdir, "templates", "system"), exist_ok=True)
    open(os.path.join(tdir, tpl_rel), "w", encoding="utf-8").write(template(f"{label} · 404", "error_page", tpl_rel, lang, title, desc, head, battrs, body))
    open(os.path.join(tdir, "templates", "layouts", "base.html"), "w", encoding="utf-8").write(BASE)
    json.dump({"label": label, "preview_path": "./templates/pages/index.html", "enable_domain_stylesheets": False, "version": "1.0",
               "author": {"name": "mzollercreations", "url": "https://github.com/mzollercreations"}, "is_available_for_new_content": True},
              open(os.path.join(tdir, "theme.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    json.dump({"site": sid, "theme": theme, "domain": cfg.get("domain", ""), "files_folder": FOLDER, "pages": pages,
               "system": {"404": f"{theme}/{tpl_rel}"}}, open(os.path.join(out, "pages.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    audit(sid, tdir, {p["slug"] for p in pages})
    print(f"{label}: {len(pages)} Seiten-Templates + 404 -> {os.path.relpath(tdir, ROOT)} | "
          f"{n_files} Dateien ({size / 1e6:.0f} MB, {n_changed} neu/geändert) -> {os.path.relpath(os.path.join(FILES, FOLDER), ROOT)} "
          f"| {time.time() - t0:.1f} s")


def audit(sid, tdir, slugs):
    """Nach dem Export: keine relativen Pfade, keine GitHub-Adressen eingetragener Domains, alle Dateien und Seiten vorhanden."""
    rel_left, missing, dead = set(), set(), set()
    gh_left = 0
    configured = [SITES[s]["url"] for s in SITES if site_url(s)]
    for dirpath, _d, files in os.walk(tdir):
        for f in files:
            if not f.endswith(".html"):
                continue
            s = open(os.path.join(dirpath, f), encoding="utf-8").read()
            for m in re.finditer(r'\s(?:href|src|poster|content|value|data-(?!index)[\w-]+)="((?:\.\.?/|assets/|fileadmin/)[^"]*)"', s):
                rel_left.add(m.group(1))
            for m in re.finditer(r'(?:"|\'|\()/hubfs/' + re.escape(FOLDER) + r'/([^"\'?#)\s]+)', s):
                p = urllib.parse.unquote(html.unescape(m.group(1)))
                if not p.endswith("/") and not os.path.exists(os.path.join(FILES, FOLDER, p)):
                    missing.add(p)
            for m in re.finditer(r'\s(?:href|value)="(/(?!hubfs/)[^"#?]*)', s):
                if m.group(1).strip("/") not in slugs:
                    dead.add(m.group(1))
            gh_left += sum(s.count(u) for u in configured)
    if dead:
        warn(f"{sid}: {len(dead)} interne Links ohne Seite, z. B. {sorted(dead)[:5]}")
    if rel_left:
        warn(f"{sid}: {len(rel_left)} relative Pfade übrig, z. B. {sorted(rel_left)[:3]}")
    if missing:
        warn(f"{sid}: {len(missing)} verlinkte Dateien fehlen im Upload-Ordner, z. B. {sorted(missing)[:3]}")
    if gh_left:
        warn(f"{sid}: {gh_left} Verweise auf GitHub-Pages-Adressen von Länderseiten mit HubSpot-Domain")


# ============================================================ Preview ====
def render(tpl_path, meta):
    """Sehr kleiner HubL-Ersatz für die Vorschau: Vererbung, Blöcke, raw, page_meta, if/else."""
    tdir = tpl_path[:tpl_path.rindex(os.sep + "templates" + os.sep)]   # …/theme/<theme>
    child = open(tpl_path, encoding="utf-8").read()
    base = open(os.path.join(tdir, "templates", "layouts", "base.html"), encoding="utf-8").read()
    blocks = dict(re.findall(r"(?s){% block (\w+) %}(.*?){% endblock \1 %}", child))
    out = re.sub(r"(?s){% block (\w+) %}(.*?){% endblock \1 %}", lambda m: blocks.get(m.group(1), m.group(2)), base)
    out = re.sub(r"(?s)^<!--.*?-->\n", "", out)

    def cond(m):
        key, yes, no = m.group(1), m.group(2), m.group(3) or ""
        return yes if meta.get(key) else no
    out = re.sub(r"(?s){% if page_meta\.(\w+) %}(.*?)(?:{% else %}(.*?))?{% endif %}", cond, out)
    res = []
    for p in re.split(r"(?s)({% raw %}.*?{% endraw %})", out):
        if p.startswith("{% raw %}"):
            res.append(p[9:-12])
            continue
        p = p.replace("{{ page_meta.meta_description|escape_attr }}", esc(meta.get("meta_description", "")))
        p = p.replace("{{ page_meta.html_title }}", esc(meta.get("html_title", ""), quote=False))
        p = p.replace("{{ standard_header_includes }}", "<!-- standard_header_includes -->")
        p = p.replace("{{ standard_footer_includes }}", "<!-- standard_footer_includes -->")
        p = p.replace("{{ html_lang }}", "en")
        res.append(p)
    return "".join(res)


def preview(sid, port):
    man = json.load(open(os.path.join(OUT, sid, "pages.json"), encoding="utf-8"))
    tdir = os.path.join(OUT, sid, "theme")
    by_slug = {p["slug"]: p for p in man["pages"]}

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def send_body(self, code, data, ctype, extra=None):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)

        def do_HEAD(self):
            self.do_GET()

        def do_GET(self):
            path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
            if path.startswith(ASSET_BASE):
                f = os.path.join(FILES, FOLDER, path[len(ASSET_BASE):])
                if not os.path.isfile(f):
                    return self.send_body(404, b"not found", "text/plain")
                ctype = mimetypes.guess_type(f)[0] or "application/octet-stream"
                if f.endswith((".js", ".mjs")):
                    ctype = "application/javascript"
                size = os.path.getsize(f)
                rng = re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
                with open(f, "rb") as fh:
                    if rng and (rng.group(1) or rng.group(2)):
                        a = int(rng.group(1)) if rng.group(1) else size - int(rng.group(2))
                        b = int(rng.group(2)) if rng.group(1) and rng.group(2) else size - 1
                        fh.seek(a)
                        return self.send_body(206, fh.read(b - a + 1), ctype, {"Content-Range": f"bytes {a}-{b}/{size}", "Accept-Ranges": "bytes"})
                    return self.send_body(200, fh.read(), ctype, {"Accept-Ranges": "bytes"})
            if path != "/" and path.endswith("/"):   # HubSpot: Seiten ohne / am Ende
                self.send_response(301)
                self.send_header("Location", path.rstrip("/"))
                self.end_headers()
                return
            p = by_slug.get(path.strip("/"))
            tpl = p["template"] if p else man["system"]["404"]
            meta = {"html_title": p["title"], "meta_description": p["description"]} if p else {}
            self.send_body(200 if p else 404, render(os.path.join(tdir, tpl), meta).encode("utf-8"), "text/html; charset=utf-8")

    print(f"Vorschau {CFG['sites'][sid]['label']}: http://localhost:{port}/  (Strg+C beendet)")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()


# ================================================================ API ====
class ApiError(Exception):
    def __init__(self, code, msg):
        super().__init__(f"HTTP {code}: {msg[:600]}")
        self.code = code


def token():
    t = os.environ.get("HUBSPOT_TOKEN", "").strip()
    f = os.path.expanduser("~/.config/zoller/hubspot-token")
    if not t and os.path.exists(f):
        t = open(f, encoding="utf-8").read().strip()
    if not t:
        sys.exit("Kein HubSpot-Token: Private App mit den Scopes »content« und »files« anlegen und das Token in "
                 "~/.config/zoller/hubspot-token speichern (oder HUBSPOT_TOKEN setzen).")
    return t


def multipart(fields):
    boundary = uuid.uuid4().hex
    parts = []
    for name, v in fields:
        if isinstance(v, tuple):
            fn, data, ctype = v
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{fn}"\r\n'
                         f"Content-Type: {ctype}\r\n\r\n".encode() + data + b"\r\n")
        else:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def api(method, path, body=None, files=None, query=None):
    url = API + path + ("?" + urllib.parse.urlencode(query) if query else "")
    headers = {"Authorization": f"Bearer {TOKEN}"}
    data = None
    if files is not None:
        data, headers["Content-Type"] = multipart(files)
    elif body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    for attempt in range(7):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=headers), timeout=300) as r:
                raw_ = r.read()
                return json.loads(raw_) if raw_.strip() else {}
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")
            if e.code == 429 or e.code >= 500:
                time.sleep(float(e.headers.get("Retry-After") or 0) or min(2 ** attempt, 30))
                continue
            raise ApiError(e.code, msg) from None
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(min(2 ** attempt, 30))
    raise ApiError(0, "keine Antwort von HubSpot")


def sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_state(f):
    return json.load(open(f)) if os.path.exists(f) else {}


def run_parallel(items, fn, state, state_file, what):
    """items: [(schlüssel, hash)] – fn(schlüssel) lädt hoch; Stand wird laufend gespeichert (Abbruch = Fortsetzung)."""
    errors = []
    done = 0

    def one(item):
        key, h = item
        try:
            fn(key)
            return key, h, None
        except ApiError as e:
            return key, h, str(e)
    with ThreadPoolExecutor(4) as ex:
        for key, h, err in ex.map(one, items):
            done += 1
            if err:
                errors.append((key, err))
            else:
                state[key] = h
            if done % 50 == 0 or done == len(items):
                json.dump(state, open(state_file, "w"), indent=0, sort_keys=True)
                print(f"  {what}: {done}/{len(items)}", flush=True)
    for key, err in errors[:15]:
        print(f"  FEHLER {key}: {err}")
    if errors:
        print(f"  {len(errors)} Fehler – erneuter Aufruf lädt nur die fehlenden nach.")
    return errors


def upload_files(force, only=None):
    state_file = os.path.join(OUT, ".state-files.json")
    state = {} if force else load_state(state_file)
    items = []
    for dirpath, _d, files in os.walk(os.path.join(FILES, FOLDER)):
        for f in files:
            if f.startswith("."):
                continue
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, FILES).replace(os.sep, "/")
            if only is not None and not rel.startswith(FOLDER + "/assets/") and rel not in only:
                continue
            h = sha1(full)
            if state.get(rel) != h:
                items.append((rel, h))
    print(f"Dateimanager: {len(items)} Dateien hochzuladen (Ordner /{FOLDER}/)")
    renamed = []

    def one(rel):
        folder, name = rel.rsplit("/", 1)
        data = open(os.path.join(FILES, rel), "rb").read()
        res = api("POST", "/filemanager/api/v3/files/upload", files=[
            ("file", (name, data, mimetypes.guess_type(name)[0] or "application/octet-stream")),
            ("fileName", name), ("folderPath", folder),
            ("options", json.dumps({"access": "PUBLIC_INDEXABLE", "overwrite": True}))])
        obj = (res.get("objects") or [res])[0]
        url = urllib.parse.unquote(obj.get("url") or obj.get("default_hosting_url") or "")
        if url and not url.split("?")[0].endswith("/" + rel):
            renamed.append((rel, url))
    errors = run_parallel(items, one, state, state_file, "Dateien")
    for rel, url in renamed[:15]:
        print(f"  ACHTUNG: HubSpot hat {rel} unter anderem Namen abgelegt: {url}")
    return errors


def upload_theme(sid, force, only=None):
    tdir = os.path.join(OUT, sid, "theme")
    state_file = os.path.join(OUT, sid, ".state-theme.json")
    state = {} if force else load_state(state_file)
    items = []
    for dirpath, _d, files in os.walk(tdir):
        for f in files:
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, tdir).replace(os.sep, "/")
            if only is not None and "/templates/pages/" in rel and rel not in only:
                continue
            h = sha1(full)
            if state.get(rel) != h:
                items.append((rel, h))
    # theme.json und Grundlayout zuerst – die Seiten-Templates erben davon
    items.sort(key=lambda kv: (not kv[0].endswith("theme.json"), "/layouts/" not in kv[0], kv[0]))
    print(f"Design-Manager: {len(items)} Dateien hochzuladen (Theme {theme_of(sid)})")

    def one(rel):
        data = open(os.path.join(tdir, rel), "rb").read()
        api("PUT", "/cms/v3/source-code/published/content/" + urllib.parse.quote(rel),
            files=[("file", (rel.rsplit("/", 1)[-1], data, "application/octet-stream"))])
    first = [kv for kv in items if kv[0].endswith("theme.json") or "/layouts/" in kv[0]]
    errors = run_parallel(first, one, state, state_file, "Theme-Grundlage")
    if errors:
        return errors
    return run_parallel(items[len(first):], one, state, state_file, "Templates")


def list_pages():
    out, after = [], None
    while True:
        q = {"limit": 100}
        if after:
            q["after"] = after
        res = api("GET", "/cms/v3/pages/site-pages", query=q)
        out += res.get("results", [])
        after = (res.get("paging") or {}).get("next", {}).get("after")
        if not after:
            return out


def upload_pages(sid, publish, only=None):
    man = json.load(open(os.path.join(OUT, sid, "pages.json"), encoding="utf-8"))
    domain = re.sub(r"^https?://", "", CFG["sites"][sid].get("domain", "")).strip("/")
    if publish and not domain:
        sys.exit(f"Veröffentlichen erst mit eigener Domain für »{sid}« in content/hubspot.json.")
    if not domain:
        print("  Ohne eigene Domain: Entwürfe liegen auf der HubSpot-Systemdomain (Vorschau nur für eingeloggte HubSpot-Nutzer).")
    todo = [p for p in man["pages"] if only is None or p["template"] in only]
    prefix = man["theme"] + "/templates/pages/"
    existing = {p.get("templatePath", ""): p for p in list_pages() if p.get("templatePath", "").startswith(prefix)}
    created = updated = 0
    errors = []

    def create(p):
        body = {"name": p["name"], "templatePath": p["template"], "slug": p["slug"], "htmlTitle": p["title"],
                "metaDescription": p["description"], "language": p["language"], "state": "DRAFT"}
        if domain:
            body["domain"] = domain
        try:
            return api("POST", "/cms/v3/pages/site-pages", body=body)
        except ApiError as e:
            if e.code == 400 and "language" in str(e).lower():
                body["language"] = p["language"].split("-")[0]   # Konto kennt die Landesvariante nicht
                return api("POST", "/cms/v3/pages/site-pages", body=body)
            raise

    for p in todo:
        cur = existing.get(p["template"])
        try:
            if not cur:
                existing[p["template"]] = create(p)
                created += 1
            else:
                diff = {k: v for k, v in (("htmlTitle", p["title"]), ("metaDescription", p["description"])) if (cur.get(k) or "") != v}
                if domain and (cur.get("domain") or "") != domain:
                    diff["domain"] = domain   # Entwurf von der Systemdomain auf die eigene Domain umziehen
                if diff:
                    api("PATCH", f"/cms/v3/pages/site-pages/{cur['id']}", body=diff)
                    updated += 1
        except ApiError as e:
            errors.append((p["slug"], str(e)))
        if (created + updated) and (created + updated) % 50 == 0:
            print(f"  Seiten: {created} angelegt, {updated} aktualisiert", flush=True)
    print(f"Seiten {CFG['sites'][sid]['label']}: {created} neu als Entwurf, {updated} aktualisiert, "
          f"{len(todo) - created - updated - len(errors)} unverändert")
    for slug, err in errors[:15]:
        print(f"  FEHLER /{slug}: {err}")
    wanted = {p["template"] for p in man["pages"]}
    orphans = [p for t, p in existing.items() if t not in wanted] if only is None else []
    if orphans:
        print(f"  {len(orphans)} Seiten gibt es im Build nicht mehr (z. B. vergangene Events) – in HubSpot prüfen/archivieren:")
        for p in orphans[:20]:
            print("   ", p.get("url") or p.get("slug"))
    if publish:
        drafts = [p for p in existing.values() if p.get("id") and (p.get("currentState") or p.get("state") or "DRAFT").startswith("DRAFT")
                  and p.get("templatePath") in wanted and (only is None or p.get("templatePath") in only)]
        when = (datetime.now(timezone.utc) + timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        n = 0
        for p in drafts:
            try:
                api("POST", "/cms/v3/pages/site-pages/schedule", body={"id": str(p["id"]), "publishDate": when})
                n += 1
            except ApiError as e:
                print(f"  FEHLER Veröffentlichen {p.get('slug')}: {e}")
        print(f"  {n} Seiten werden in etwa einer Minute veröffentlicht ({when}).")
    elif created:
        print("  Neue Seiten sind Entwürfe – in HubSpot unter Inhalte > Website-Seiten > Vorschau prüfen, dann mit --publish veröffentlichen.")
    print(f"  404-Seite: Einstellungen > Inhalte > Seiten > Systemseiten > 404 > Template »{man['system']['404']}«")
    return errors


def test_selection(sid):
    """Kleine Auswahl für einen ersten Test auf HubSpot: Startseite(n) mit Kamerafahrt und 3D-Halle, eine Produktbühne,
    der Standort-Globus und die 404-Seite – mit allen Dateien, die diese Seiten brauchen (plus assets/ komplett)."""
    man = json.load(open(os.path.join(OUT, sid, "pages.json"), encoding="utf-8"))
    tdir = os.path.join(OUT, sid, "theme")
    homes = {""} | {l["dir"] for l in SITES[sid]["locales"] if l["dir"]}
    pages = [p for p in man["pages"] if p["slug"] in homes]
    for marker in ("/assets/js/productstage.js", "/assets/js/globe.js"):
        # bevorzugt »venturion« (Produktname in allen Sprachen gleich), sonst die flachste Seite
        for p in sorted(man["pages"], key=lambda p: (not p["slug"].endswith("/venturion"), p["slug"].count("/"), p["slug"])):
            if p not in pages and marker in open(os.path.join(tdir, p["template"]), encoding="utf-8").read():
                pages.append(p)
                break
    templates = {p["template"] for p in pages} | {man["system"]["404"]}
    files = set()
    for t in templates:
        txt = open(os.path.join(tdir, t), encoding="utf-8").read()
        for m in re.finditer(r"/hubfs/" + re.escape(FOLDER) + r"/([^\"'?#)\s]+)", txt):
            f = urllib.parse.unquote(html.unescape(m.group(1)))
            if not f.endswith("/"):
                files.add(FOLDER + "/" + f)
    print("Test-Auswahl:", ", ".join("/" + p["slug"] for p in pages), "+ 404")
    return templates, files


def status():
    info = api("GET", "/account-info/v3/details")
    print(f"Portal {info.get('portalId')} ({info.get('accountType', '')}, Datenhaltung {info.get('dataHostingLocation', '?')})")
    try:
        doms = api("GET", "/cms/v3/domains/").get("results", [])
    except ApiError as e:
        doms = []
        print("  Domains nicht lesbar:", e)
    names = {d.get("domain") for d in doms}
    for d in doms:
        print(f"  Domain {d.get('domain')}: {'aktiv' if d.get('isResolving') else 'DNS noch nicht aktiv'}"
              f"{', Website-Seiten' if d.get('isUsedForSitePage') else ''}")
    for sid, c in CFG["sites"].items():
        d = c.get("domain", "")
        state = "nicht eingetragen" if not d else ("verbunden" if d in names else "NICHT in HubSpot verbunden")
        print(f"  {c['label']}: Domain {d or '–'} ({state})")


def check(sid):
    base = site_url(sid)
    if not base:
        sys.exit(f"Keine Domain für »{sid}« in content/hubspot.json")
    urls = [base, base + "hubfs/" + FOLDER + "/assets/css/main.css", base + "hubfs/" + FOLDER + "/assets/js/main.js",
            base + "hubfs/" + FOLDER + "/assets/vendor/three.module.min.js", base + "hubfs/" + FOLDER + "/assets/fonts/T-Star-Regular.woff2"]
    for u in urls:
        try:
            with urllib.request.urlopen(urllib.request.Request(u, method="GET", headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as r:
                ct = r.headers.get("Content-Type", "")
                bad = u.endswith(".js") and "javascript" not in ct
                print(f"  {r.status} {ct:40} {u}{'   <- JavaScript als ' + ct + ': Einstellungen > Inhalte > Seiten > SEO & Crawler > Default File Manager Hosting Domain auf diese Domain stellen' if bad else ''}")
        except urllib.error.HTTPError as e:
            print(f"  {e.code} {'':40} {u}")


# =============================================================== Main ====
def main():
    global TOKEN
    args = sys.argv[1:]
    if not args or args[0] not in ("export", "preview", "status", "upload", "check"):
        sys.exit(__doc__)
    cmd = args[0]
    sid = args[1] if len(args) > 1 and not args[1].startswith("-") else ""
    if cmd == "export":
        for s in (list(CFG["sites"]) if sid == "all" else [sid]):
            if s not in CFG["sites"]:
                sys.exit(f"Unbekannte Länderseite »{s}« ({', '.join(CFG['sites'])}, all)")
            export(s)
        for w in WARN:
            print("Hinweis:", w)
        return
    if cmd == "preview":
        port = int(args[args.index("--port") + 1]) if "--port" in args else 8795
        return preview(sid or "us", port)
    if cmd == "check":
        return check(sid)
    TOKEN = token()
    if cmd == "status":
        return status()
    if sid not in CFG["sites"]:
        sys.exit("upload us|ca|mx|de [files] [theme] [pages] [--test] [--publish] [--force]")
    if not os.path.exists(os.path.join(OUT, sid, "pages.json")):
        sys.exit(f"Zuerst exportieren: python3 tools/hubspot.py export {sid}")
    parts = [a for a in args[2:] if not a.startswith("-")] or ["files", "theme", "pages"]
    force = "--force" in args
    templates = files = None
    if "--test" in args:
        templates, files = test_selection(sid)
    if "files" in parts and upload_files(force, files):
        sys.exit("Abbruch: nicht alle Dateien hochgeladen.")
    if "theme" in parts and upload_theme(sid, force, templates):
        sys.exit("Abbruch: nicht alle Templates hochgeladen.")
    if "pages" in parts:
        upload_pages(sid, "--publish" in args, templates)


TOKEN = ""

if __name__ == "__main__":
    main()
