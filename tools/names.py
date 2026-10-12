"""Produktnamen in den Länderfassungen reparieren (alle Sprachen außer Deutsch).

Die Länderfassungen von zoller.info sind maschinell übersetzt. Dabei wurden Markennamen teils mitübersetzt
(»titanium« statt »titan«, »gardien« statt »keeper«, »hiperión« statt »hyperion«) und die deutschen Guillemets mit
den französischen/spanischen Anführungszeichen verschachtelt (»« cockpit »«, »«genius»«, »the« »hyperion«,
»Hyperion 500/700,«). fix() bringt jeden Namen aus content/names.json auf die Schreibweise der deutschen Seite:
»name«. Ein Name wird nur angefasst, wenn links UND rechts Guillemets stehen – Fließtext (»génie universel«,
»aleaciones de titanio«) und Links (…/titanium/) bleiben unverändert.

Regel (Nutzer, 2026-10-12): Produktnamen werden nie übersetzt, auch wenn zoller.info sie übersetzt hat. Seit 2026-10-12
auch für it, pt, sv, pl, sl, cs, hu, sk, zh, ja, ko: übersetzte Namen (»tytan«, »målvakt«, »ハイペリオン«) zurück auf das
Original, Artikel/Präpositionen aus den Guillemets heraus (»o roboSet 2« -> o »roboSet 2«), japanische/koreanische
Partikel hinter die Guillemets (»geniusなら« -> »genius«なら), ungarische Endungen mit Bindestrich (»toolOrganizer 600-zal«
-> »toolOrganizer 600«-zal), chinesische/japanische Anführungszeichen um Namen als »…« (“天才” -> »genius«).

Genutzt von tools/build.py (Länderseiten) und zoller-produktumgebung-3d/tools/build_locale.py (3D-Showroom).
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open(os.path.join(ROOT, "content", "names.json"), encoding="utf-8"))
# Artikel, die die Übersetzung mit in die Guillemets gezogen hat (»du titane« -> du »titan«)
ARTICLES = {"en": r"the|a|an", "fr": r"le|la|les|du|de|des|un|une", "es": r"el|la|los|las|un|una|de|del",
            "it": r"il|lo|la|i|gli|le|del|della|dello|nel|nella|nello|al|alla|con|un|una|uno",
            "pt": r"o|a|os|as|do|da|dos|das|no|na|nos|nas|ao|pelo|pela|um|uma|com|para o|para a",
            "sv": r"i|med|för|den|det", "pl": r"w|z|ze|do|na|dla|przez", "sl": r"v|z|s|na|za|pri",
            "cs": r"v|ve|s|se|z|ze|pomocí|pro|na", "sk": r"v|vo|s|so|z|zo|pomocou|pre|na", "hu": r"a|az"}
# Partikel, die die Übersetzung mit in die Guillemets gezogen hat (Japanisch, Koreanisch)
PARTICLES = {"ja": r"では|には|から|まで|より|なら|は|を|が|の|に|で|と|も|へ",
             "ko": r"에서는|에서|에는|으로|까지|은|는|이|가|을|를|에|의|로|와|과|도|만"}
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


def _fix_names(s, rx, canon, cjk=False):
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
        if cjk:   # Chinesisch, Japanisch, Koreanisch: Leerzeichen nur, wo der Text schon eines hatte
            lead_ws = ""
            trail_ws = " " if post and post[-1].isspace() and k < len(s) and (s[k] in "»«" or (s[k].isascii() and s[k].isalnum())) else ""
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


def _cjk_quotes(s, lang):
    """“天才” / 「ハイペリオン」 um einen Produktnamen -> »…« (wie auf der deutschen Seite)."""
    canon = _setup(lang)[1]
    def rep(m):
        inner = m.group(2).strip()
        return f"»{inner}«" if _key(inner) in canon else m.group(0)
    return re.sub(r"([“「])([^“”「」<>]{1,40})([”」])", rep, s)


def _particles(s, lang, canon):
    """»geniusなら« -> »genius«なら, »zidCode 4.0을« -> »zidCode 4.0«을."""
    rx = re.compile(r"»([^«»<]{1,40}?)\s*(" + PARTICLES[lang] + r")«")
    return rx.sub(lambda m: f"»{m.group(1)}«{m.group(2)}" if _key(m.group(1)) in canon else m.group(0), s)


def fix(s, lang):
    """Produktnamen in einem Text (auch HTML) der Sprache lang ("en", "fr", "es") reparieren."""
    if not isinstance(s, str) or not s or lang == "de":
        return s
    s = s.replace("﻿", "")
    if lang in ("zh", "ja", "ko") and ("“" in s or "「" in s):
        s = _cjk_quotes(s, lang)
    if "»" not in s and "«" not in s:
        return s
    rx, canon, wrx = _setup(lang)
    if lang in PARTICLES:
        s = _particles(s, lang, canon)
    if lang == "hu":
        s = re.sub(r"»([^«»<]{1,40}?)-([a-záéíóöőúüű]{1,6})«", lambda m: f"»{m.group(1)}«-{m.group(2)}" if _key(m.group(1)) in canon else m.group(0), s)
    s = re.sub(r"»threadCheck«(\s*[❘|]\s*cc)", r"»threadCheck\1", s)
    if wrx:
        s = wrx.sub(lambda m: m.group(1) + " ", s)
    s = _fix_names(s, rx, canon, cjk=lang in ("zh", "ja", "ko"))
    s = _extend(s.replace("»»", "»").replace("««", "«"), canon)
    # streng: Englisch, Chinesisch, Japanisch, Koreanisch (keine »«-Zitate) und kurze Texte ohne HTML (Tabellenzellen, Titel)
    s = _balance(s, strict=lang in ("en", "zh", "ja", "ko") or ("<" not in s and len(s) <= 120))
    if lang == "hu":   # ungarische Endung hängt mit Bindestrich am Namen: »powerShrink« ről -> »powerShrink«-ről
        s = re.sub(r"«\s(" + HU_SUFFIX + r")(?![a-záéíóöőúüű])", r"«-\1", s)
    return s


HU_SUFFIX = "ről|ról|ba|ban|ben|nek|nak|hez|hoz|höz|val|vel|ből|ból|tól|től|nál|nél|ért|ként|ra|re|t|ot|et|at|öt|on|ön|n"


RENAMES = json.load(open(os.path.join(ROOT, "content", "renames.json"), encoding="utf-8"))


def rename_path(src, path):
    """Neue Adresse einer Seite der Sprachfassung src (content/renames.json, auch für Unterseiten):
    …/titanium -> …/titan. Pfade ohne Sprachpräfix, andere Pfade bleiben unverändert. Deutsche Seite: src "" -> "de"."""
    # längster passender Eintrag zuerst: …/ベンチュリオン/モデル/トリボス -> …/venturion/モデル/tribos
    for old, new in sorted(RENAMES.get(src or "de", {}).items(), key=lambda kv: -len(kv[0])):
        if old.startswith("_"):
            continue
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


ALT_BAR = re.compile(r"(?<=[^\s|<>])\|(?=[^\s|<>])")


def _alt_word(w):
    return w.strip(".,;:()«»\"“”'").lower()


def _drop_alt_text(text):
    """»A|B« -> »A«. Länge von B: beginnt B wie A (»sistema de control|sistema de mando«) so lang wie A,
    endet B wie A (»luz anular LED|anillo de luz LED«) bis zu diesem Wort, sonst ein Wort. 01|2026 bleibt."""
    for _ in range(8):
        for m in ALT_BAR.finditer(text):
            left, right = text[:m.start()], text[m.end():]
            if re.search(r"\d$", left) and re.match(r"\d", right):
                continue
            before, after = left.split(" "), right.split(" ")
            n = next((k for k in range(1, 5) if len(before) >= k and _alt_word(after[0]) == _alt_word(before[-k])), None)
            if n is None:
                n = next((k + 1 for k in range(1, 5) if len(after) > k and _alt_word(after[k]) == _alt_word(before[-1])), 1)
            n = min(n, len(after))
            tail = re.search(r"[.,;:)»«\"”]+$", after[n - 1])
            rest = " ".join(after[n:])
            text = left + (tail.group(0) if tail else "") + (" " + rest if rest else "")
            break
        else:
            return text
    return text


def drop_alternatives(s):
    """Übersetzungsalternativen der maschinellen Übersetzung von zoller.info (»basculante|orientable«) auf die erste
    Alternative bringen – nur im sichtbaren Text, nicht in HTML-Tags. Sonderfälle stehen vorher in replace.json."""
    if not isinstance(s, str) or "|" not in s:
        return s
    return "".join(p if p.startswith("<") else _drop_alt_text(p) for p in re.split(r"(<[^>]*>)", s))
