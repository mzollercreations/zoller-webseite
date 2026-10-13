#!/usr/bin/env python3
"""AR-/3D-Modelle der Produktseiten aus den offiziellen ZOLLER-CAD-Daten (~/Claude/ZOLLER/cad/original, GLB mm + Draco).

Je Gerät entstehen in assets/ar/:
  <id>.glb   3D-Ansicht im Browser (model-viewer) und AR auf Android (WebXR / Scene Viewer): Draco, PBR-Materialien mit
             Klarlack, zweiseitig, Bildschirm als Leuchtbild (»pilot 4.0« / TMS / »zidCode«)
  <id>.usdz  AR Quick Look auf iPhone/iPad: dieselbe Geometrie, jede Fläche zusätzlich mit umgekehrter Windung
             (CAD-Flächen sind uneinheitlich orientiert, Quick Look zeichnet nur Vorderseiten)
und content/ar_models.json (Maße, Dreiecke, Dateigrößen) für build.py.

Geometrie wie im Werkzeugraum-Planer (zoller-werkzeugraum-planer/tools/build_models.py): Meter, Gerät steht auf y=0,
Grundfläche zentriert, Bedienerseite nach +Z; Materialklassen nach CAD-Name/-Farbe; je Materialklasse ein Primitive;
Innenteile des »keeper« weggelassen; Bildschirme 1,5 mm vor dem Gehäuse.

    .venv/bin/python tools/ar_models.py              # alle Geräte
    .venv/bin/python tools/ar_models.py keeper       # nur eins
(.venv: pip install DracoPy pygltflib pyfqmr usd-core numpy Pillow)
"""
import io, json, os, shutil, struct, sys, tempfile, time
import numpy as np
np.seterr(all="ignore")          # numpy 2.0 + Accelerate meldet bei matmul falsche Überläufe
import DracoPy, pygltflib, pyfqmr
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CAD = os.path.join(os.path.dirname(ROOT), "cad")
OUT = os.path.join(ROOT, "assets", "ar")
MANIFEST = os.path.join(ROOT, "content", "ar_models.json")

# id: (CAD-Datei, Bildschirmbild, Dreiecks-Budget, Ränder mitvereinfachen)
DEVICES = {
    "venturion":      ("pilot 4.0_venturion«.glb", "screen_pilot4_measure.png", 60000, False),
    "venturion600":   ("pilot 4.0_Venturion_600«.glb", "screen_pilot4_measure.png", 60000, False),
    "venturion800":   ("pilot 4.0_Venturion_800«.glb", "screen_pilot4_measure.png", 60000, False),
    "smile":          ("pilot 4.0_smile«.glb", "screen_pilot4_contour.png", 60000, False),
    "keeper":         ("2500478_702302_ZOLLER »keeper«.glb", "screen_tms_keeper.png", 90000, False),
    "toolorganizer":  ("2500479_703741_ZOLLER »toolOrganizer«.glb", "screen_tms_organizer.png", 60000, False),
    "toolstation":    ("2501657_713197_ZOLLER Werkbank »toolStation«.glb", "screen_tms_station.png", 130000, False),
    "zidcode":        ("XXXXXXX_717076_ZOLLER »zidCode«.glb", "screen_zid_scan.png", 50000, False),
    "redomatic600":   ("XXXXXXX_752865_ZOLLER »redomatic 600«.glb", "screen_pilot4_measure.png", 80000, False),
    "powershrink400": ("XXXXXXX_752398_ZOLLER »powerShrink 400«.glb", "screen_pilot4_contour.png", 52000, False),
    "toolbalancer":   ("XXXXXXX_720749_ZOLLER »toolBalancer«.glb", "screen_pilot4_contour.png", 70000, False),
}
# zidCode: Display teilt sich das Material mit dem Gehäuse -> nur große, nach vorn oben zeigende Flächen sind Bildschirm
SCREEN_FACES = {"zidcode": dict(mat="plastik-schwarz", normal=(0, .41, .91), ymin=.8)}
# »keeper«: der Monitor ist ein Material ohne Namen in reinem Weiß (2 Dreiecke) -> Bildschirm
SCREEN_WHITE = {"keeper"}
SCREEN_LIFT = .0015          # Bildschirm 1,5 mm vor das Gehäuse (sonst z-fighting mit der Monitorfront)
# Innenteile, die bei geschlossenem Gerät nie zu sehen sind (»keeper«: Werkzeugeinsätze hinter den Auszügen = 91 % der
# Dreiecke): Bauteile, deren Hüllquader ganz im Hüllquader eines großen Teils liegt (Rand in m). Nur beim »keeper« –
# bei Werkbänken und Geräten mit Rahmen würde es sichtbare Teile entfernen.
INTERIOR_DROP = {"keeper": .012}
# Schubladenschränke (»toolOrganizer«, die zwei Schränke der »toolStation«): jede Schublade ist ein Bauteil samt
# Einsätzen (~30 000 Dreiecke), sichtbar ist nur die Front -> Flächen, die ganz im Korpus liegen (Korpus = schwarzgrauer
# Kasten, jede Kante 0,4–1,3 m), fallen weg; Rand in m, vorn (+Z) bleiben 60 mm für Schubladenfronten und Griffe
CABINET_FACES = {"toolorganizer": .012, "toolstation": .012}
CABINET_FRONT = .06
# kleine Teile in Monitorfarbe (LED-Fenster, Typenschilder …) sind keine Bildschirme
SCREEN_MIN_AREA = .03

