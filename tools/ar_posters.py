#!/usr/bin/env python3
"""Vorschaubilder der AR-/3D-Ansicht (assets/ar/<id>.webp): jedes Modell in model-viewer mit denselben Einstellungen wie
assets/js/arview.js (Kamera, Licht, Schatten) gerendert – steht da, bis das 3D-Modell geladen ist, und ohne WebGL.

    .venv/bin/python tools/ar_posters.py            # alle Modelle aus content/ar_models.json
    .venv/bin/python tools/ar_posters.py keeper     # nur eins
(.venv: pip install playwright Pillow; Chrome for Testing aus dem Playwright-Cache)
"""
import base64, functools, glob, http.server, io, json, os, sys, threading
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "ar")
W, H = 1200, 900
PAGE = """<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}model-viewer{width:%dpx;height:%dpx;background:transparent}</style>
<script>self.ModelViewerElement={dracoDecoderLocation:'/assets/vendor/draco/'};</script>
<script type="module" src="/assets/vendor/model-viewer.min.js"></script>
<model-viewer id="mv" environment-image="legacy" exposure="1.1" tone-mapping="neutral" shadow-intensity="1" shadow-softness="0.85"
 camera-orbit="-28deg 74deg auto" interaction-prompt="none"></model-viewer>""" % (W, H)


def chrome():
    hits = glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"))
    return sorted(hits)[-1] if hits else None


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith("-")] or list(json.load(open(os.path.join(ROOT, "content", "ar_models.json"))))

    class H_(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path.startswith("/__poster"):
                b = PAGE.encode()
                self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
                return
            return super().do_GET()

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H_, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=chrome(), args=["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"])
        pg = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        pg.goto(base + "/__poster", wait_until="load")
        pg.wait_for_function("!!customElements.get('model-viewer')")
        for mid in ids:
            pg.evaluate("""id => new Promise(ok => { const mv = document.getElementById('mv');
                mv.addEventListener('load', () => { mv.jumpCameraToGoal(); requestAnimationFrame(() => requestAnimationFrame(ok)); }, { once: true });
                mv.src = '/assets/ar/' + id + '.glb'; })""", mid)
            pg.wait_for_timeout(400)
            data = pg.evaluate("async () => { const b = await document.getElementById('mv').toBlob({ mimeType: 'image/png' }); "
                               "return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); }")
            im = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1]))).convert("RGBA")
            path = os.path.join(OUT, mid + ".webp")
            im.save(path, "WEBP", quality=84, method=6)
            print(f"{mid:15s} {os.path.getsize(path) / 1024:5.0f} KB")
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
