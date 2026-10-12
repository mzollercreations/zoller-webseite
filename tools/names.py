"""Produktnamen in den Länderfassungen reparieren (Kanada EN/FR, Mexiko ES, USA EN).

Die Länderfassungen von zoller.info sind maschinell übersetzt. Dabei wurden Markennamen teils mitübersetzt
(»titanium« statt »titan«, »gardien« statt »keeper«, »hiperión« statt »hyperion«) und die deutschen Guillemets mit
den französischen/spanischen Anführungszeichen verschachtelt (»« cockpit »«, »«genius»«, »the« »hyperion«,
»Hyperion 500/700,«). fix() bringt jeden Namen aus content/names.json auf die Schreibweise der deutschen Seite:
»name«. Ein Name wird nur angefasst, wenn links UND rechts Guillemets stehen – Fließtext (»génie universel«,
»aleaciones de titanio«) und Links (…/titanium/) bleiben unverändert.

Genutzt von tools/build.py (Länderseiten) und zoller-produktumgebung-3d/tools/build_locale.py (3D-Showroom).
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open(os.path.join(ROOT, "content", "names.json"), encoding="utf-8"))
# Artikel, die die Übersetzung mit in die Guillemets gezogen hat (»du titane« -> du »titan«)
ARTICLES = {"en": r"the|a|an", "fr": r"le|la|les|du|de|des|un|une", "es": r"el|la|los|las|un|una|de|del"}
SEP = r"(?:\s|&nbsp;)+"
_cache = {}


def _key(s):
    return re.sub(r"(?:\s|&nbsp;)+", " ", s).replace("❘", "|").lower()


def _setup(lang):
    if lang in _cache:
        return _cache[lang]
    canon = {_key(n): n for n in DATA["names"]}
    canon.update({_key(a): n for a, n in DATA["aliases"].get(lang, {}).items()})

    def pat(n):
        words = [r"[❘|]" if w in ("|", "❘") else re.escape(w) for w in n.split(" ")]
        return SEP.join(words)
    alts = "|".join(pat(n) for n in sorted(set(DATA["names"]) | set(DATA["aliases"].get(lang, {})), key=len, reverse=True))
    art = ARTICLES.get(lang, "")
    rx = re.compile(r"(?P<lead>[»«][»«\s]*)?"
                    + (rf"(?P<art>(?:{art}){SEP}|[ld]['’])?" if art else r"(?P<art>)")
                    + rf"(?<![\w.-])(?P<name>{alts})(?![\w-])", re.I)
    words = DATA["words"].get(lang, [])
    wrx = re.compile(r"»(" + "|".join(re.escape(w) for w in words) + r")«\s*", re.I) if words else None
    _cache[lang] = (rx, canon, wrx)
    return _cache[lang]


def _canonical(found, canon):
    target = canon[_key(found)]
    parts = re.split(r"((?:\s|&nbsp;)+)", found)
    words = target.split(" ")
    if len(parts) == 2 * len(words) - 1 and _key(found) == _key(target):
        # gleiche Wortzahl: Schreibweise des Namens, aber die Abstände des Textes (geschützte Leerzeichen bleiben)
        return "".join(words[i // 2] if i % 2 == 0 else p for i, p in enumerate(parts))
    return target


def _prev_quote(s, i):
    """Letztes Guillemet vor Position i (oder "")."""
    for j in range(i - 1, -1, -1):
        if s[j] in "»«":
            return s[j]
    return ""


def _next_quote(s, i):
    for j in range(i, len(s)):
        if s[j] in "»«":
            return s[j]
    return ""


def _fix_names(s, rx, canon):
    out, pos = [], 0
    for m in rx.finditer(s):
        a, b = m.span("name")
        if a < pos:
            continue
        # ---- links: Guillemets (und evtl. mitgezogener Artikel) vor dem Namen
        start = m.start("lead") if m.group("lead") else a
        start = max(start, pos)
        lead_end = m.start("art") if m.group("art") else a
        if start >= lead_end:
            continue
        lead = s[start:lead_end]
        if start > 0 and not s[start - 1].isspace() and s[start - 1] not in "([/–—-'’":
            # erstes Zeichen klebt am Wort davor: ein echtes schließendes « (zu einem » davor) bleibt dort stehen
            if lead[0] == "«" and _prev_quote(s, start) == "»":
                start += 1
                lead = lead[1:]
        if "»" not in lead and "«" not in lead:
            continue
        # ---- rechts: Guillemets, Leerzeichen und ein hineingerutschtes Satzzeichen (»smile 420,«)
        k, punct = b, ""
        while k < len(s):
            c = s[k]
            if c in "»«" or c.isspace():
                k += 1
            elif c in ",.;:" and not punct and k + 1 < len(s) and s[k + 1] in "»«":
                punct = c
                k += 1
            else:
                break
        post = s[b:k]
        nxt_word = k < len(s) and (s[k].isalnum())
        if nxt_word and re.search(r"\s", post):
            tail = re.split(r"\s", post)[-1]
            # »« am nächsten Wort: ein echtes öffnendes » (mit « dahinter) gehört zum nächsten Wort
            if tail == "»" and _next_quote(s, k) == "«":
                k -= 1
                post = post[:-1]
        if "»" not in post and "«" not in post:
            continue
        lead_ws = " " if (start > 0 and s[start - 1].isalnum()) or (lead[0].isspace() and start > pos) else ""
        trail_ws = " " if post and (post[-1].isspace() or (nxt_word and k < len(s))) else ""
        if trail_ws and k < len(s) and s[k] in ",.;:!?)":
            trail_ws = "" if s[k] != ":" else " "
        art = m.group("art") or ""
        new = lead_ws + art + "»" + _canonical(m.group("name"), canon) + "«" + punct + trail_ws
        out.append(s[pos:start])
        out.append(new)
        pos = k
    out.append(s[pos:])
    return "".join(out)


def _extend(s, canon):
    """Schließendes « zu früh: »hyperion« 300« -> »hyperion 300«, »toolOrganizer« 600 units« -> »toolOrganizer 600« units."""
    def rep(m):
        tail = m.group(2).rstrip(".,;:")
        punct = m.group(2)[len(tail):]
        words = tail.split(" ")
        for k in range(len(words), 0, -1):
            cand = m.group(1) + " " + " ".join(words[:k])
            if _key(cand) in canon:
                rest = " ".join(words[k:])
                return "»" + canon[_key(cand)] + "«" + (" " + rest if rest else "") + punct
        return m.group(0)
    return re.sub(r"»([^«»<]{1,40})«[  ]+([0-9A-Za-z|❘/.,;:\- ]{1,25}?)«", rep, s)


# Grenzen für Anführungszeichen: Tabellenzellen und Überschriften (Fließtext-Zitate laufen oft über mehrere Absätze)
CELL = re.compile(r"(<(/?)(td|th|h[1-6]|tr|table|tbody|thead)\b[^>]*>)", re.I)


def _balance(s, strict):
    """Übrig gebliebene, unpaarige Guillemets entfernen; Tags bleiben unberührt.
    Ein Paar ist »…« (deutsch) oder «…» (französisch/spanisch). Immer weg: leere Paare (»«), ein « am Absatzende,
    das erste von zwei öffnenden » (»the »hyperion«). strict (Englisch, sowie Tabellenzellen und Überschriften in jeder
    Sprache): alle unpaarigen Zeichen weg. Sonst bleiben sie stehen – französische/spanische Zitate beginnen oder
    enden oft in einem anderen Absatz oder Textfeld."""
    out, in_cell = [], False
    parts = CELL.split(s)
    i_part = 0
    while i_part < len(parts):
        part = parts[i_part]
        if i_part % 4 == 1:          # Tag aus CELL.split: (tag, "/", name) folgen als Gruppen
            in_cell = not parts[i_part + 1] and parts[i_part + 2].lower() in ("td", "th", "h1", "h2", "h3", "h4", "h5", "h6")
            out.append(part)
            i_part += 3
            continue
        out.append(_balance_part(part, strict or in_cell))
        i_part += 1
    return "".join(out)


def _balance_part(part, strict):
    pos, intag = [], False
    for i, c in enumerate(part):
        if c == "<":
            intag = True
        elif c == ">":
            intag = False
        elif not intag and c in "»«":
            pos.append(i)
    if not pos:
        return part
    pairs, rest = [], []
    # 1. enge deutsche Paare zuerst: »name« (kein Leerzeichen innen am Rand)
    k = 0
    while k < len(pos):
        i = pos[k]
        j = pos[k + 1] if k + 1 < len(pos) else None
        if (part[i] == "»" and j is not None and part[j] == "«" and j > i + 1
                and not part[i + 1].isspace() and not part[j - 1].isspace()):
            pairs.append((i, j))
            k += 2
        else:
            rest.append(i)
            k += 1
    # 2. übrige Zeichen: «…» oder »…« über einen Stapel
    drop, stack = set(), []
    for i in rest:
        c = part[i]
        if stack and part[stack[-1]] != c:
            pairs.append((stack.pop(), i))
        elif c == "»" and (i + 1 >= len(part) or part[i + 1].isspace() or part[i + 1] in ",.;:!?)"):
            if strict:
                drop.add(i)     # deutsches » vor Leerzeichen öffnet nichts
        elif c == "«" and re.match(r"(?:\s|<[^>]*>)*(?:</p>|$)", part[i + 1:]):
            drop.add(i)         # « am Absatzende öffnet nichts
        else:
            if c == "»" and stack and part[stack[-1]] == "»":
                drop.add(stack.pop())   # »the »hyperion«: das erste » ist ein Rest
            stack.append(i)
    # unpaarig: streng alles; sonst nur ein deutsches öffnendes » vor einem Wort (»de tope »asza«)
    drop.update(i for i in stack if strict or (part[i] == "»" and i + 1 < len(part) and part[i + 1].isalnum()))
    # leere Paare (»«, »,« aus der Übersetzung) fallen ebenfalls weg
    for i, j in pairs:
        if not re.sub(r"<[^>]*>|[\s,.;:]", "", part[i + 1:j]):
            drop.update((i, j))
    if not drop:
        return part
    part = "".join(ch for i, ch in enumerate(part) if i not in drop)
    return re.sub(r"(?<=\S) {2,}(?=\S)", " ", part)


def fix(s, lang):
    """Produktnamen in einem Text (auch HTML) der Sprache lang ("en", "fr", "es") reparieren."""
    if not isinstance(s, str) or not s or lang not in ("en", "fr", "es"):
        return s
    s = s.replace("﻿", "")
    if "»" not in s and "«" not in s:
        return s
    rx, canon, wrx = _setup(lang)
    s = re.sub(r"»threadCheck«(\s*[❘|]\s*cc)", r"»threadCheck\1", s)
    if wrx:
        s = wrx.sub(lambda m: m.group(1) + " ", s)
    s = _fix_names(s, rx, canon)
    s = _extend(s.replace("»»", "»").replace("««", "«"), canon)
    # streng: Englisch (keine französischen/spanischen Zitate) und kurze Texte ohne HTML (Tabellenzellen, Titel)
    return _balance(s, strict=lang == "en" or ("<" not in s and len(s) <= 120))


RENAMES = json.load(open(os.path.join(ROOT, "content", "renames.json"), encoding="utf-8"))


def rename_path(src, path):
    """Neue Adresse einer Seite der Sprachfassung src (content/renames.json, auch für Unterseiten):
    …/titanium -> …/titan. Pfade ohne Sprachpräfix, andere Pfade bleiben unverändert."""
    for old, new in RENAMES.get(src, {}).items():
        if path == old or path.startswith(old + "/"):
            return new + path[len(old):]
    return path


def fix_all(obj, lang, skip=()):
    """fix() rekursiv auf alle Texte einer Seite/Navigation (Schlüssel aus skip, z. B. Links, bleiben unberührt)."""
    if isinstance(obj, dict):
        return {k: (v if k in skip else fix_all(v, lang, skip)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [fix_all(v, lang, skip) for v in obj]
    return fix(obj, lang)