_REF = [
    ((0.0346, 0.0386, 0.0409), "darkgrey"), ((0.3985, 0.4005, 0.3943), "whitealu"), ((0.9529, 0.8941, 0.0), "yellow"),
    ((0.8976, 0.7483, 0.0498), "yellow"), ((0.0101, 0.0101, 0.0101), "blackplastic"), ((0.0039, 0.0092, 0.0161), "pa6"),
    ((0.0199, 0.0249, 0.0279), "anodized"), ((0.1632, 0.1999, 0.4497), "screen"), ((0.1778, 0.1868, 0.1773), "screen"),
    ((0.3544, 0.3837, 0.3995), "steel"), ((0.8940, 0.8894, 0.8398), "whiteplastic"), ((0.8588, 0.8546, 0.8183), "paper"),
    ((0.7541, 0.5926, 0.3675), "wood"), ((0.0218, 0.0218, 0.0218), "worktop"), ((0.0283, 0.0281, 0.0298), "bellows"),
    ((0.0458, 0.0419, 0.0380), "blackoxide"), ((0.7648, 0.5728, 0.1191), "brass"), ((0.0028, 0.0031, 0.0039), "glossblack"),
    ((0.2295, 0.2828, 0.3083), "zinc"), ((1.0, 0.0252, 0.0121), "red"), ((0.2403, 0.2480, 0.2442), "chrome"),
    ((0.0, 0.7172, 0.5498), "teal"), ((0.0, 0.0081, 0.81), "blue"), ((0.0, 0.0, 0.0), "glossblack"),
]
_NAMES = [("led-gruen", "led"), ("gelb", "yellow"), ("monitor", "screen"), ("faltenbalg", "bellows"), ("messing", "brass"),
          ("brueniert", "blackoxide"), ("alu-eloxiert", "steel"), ("eloxiert", "anodized"), ("verzinkt", "zinc"), ("rot", "red"),
          ("papier", "paper"), ("plastik-weiss", "whiteplastic"), ("weissaluminium", "whitealu"), ("schwarzgrau", "darkgrey"),
          ("schwarz lackiert", "glossblack"), ("plastik-schwarz", "blackplastic"), ("pa 6", "pa6"), ("st_12", "steel")]
