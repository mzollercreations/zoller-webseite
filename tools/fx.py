#!/usr/bin/env python3
"""Wechselkurse und Länderdaten für assets/js/currency.js (Webseite, Werkzeugraum-Planer, Messe-App).

    python3 tools/fx.py          Kurse neu laden und den Datenblock in assets/js/currency.js schreiben
    python3 tools/fx.py --offline nur Länder/Zeitzonen neu schreiben, Kurse aus content/fx.json

Kurse: EZB-Referenzkurse (eurofxref-daily), für Währungen ohne EZB-Kurs (z. B. RUB, AED, ARS) die freie
currency-api (fawazahmed0, CC0). Land -> Währung: content/fx.json »cc« (aus ICU/Foundation, siehe unten).
Zeitzone -> Land: /usr/share/zoneinfo/zone.tab + Verweise aus tzdata.zi (alte Namen wie Asia/Calcutta).
Angezeigt wird umgerechnet und aufgerundet (Regel in currency.js roundUp)."""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "content" / "fx.json"
JS = ROOT / "assets" / "js" / "currency.js"
ZONEINFO = Path("/usr/share/zoneinfo")
ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
EXTRA = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json"
# Währungen der ZOLLER-Länderseiten (+ CHF): stehen in der Auswahl oben
MAIN = ["EUR", "USD", "CAD", "MXN", "BRL", "GBP", "CHF", "SEK", "PLN", "CZK", "HUF", "TRY", "RUB", "CNY", "JPY", "KRW", "INR"]

# Land -> Währung einmalig aus Foundation erzeugt (swift: Locale(identifier: "en_" + region).currency) und in
# content/fx.json abgelegt; hier nur Korrekturen, falls ICU veraltet ist.
CC_FIX = {}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "zoller-webseite fx.py"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def sig(v, n=6):
    return float(f"{v:.{n}g}")


def load_rates(cc):
    root = ET.fromstring(get(ECB))
    ns = {"e": "http://www.ecb.int/vocabulary/2002-08-01/eurofxref"}
    day = root.find(".//e:Cube[@time]", ns)
    rates = {"EUR": 1.0}
    for c in day.findall("e:Cube", ns):
        rates[c.get("currency")] = sig(float(c.get("rate")))
    ecb = sorted(rates)
    extra = json.loads(get(EXTRA))["eur"]
    for code in sorted(set(cc.values())):
        if code not in rates and code.lower() in extra and extra[code.lower()]:
            rates[code] = sig(float(extra[code.lower()]))
    return day.get("time"), rates, ecb


def zones():
    tz = {}
    for line in (ZONEINFO / "zone.tab").read_text().splitlines():
        if line.startswith("#") or not line.strip():
            continue
        cc, _, name = line.split("\t")[:3]
        tz[name] = cc
    # Verweise (alte und zusammengelegte Namen); Ziele ohne Land (Etc/UTC …) fallen weg
    for line in (ZONEINFO / "tzdata.zi").read_text().splitlines():
        if line.startswith("L "):
            _, target, alias = line.split()
            if alias not in tz and target in tz and "/" in alias and not alias.startswith("Etc/"):
                tz[alias] = tz[target]
    # kompakt: »Europe:Berlin DE,Zurich CH;America:…«
    groups = {}
    for name, cc in sorted(tz.items()):
        area, _, rest = name.partition("/")
        groups.setdefault(area, []).append(f"{rest} {cc}")
    return ";".join(f"{a}:{','.join(v)}" for a, v in groups.items()), len(tz)


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    cc = {**data["cc"], **CC_FIX}
    if "--offline" not in sys.argv:
        day, rates, ecb = load_rates(cc)
        data.update(date=day, rates=rates, ecb=ecb, fetched=date.today().isoformat())
    tz, n = zones()
    rates = data["rates"]
    cc = {k: v for k, v in sorted(cc.items()) if v in rates}
    block = {"date": data["date"], "main": MAIN, "rates": rates, "cc": cc, "tz": tz}
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    js = JS.read_text(encoding="utf-8")
    js = re.sub(r"(/\* DATA:BEGIN[^\n]*\n).*?(\n\s*/\* DATA:END)",
                lambda m: m.group(1) + "  var D = " + json.dumps(block, ensure_ascii=False, separators=(",", ":")) + ";" + m.group(2),
                js, count=1, flags=re.S)
    JS.write_text(js, encoding="utf-8")
    missing = sorted({v for v in data["cc"].values()} - set(rates) - {"XXX"})
    print(f"Kurse vom {data['date']}: {len(rates)} Währungen ({len(data['ecb'])} EZB), {len(cc)} Länder, {n} Zeitzonen"
          + (f"; ohne Kurs (Land fällt auf Seitenwährung zurück): {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
