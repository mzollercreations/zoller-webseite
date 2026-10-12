#!/bin/bash
# Baut eine Länderseite und veröffentlicht sie in ihrem eigenen GitHub-Repository (GitHub Pages, Branch main).
#
# Aufruf:  tools/publish.sh ca            ZOLLER Canada -> github.com/mzollercreations/zoller-canada
#          tools/publish.sh mx            ZOLLER México -> github.com/mzollercreations/zoller-mexico
#          tools/publish.sh us            ZOLLER USA -> github.com/mzollercreations/zoller-usa
#          tools/publish.sh ru            ZOLLER Россия -> github.com/mzollercreations/zoller-russia (jedes Land aus content/sites.json)
#          tools/publish.sh ca "Nachricht" mit eigener Commit-Nachricht
#
#          NOBUILD=1 tools/publish.sh fr  ohne neuen Build (z. B. direkt nach build_all)
#
# Das Ausgabeverzeichnis (dist/<repo>) ist ein Klon des Länder-Repos; build.py lässt .git, fileadmin/ und CNAME stehen.
# Gibt es das Repo noch nicht, legt das Skript es öffentlich an und schaltet GitHub Pages ein (Branch main, Wurzel).
set -euo pipefail
site="${1:?Länderseite angeben (Schlüssel aus content/sites.json, z. B. ca, fr, ru)}"
cd "$(dirname "$0")/.."
read -r repo out < <(python3 -c "import json,sys; s=json.load(open('content/sites.json'))['$site']; print(s['repo'], s['out'])")
owner=mzollercreations
url="https://github.com/$owner/$repo.git"

if ! gh repo view "$owner/$repo" >/dev/null 2>&1; then
  gh repo create "$owner/$repo" --public --description "ZOLLER Länderseite ($site) – https://$owner.github.io/$repo/" >/dev/null
  new_repo=1
fi

if [ ! -d "$out/.git" ]; then
  tmp="$(mktemp -d)"
  if git clone -q --no-checkout --depth 1 "$url" "$tmp/repo" 2>/dev/null; then
    mkdir -p "$out" && mv "$tmp/repo/.git" "$out/.git"
  else
    mkdir -p "$out" && git -C "$out" init -q -b main && git -C "$out" remote add origin "$url"
  fi
  rm -rf "$tmp"
fi

[ -n "${NOBUILD:-}" ] || python3 tools/build.py --site "$site"

src="$(git rev-parse --short HEAD 2>/dev/null || echo lokal)"
msg="${2:-Webseite aktualisiert (zoller-webseite $src)}"
git -C "$out" checkout -q -B main 2>/dev/null || true
git -C "$out" add -A
if git -C "$out" diff --cached --quiet 2>/dev/null && git -C "$out" rev-parse -q --verify HEAD >/dev/null; then
  echo "Keine Änderungen – nichts zu veröffentlichen."
  exit 0
fi
git -C "$out" commit -q -m "$msg"
git -C "$out" push -q -u origin main
if [ -n "${new_repo:-}" ] || ! gh api "repos/$owner/$repo/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/$owner/$repo/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null
fi
echo "Veröffentlicht: https://$owner.github.io/$repo/"