# Materialien: sRGB-Farbe, Rauheit, Metall, Klarlack (wie im Werkzeugraum-Planer)
MAT = dict(
    darkgrey=("#35383b", .42, 0, .15), whitealu=("#a9acab", .34, .72, .35), yellow=("#f0dc00", .3, 0, .6),
    blackplastic=("#141516", .45, 0, 0), pa6=("#111317", .55, 0, 0), anodized=("#1e2124", .32, .85, 0),
    steel=("#b9bdc0", .3, 1, 0), whiteplastic=("#e6e4dc", .35, 0, .2), paper=("#e0ded6", .6, 0, 0),
    wood=("#c8a679", .5, 0, 0), worktop=("#232426", .55, 0, 0), bellows=("#18191b", .78, 0, 0),
    blackoxide=("#2a2826", .35, .9, 0), brass=("#c9a14a", .25, 1, 0), glossblack=("#0d0e10", .16, 0, 1),
    zinc=("#9da6ab", .33, 1, 0), red=("#c8140f", .3, 0, .5), chrome=("#9a9e9c", .12, .95, 0),
    teal=("#1fa58a", .4, 0, 0), blue=("#1a3fae", .35, 0, .4), led=("#3ccf6a", .3, 0, 0),
)
LED_GLOW = (.12, .9, .32)


