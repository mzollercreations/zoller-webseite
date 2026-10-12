#!/usr/bin/env python3
"""Erzeugt die Ländergrenzen für den Globus im Länderdialog (assets/js/globe-countries.js).

Für jedes Land mit eigener ZOLLER-Länderseite (content/sites.json, geo.country) werden die
Umrisse aus Natural Earth (ne_50m_admin_0_countries, Public Domain) vereinfacht übernommen,
dazu Mittelpunkt und Kameraabstand, bei dem das ganze Land ins Bild passt. Weit entfernte
kleine Inseln und Überseegebiete (Französisch-Guayana, Hawaii, Kanaren …) fallen weg.

Der Globus (assets/js/countryglobe.js) fliegt auf das Land, lässt es gelb aufleuchten und
erkennt beim Zeigen auf den Globus, über welchem Land der Mauszeiger steht.

Aufruf: python3 tools/make_countries.py [pfad/zu/ne_50m_admin_0_countries.geojson]
(ohne Pfad wird die Datei von GitHub geladen). Reines Python, keine Abhängigkeiten.
"""
import json
import math
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"
# Ländername in content/sites.json (wie locations.json) -> Name in Natural Earth (ADMIN)
NE_NAME = {"United States": "United States of America", "Czech Republic": "Czechia"}
# Länder ohne eigene Seite (noch), deren Umriss der Globus trotzdem kennen soll
EXTRA = ("Russia", "Turkey")


def load(path):
    if path:
        return json.load(open(path, encoding="utf-8"))
    with urllib.request.urlopen(SRC) as r:
        return json.load(r)


def area(ring):
    """Fläche in Grad² (Gaußsche Trapezformel, Längen mit cos der mittleren Breite gestaucht)."""
    k = math.cos(math.radians(sum(y for _, y in ring) / len(ring)))
    a = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        a += x0 * k * y1 - x1 * k * y0
    return abs(a) / 2


def centroid(ring):
    xs, ys = zip(*ring)
    return sum(xs) / len(xs), sum(ys) / len(ys)


def simplify(pts, tol):
    """Douglas-Peucker auf einem geschlossenen Ring."""
    if len(pts) < 8:
        return pts

    def dp(a, b):
        (x0, y0), (x1, y1) = pts[a], pts[b]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1e-12
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            x, y = pts[i]
            d = abs(dy * x - dx * y + x1 * y0 - y1 * x0) / L
            if d > best:
                best, idx = d, i
        if best > tol:
            return dp(a, idx)[:-1] + dp(idx, b)
        return [pts[a], pts[b]]

    mid = len(pts) // 2
    out = dp(0, mid)[:-1] + dp(mid, len(pts) - 1)
    return out if len(out) >= 4 else pts


def country(feature):
    g = feature["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    outer = [p[0] for p in polys]
    # über die Datumsgrenze (Russland, Alaska): westliche Längen um 360° verschieben
    span = max(x for r in outer for x, _ in r) - min(x for r in outer for x, _ in r)
    if span > 300:
        outer = [[(x + 360 if x < 0 else x, y) for x, y in r] for r in outer]
    main = max(outer, key=area)
    amain, (cx, cy) = area(main), centroid(main)
    keep = []
    for r in outer:
        a, (x, y) = area(r), centroid(r)
        dist = math.hypot((x - cx) * math.cos(math.radians(cy)), y - cy)
        reach = 6 + math.sqrt(amain) * 1.6          # wie weit Inseln vom Hauptland entfernt liegen dürfen (Grad)
        if r is main or (a >= max(0.004, amain * 0.002) and dist <= reach) or (a >= amain * 0.12 and dist <= 55):
            keep.append(r)
    xs = [x for r in keep for x, _ in r]
    ys = [y for r in keep for _, y in r]
    box = [min(xs), min(ys), max(xs), max(ys)]
    # Blick und Größe nach dem Hauptland (Kanaren, Madeira, Alaska … leuchten mit auf, verschieben aber nicht den Blick)
    mb = [min(x for x, _ in main), min(y for _, y in main), max(x for x, _ in main), max(y for _, y in main)]
    size = max((mb[2] - mb[0]) * math.cos(math.radians((mb[1] + mb[3]) / 2)), mb[3] - mb[1])
    tol = min(0.12, max(0.012, size / 260))
    rings = []
    for r in keep:
        s = simplify([tuple(p) for p in r[:-1]], tol)
        rings.append([round(v, 2) for p in s for v in p])
    # Blickpunkt: Mitte des Landes; Abstand so, dass das Land knapp die Hälfte der Bildhöhe füllt
    # (sichtbarer Bogen bei 32° Bildwinkel ≈ 2 · (Abstand − 1) · tan 16°)
    vx, vy = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2
    dist = round(min(3.6, max(1.3, 1 + math.radians(size) * 3.9)), 2)
    if vx > 180:
        vx -= 360
    return {"c": [round(vx, 2), round(vy, 2)], "z": dist, "b": [round(v, 2) for v in box], "p": rings}


def main():
    geo = load(sys.argv[1] if len(sys.argv) > 1 else None)
    by_name = {f["properties"]["ADMIN"]: f for f in geo["features"]}
    sites = json.load(open(os.path.join(ROOT, "content", "sites.json"), encoding="utf-8"))
    wanted = [s["geo"]["country"] for s in sites.values() if s.get("geo")] + list(EXTRA)
    out = {}
    for name in dict.fromkeys(wanted):
        f = by_name.get(NE_NAME.get(name, name))
        if not f:
            print("  nicht gefunden:", name)
            continue
        out[name] = country(f)
    path = os.path.join(ROOT, "assets", "js", "globe-countries.js")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("/* Ländergrenzen der ZOLLER-Länderseiten für den Globus im Länderdialog – erzeugt von tools/make_countries.py\n"
                 "   aus Natural Earth (Public Domain). c = Blickpunkt [Länge, Breite], z = Kameraabstand, b = Ausschnitt\n"
                 "   [West, Süd, Ost, Nord], p = Umrisse als [Länge, Breite, Länge, Breite …] (Längen über 180° bei Datumsgrenze). */\n")
        fh.write("export const COUNTRIES = " + json.dumps(out, separators=(",", ":")) + ";\n")
    pts = sum(len(r) // 2 for c in out.values() for r in c["p"])
    print(f"{len(out)} Länder, {pts} Punkte, {os.path.getsize(path) // 1024} KB -> {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()
