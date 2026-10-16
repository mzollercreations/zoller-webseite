#!/usr/bin/env python3
"""Gerätebilder für den Systemring der Seite »Das System« (assets/img/system/<id>.webp).

Jede Station des Rings zeigt ihr Gerät auf einer hellen Scheibe. Wo es offizielle CAD-Daten gibt, kommt das Bild aus
der AR-Vorschau (assets/ar/<id>.webp, gleiche Kamera und gleiches Licht für alle), sonst der Freisteller aus dem
3D-Showroom (assets/showroom/img/hd). Alle werden gleich behandelt: auf den sichtbaren Inhalt zugeschnitten, mittig in
ein quadratisches Feld gesetzt, transparent gespeichert.

    ../video/.venv/bin/python tools/system_assets.py      (braucht Pillow)
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img", "system")
SIZE = 360
FILL = 0.8   # Anteil der längeren Seite am Feld

# Station -> Quelle (ar:<Modell> oder showroom:<Produkt>)
SOURCES = {
    "keeper": "ar:keeper",
    "toolcart": "ar:toolcart",
    "powershrink": "ar:powershrink400",
    "toolbalancer": "ar:toolbalancer",
    "venturion": "ar:venturion",
    "zidcode": "ar:zidcode",
    "idchip": "showroom:idchip",
    "genius": "showroom:genius",
    "pombasic": "showroom:pombasic",
    "corameasure": "showroom:corameasure-lg",
    "loadbox": "showroom:loadbox",
    "coralogistic": "showroom:coralogistic",
    "roboset": "showroom:roboset-2",
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for sid, src in SOURCES.items():
        kind, name = src.split(":")
        path = os.path.join(ROOT, "assets", "ar", name + ".webp") if kind == "ar" else os.path.join(ROOT, "assets", "showroom", "img", "hd", name + ".webp")
        im = Image.open(path).convert("RGBA")
        bbox = im.split()[-1].point(lambda a: 255 if a > 8 else 0).getbbox()
        im = im.crop(bbox)
        k = SIZE * FILL / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
        out = os.path.join(OUT, sid + ".webp")
        canvas.save(out, "WEBP", quality=86, method=6)
        print(f"{sid:13} {src:26} -> {os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    main()