def lin(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(((c + .055) / 1.055) ** 2.4 if c > .04045 else c / 12.92)
    return out


def classify(mat):
    if mat is None:
        return "darkgrey"
    n = (mat.name or "").lower()
    for k, c in _NAMES:
        if k in n and not (k == "rot" and "brot" in n):
            return c
    col = (.5, .5, .5)
    if mat.pbrMetallicRoughness and mat.pbrMetallicRoughness.baseColorFactor:
        col = tuple(mat.pbrMetallicRoughness.baseColorFactor[:3])
    return min(_REF, key=lambda rc: sum((a - b) ** 2 for a, b in zip(rc[0], col)))[1]


def trs(node):
    if node.matrix:
        return np.array(node.matrix, dtype=np.float64).reshape(4, 4).T
    m = np.eye(4)
    if node.scale:
        m = np.diag([*node.scale, 1.0]) @ m
    if node.rotation:
        x, y, z, w = node.rotation
        r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        R = np.eye(4); R[:3, :3] = r; m = R @ m
    if node.translation:
        T = np.eye(4); T[:3, 3] = node.translation; m = T @ m
    return m


def read_parts(path):
    """[(material, Weltpositionen mm (n,3), Flächen (m,3))] für jedes Primitive"""
    g = pygltflib.GLTF2().load(path)
    blob = g.binary_blob()
    parts = []

    def walk(i, parent):
        n = g.nodes[i]
        M = parent @ trs(n)
        if n.mesh is not None:
            for p in g.meshes[n.mesh].primitives:
                ext = (p.extensions or {}).get("KHR_draco_mesh_compression")
                if not ext:
                    raise SystemExit(f"{path}: Primitive ohne Draco – nicht unterstützt")
                bv = g.bufferViews[ext["bufferView"]]
                d = DracoPy.decode(blob[bv.byteOffset or 0:(bv.byteOffset or 0) + bv.byteLength])
                pts = np.asarray(d.points, dtype=np.float64).reshape(-1, 3)
                fc = np.asarray(d.faces, dtype=np.int64).reshape(-1, 3)
                pts = (np.c_[pts, np.ones(len(pts))] @ M.T)[:, :3]
                if np.linalg.det(M[:3, :3]) < 0:
                    fc = fc[:, ::-1]
                parts.append((g.materials[p.material] if p.material is not None else None, pts, fc))
        for c in n.children or []:
            walk(c, M)

    for r in g.scenes[g.scene or 0].nodes:
        walk(r, np.eye(4))
    return parts


def weld(pts, faces, eps=5e-5):
    """gleiche Positionen (Raster eps, Meter) -> ein Punkt; entartete Dreiecke und unbenutzte Punkte fallen weg"""
    q = np.round(pts / eps).astype(np.int64)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    f = inv.reshape(-1)[faces]
    f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    used, remap = np.unique(f.reshape(-1), return_inverse=True)
    return pts[first][used], remap.reshape(-1, 3)


def face_normals(v, f):
    n = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    a = np.linalg.norm(n, axis=1)
    return n / np.maximum(a, 1e-20)[:, None], a * .5


def creased(v, f, angle=34.0):
    """Punkte an harten Kanten trennen: je Ecke das flächengewichtete Mittel der Nachbarnormalen innerhalb `angle`.
    Liefert (Positionen, Normalen, Flächen)."""
    fn, fa = face_normals(v, f)
    m = len(f)
    corner_v = f.reshape(-1)
    corner_f = np.repeat(np.arange(m), 3)
    order = np.argsort(corner_v, kind="stable")
    cv = corner_v[order]
    starts = np.r_[0, np.flatnonzero(np.diff(cv)) + 1]
    counts = np.diff(np.r_[starts, len(cv)])
    cosl = np.cos(np.radians(angle))
    out_n = np.zeros((m * 3, 3))
    for k in np.unique(counts):
        g0 = starts[counts == k]
        corners = order[g0[:, None] + np.arange(k)[None, :]]
        N = fn[corner_f[corners]]
        A = fa[corner_f[corners]][..., None] * N
        if k == 1:
            out_n[corners[:, 0]] = N[:, 0]
            continue
        step = max(1, 200000 // (k * k))
        for s in range(0, len(g0), step):
            Ns, As = N[s:s + step], A[s:s + step]
            w = (np.einsum("gij,gkj->gik", Ns, Ns) >= cosl).astype(np.float64)
            out_n[corners[s:s + len(Ns)].reshape(-1)] = np.einsum("gik,gkj->gij", w, As).reshape(-1, 3)
    ln = np.linalg.norm(out_n, axis=1)
    out_n = out_n / np.maximum(ln, 1e-20)[:, None]
    bad = ln < 1e-12
    out_n[bad] = np.repeat(fn, 3, axis=0)[bad]
    key = np.c_[corner_v, np.round(out_n * 127).astype(np.int64)]
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return v[corner_v[first]], out_n[first], inv.reshape(-1, 3)


def screen_uv(v, f):
    """planare UV für eine Monitorfläche (u nach rechts, v nach oben, von vorn ungespiegelt)"""
    fn, fa = face_normals(v, f)
    n = (fn * fa[:, None]).sum(0)
    n /= max(np.linalg.norm(n), 1e-12)
    if n[2] < 0:
        n = -n
    up = np.array([0.0, 1.0, 0.0]); up = up - up.dot(n) * n
    if np.linalg.norm(up) < 1e-4:
        up = np.array([0.0, 0.0, -1.0])
    up /= np.linalg.norm(up)
    right = np.cross(up, n); right /= np.linalg.norm(right)
    used = np.unique(f)
    u, w = v @ right, v @ up
    u0, u1, w0, w1 = u[used].min(), u[used].max(), w[used].min(), w[used].max()
    return np.c_[(u - u0) / max(u1 - u0, 1e-9), (w - w0) / max(w1 - w0, 1e-9)], n


def simplify(v, f, target, border=True):
    if len(f) <= target:
        return v, f
    s = pyfqmr.Simplify()
    s.setMesh(v.astype(np.float64), f.astype(np.int32))
    s.simplify_mesh(target_count=int(target), aggressiveness=6 if border else 8, preserve_border=border, verbose=0)
    nv, nf, _ = s.getMesh()
    return np.asarray(nv, dtype=np.float64), np.asarray(nf, dtype=np.int64)


def drop_interior(parts, margin):
    boxes = [(p[np.unique(f)].min(0) * .001, p[np.unique(f)].max(0) * .001) for _, p, f in parts]
    big = [i for i, (a, b) in enumerate(boxes) if np.linalg.norm(b - a) > .8]
    return [part for i, part in enumerate(parts)
            if not any(j != i and np.all(boxes[i][0] > boxes[j][0] + margin) and np.all(boxes[i][1] < boxes[j][1] - margin) for j in big)]


def drop_cabinet_faces(parts, margin):
    boxes = []
    for mat, p, f in parts:
        q = p[np.unique(f)] * .001
        a, b = q.min(0), q.max(0)
        if classify(mat) == "darkgrey" and np.all(b - a > .4) and np.all(b - a < 1.3) and len(f) > 3000:
            boxes.append((a + margin, b - np.array([margin, margin, CABINET_FRONT])))
    out = []
    for mat, p, f in parts:
        q = p * .001
        inside = np.zeros(len(f), bool)
        for a, b in boxes:
            vin = np.all((q > a) & (q < b), axis=1)
            inside |= vin[f].all(1)
        if (~inside).any():
            out.append((mat, p, f[~inside]))
    return out


def budgets(sizes, budget):
    """Dreiecks-Budget je Materialgruppe: kleine Gruppen behalten alles, der Rest wird gleichmäßig auf die großen verteilt"""
    tgt = dict(sizes)
    if sum(sizes.values()) <= budget:
        return tgt
    left, open_ = budget, dict(sizes)
    while open_:
        share = left / len(open_)
        small = {k: n for k, n in open_.items() if n <= share}
        if not small:
            for k in open_:
                tgt[k] = max(120, int(share))
            break
        for k, n in small.items():
            tgt[k] = n
            left -= n
            del open_[k]
    return tgt


def collect(dev):
    """Primitive je Materialklasse (Meter, auf y=0, Front +Z) im Dreiecks-Budget + Bildschirmflächen mit UV.
    Liefert (prims, Größe B×H×T in m, CAD-Dreiecke)."""
    file, _, budget, lo = DEVICES[dev]
    parts = read_parts(os.path.join(CAD, "original", file))
    cad_tris = sum(len(f) for _, _, f in parts)
    allp = np.vstack([p for _, p, _ in parts]) * .001
    if dev in INTERIOR_DROP:
        parts = drop_interior(parts, INTERIOR_DROP[dev])
    if dev in CABINET_FACES:
        parts = drop_cabinet_faces(parts, CABINET_FACES[dev])
    mn, mx = allp.min(0), allp.max(0)
    off = np.array([-(mn[0] + mx[0]) / 2, -mn[1], -(mn[2] + mx[2]) / 2])
    size = mx - mn
    sf = SCREEN_FACES.get(dev)
    groups, screens = {}, []
    for mat, pts, fc in parts:
        p = pts * .001 + off
        c = classify(mat)
        if dev in SCREEN_WHITE and mat is not None and mat.name is None and mat.pbrMetallicRoughness \
                and min(mat.pbrMetallicRoughness.baseColorFactor[:3]) > .99:
            c = "screen"
        if sf and mat is not None and sf["mat"] in (mat.name or "").lower():
            fnrm, _ = face_normals(p, fc)
            hit = (np.abs(fnrm @ (np.array(sf["normal"]) / np.linalg.norm(sf["normal"]))) > .97) \
                & (p[fc].mean(1)[:, 1] > sf["ymin"] * size[1])
            if hit.any():
                screens.append((p, fc[hit]))
                fc = fc[~hit]
        if c == "screen" and face_normals(p, fc)[1].sum() < SCREEN_MIN_AREA and "monitor" not in (mat.name or "").lower():
            c = "glossblack"
        if c == "screen":
            screens.append((p, fc))
            continue
        groups.setdefault(c, []).append((p, fc))
    tgt = budgets({c: sum(len(f) for _, f in lst) for c, lst in groups.items()}, budget)
    prims = []
    for c, lst in sorted(groups.items(), key=lambda kv: -sum(len(f) for _, f in kv[1])):
        offs = np.cumsum([0] + [len(p) for p, _ in lst])
        v = np.vstack([p for p, _ in lst]); f = np.vstack([fc + o for (_, fc), o in zip(lst, offs)])
        v, f = weld(v, f, eps=.0004 if lo else 5e-5)
        v, f = simplify(v, f, tgt[c], border=not lo)
        v, f = weld(v, f)
        pv, pn, pf = creased(v, f)
        prims.append(dict(cls=c, pos=pv, nrm=pn, idx=pf))
    for p, fc in screens:
        v, f = weld(p, fc)
        if not len(f):
            continue
        uv, n = screen_uv(v, f)
        flip = face_normals(v, f)[0] @ n < 0          # Windung zur Blickrichtung (Bildschirm ist einseitig)
        f = np.where(flip[:, None], f[:, ::-1], f)
        prims.append(dict(cls="screen", pos=v + n * SCREEN_LIFT, nrm=np.tile(n, (len(v), 1)), idx=f, uv=uv))
    return prims, size, cad_tris


def screen_image(dev, fmt):
    im = Image.open(os.path.join(CAD, "textures", DEVICES[dev][1])).convert("RGB")
    im.thumbnail((1024, 1024), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, fmt, quality=86, optimize=True) if fmt == "JPEG" else im.save(b, fmt, optimize=True)
    return b.getvalue()


# ------------------------------------------------------------------ GLB (model-viewer, Android)
def write_glb(path, dev, prims):
    bin_ = bytearray()
    views, accessors, meshprims, materials, matidx, images, textures = [], [], [], [], {}, [], []
    used_ext = {"KHR_draco_mesh_compression"}

    def add_view(b):
        while len(bin_) % 4:
            bin_.append(0)
        views.append(dict(buffer=0, byteOffset=len(bin_), byteLength=len(b)))
        bin_.extend(b)
        return len(views) - 1

    def material(c):
        if c in matidx:
            return matidx[c]
        if c == "screen":
            if not textures:
                images.append(dict(bufferView=add_view(screen_image(dev, "JPEG")), mimeType="image/jpeg"))
                textures.append(dict(source=0, sampler=0))
            m = dict(name="screen", pbrMetallicRoughness=dict(baseColorFactor=[.01, .01, .012, 1], metallicFactor=0, roughnessFactor=.15),
                     emissiveTexture=dict(index=0), emissiveFactor=[1, 1, 1])
        else:
            col, rough, metal, coat = MAT.get(c, MAT["darkgrey"])
            m = dict(name=c, pbrMetallicRoughness=dict(baseColorFactor=lin(col) + [1], metallicFactor=metal, roughnessFactor=rough),
                     doubleSided=True)
            if c == "led":
                m["emissiveFactor"] = list(LED_GLOW)
            if coat:
                m["extensions"] = {"KHR_materials_clearcoat": dict(clearcoatFactor=coat, clearcoatRoughnessFactor=.1)}
                used_ext.add("KHR_materials_clearcoat")
        matidx[c] = len(materials)
        materials.append(m)
        return matidx[c]

    for p in prims:
        pos = p["pos"].astype(np.float32); nrm = p["nrm"].astype(np.float32); idx = p["idx"].astype(np.uint32)
        uv = p.get("uv")
        if uv is not None:
            uv = np.c_[uv[:, 0], 1 - uv[:, 1]]          # glTF: v=0 oben im Bild
        enc = DracoPy.encode(pos, faces=idx, quantization_bits=14, compression_level=7, preserve_order=True,
                             normals=nrm.astype(np.float64), normal_quantization_bits=10,
                             tex_coord=uv.astype(np.float64) if uv is not None else None,
                             tex_coord_quantization_bits=12 if uv is not None else None)
        dv = add_view(enc)
        types = {0: "POSITION", 1: "NORMAL", 3: "TEXCOORD_0"}
        attrs_draco = {types[a["attribute_type"]]: a["unique_id"] for a in DracoPy.decode(enc).attributes
                       if a["attribute_type"] in types}
        n = len(pos)
        a_pos = len(accessors); accessors.append(dict(componentType=5126, count=n, type="VEC3",
                                                      min=pos.min(0).tolist(), max=pos.max(0).tolist()))
        a_nrm = len(accessors); accessors.append(dict(componentType=5126, count=n, type="VEC3"))
        attrs = dict(POSITION=a_pos, NORMAL=a_nrm)
        if uv is not None:
            attrs["TEXCOORD_0"] = len(accessors); accessors.append(dict(componentType=5126, count=n, type="VEC2"))
        a_idx = len(accessors); accessors.append(dict(componentType=5125, count=int(idx.size), type="SCALAR"))
        meshprims.append(dict(attributes=attrs, indices=a_idx, material=material(p["cls"]), mode=4,
                              extensions={"KHR_draco_mesh_compression": dict(bufferView=dv, attributes=attrs_draco)}))
    gltf = dict(asset=dict(version="2.0", generator="zoller-webseite/tools/ar_models.py", copyright="E. Zoller GmbH & Co. KG"),
                extensionsUsed=sorted(used_ext), extensionsRequired=["KHR_draco_mesh_compression"],
                scene=0, scenes=[dict(nodes=[0])], nodes=[dict(mesh=0, name=dev)],
                meshes=[dict(primitives=meshprims)], materials=materials, accessors=accessors, bufferViews=views,
                buffers=[dict(byteLength=0)])
    if images:
        gltf.update(images=images, textures=textures, samplers=[dict(magFilter=9729, minFilter=9987, wrapS=33071, wrapT=33071)])
    while len(bin_) % 4:
        bin_.append(0)
    gltf["buffers"][0]["byteLength"] = len(bin_)
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A)); fh.write(js)
        fh.write(struct.pack("<II", len(bin_), 0x004E4942)); fh.write(bin_)


# ------------------------------------------------------------------ USDZ (AR Quick Look)
def write_usdz(path, dev, prims):
    from pxr import Usd, UsdGeom, UsdShade, UsdUtils, Sdf, Gf, Vt, Kind
    tmp = tempfile.mkdtemp(prefix="zoller-ar-")
    try:
        usdc = os.path.join(tmp, dev + ".usdc")
        st = Usd.Stage.CreateNew(usdc)
        UsdGeom.SetStageUpAxis(st, UsdGeom.Tokens.y)
        UsdGeom.SetStageMetersPerUnit(st, 1.0)
        root = UsdGeom.Xform.Define(st, "/Device")
        st.SetDefaultPrim(root.GetPrim())
        Usd.ModelAPI(root.GetPrim()).SetKind(Kind.Tokens.component)
        UsdGeom.Scope.Define(st, "/Device/Materials")
        mats = {}

        def material(c):
            if c in mats:
                return mats[c]
            m = UsdShade.Material.Define(st, f"/Device/Materials/{c}")
            sh = UsdShade.Shader.Define(st, f"/Device/Materials/{c}/Surface")
            sh.CreateIdAttr("UsdPreviewSurface")
            if c == "screen":
                os.makedirs(os.path.join(tmp, "tex"), exist_ok=True)
                with open(os.path.join(tmp, "tex", "screen.jpg"), "wb") as fh:
                    fh.write(screen_image(dev, "JPEG"))
                rd = UsdShade.Shader.Define(st, f"/Device/Materials/{c}/st")
                rd.CreateIdAttr("UsdPrimvarReader_float2")
                rd.CreateInput("varname", Sdf.ValueTypeNames.String).Set("st")
                tx = UsdShade.Shader.Define(st, f"/Device/Materials/{c}/tex")
                tx.CreateIdAttr("UsdUVTexture")
                tx.CreateInput("file", Sdf.ValueTypeNames.Asset).Set("tex/screen.jpg")
                tx.CreateInput("st", Sdf.ValueTypeNames.Float2).ConnectToSource(rd.ConnectableAPI(), "result")
                tx.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("clamp")
                tx.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("clamp")
                tx.CreateOutput("rgb", Sdf.ValueTypeNames.Float3)
                sh.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(.01, .01, .012))
                sh.CreateInput("emissiveColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(tx.ConnectableAPI(), "rgb")
                sh.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(.15)
                sh.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)
            else:
                col, rough, metal, coat = MAT.get(c, MAT["darkgrey"])
                sh.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*lin(col)))
                sh.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(float(rough))
                sh.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(float(metal))
                if c == "led":
                    sh.CreateInput("emissiveColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*LED_GLOW))
                if coat:
                    sh.CreateInput("clearcoat", Sdf.ValueTypeNames.Float).Set(float(coat))
                    sh.CreateInput("clearcoatRoughness", Sdf.ValueTypeNames.Float).Set(.1)
            m.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), "surface")
            mats[c] = m
            return m

        tris = 0
        for i, p in enumerate(prims):
            v, n, f = p["pos"], p["nrm"], p["idx"]
            nv = len(v)
            if p["cls"] == "screen":            # Bildschirm nur von vorn
                V, N, F = v.astype(np.float32), n.astype(np.float32), f.astype(np.int32)
                uv = p["uv"].astype(np.float32)
            else:                               # zweiseitig: Kopie mit umgekehrter Windung und gespiegelter Normale
                V = np.vstack([v, v]).astype(np.float32)
                N = np.vstack([n, -n]).astype(np.float32)
                F = np.vstack([f, f[:, ::-1] + nv]).astype(np.int32)
                uv = None
            mesh = UsdGeom.Mesh.Define(st, f"/Device/{p['cls']}_{i}")
            mesh.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(V))
            mesh.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(N))
            mesh.SetNormalsInterpolation(UsdGeom.Tokens.vertex)
            mesh.CreateFaceVertexCountsAttr(Vt.IntArray.FromNumpy(np.full(len(F), 3, np.int32)))
            mesh.CreateFaceVertexIndicesAttr(Vt.IntArray.FromNumpy(F.reshape(-1)))
            mesh.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
            mesh.CreateDoubleSidedAttr(False)
            mesh.CreateExtentAttr(Vt.Vec3fArray([Gf.Vec3f(*V.min(0).tolist()), Gf.Vec3f(*V.max(0).tolist())]))
            if uv is not None:
                pv = UsdGeom.PrimvarsAPI(mesh).CreatePrimvar("st", Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex)
                pv.Set(Vt.Vec2fArray.FromNumpy(uv))
            UsdShade.MaterialBindingAPI.Apply(mesh.GetPrim()).Bind(material(p["cls"]))
            tris += len(F)
        st.GetRootLayer().Save()
        if os.path.exists(path):
            os.remove(path)
        if not UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(usdc), path):
            raise SystemExit(f"{dev}: USDZ-Paket fehlgeschlagen")
        return tris
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def check_usdz(path):
    """alle USD-Prüfungen (Paket, Materialbindung, Shader, Metadaten); Liste der Fehler"""
    from pxr import Usd, UsdValidation
    ctx = UsdValidation.ValidationContext(UsdValidation.ValidationRegistry().GetOrLoadAllValidators())
    return [e.GetMessage() for e in ctx.Validate(Usd.Stage.Open(path))]


def build(dev):
    t0 = time.time()
    prims, size, cad_tris = collect(dev)
    glb = os.path.join(OUT, dev + ".glb")
    usdz = os.path.join(OUT, dev + ".usdz")
    write_glb(glb, dev, prims)
    usdz_tris = write_usdz(usdz, dev, prims)
    problems = check_usdz(usdz)
    tris = sum(len(p["idx"]) for p in prims)
    kb = lambda p: os.path.getsize(p) / 1024
    print(f"{dev:15s} {cad_tris:>8d} -> {tris:>6d} Dreiecke, {len(prims):2d} Prim., GLB {kb(glb):5.0f} KB, USDZ {kb(usdz):5.0f} KB, "
          f"{size[0]:.2f}×{size[2]:.2f}×{size[1]:.2f} m ({time.time() - t0:.1f}s)" + (f"\n   USDZ-Prüfung: {problems}" if problems else ""))
    return dict(size_mm=[int(round(size[0] * 1000)), int(round(size[2] * 1000)), int(round(size[1] * 1000))],   # B × T × H
                tris=int(tris), usdz_tris=int(usdz_tris), glb_kb=round(kb(glb)), usdz_kb=round(kb(usdz)))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    ids = [a for a in sys.argv[1:] if not a.startswith("--")] or list(DEVICES)
    man = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    for d in ids:
        man[d] = build(d)
    man = {k: man[k] for k in DEVICES if k in man}
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(man, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
