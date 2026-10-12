"""
Kleine Flaggen der Länderseiten als Inline-SVG (Schlüssel = »flag« in content/sites.json).

Verwendet im Länder-Knopf (Weltkugel + Flagge) in Header und Footer, im Länderdialog und
im 3D-Showroom (zoller-produktumgebung-3d/tools/build_locale.py).
"""

FLAGS = {
    "de": '<svg class="flag" viewBox="0 0 5 3" width="33" height="20" aria-hidden="true"><path fill="#000" d="M0 0h5v1H0z"/><path fill="#d00" d="M0 1h5v1H0z"/><path fill="#ffce00" d="M0 2h5v1H0z"/></svg>',
    "ca": ('<svg class="flag" viewBox="0 0 9600 4800" width="40" height="20" aria-hidden="true"><path fill="#d52b1e" d="M0 0h9600v4800H0z"/><path fill="#fff" d="M2400 0h4800v4800H2400z"/>'
           '<path fill="#d52b1e" d="m4890 4430-45-863a95 95 0 0 1 111-98l859 151-116-320a65 65 0 0 1 20-73l941-762-212-99a65 65 0 0 1-34-79l186-572-542 115a65 65 0 0 1-73-38l-105-247-423 454a65 65 0 0 1-111-57l204-1052-327 189a65 65 0 0 1-91-27l-332-652-332 652a65 65 0 0 1-91 27l-327-189 204 1052a65 65 0 0 1-111 57l-423-454-105 247a65 65 0 0 1-73 38l-542-115 186 572a65 65 0 0 1-34 79l-212 99 941 762a65 65 0 0 1 20 73l-116 320 859-151a95 95 0 0 1 111 98l-45 863z"/></svg>'),
    "mx": ('<svg class="flag" viewBox="0 0 21 12" width="35" height="20" aria-hidden="true"><path fill="#006847" d="M0 0h7v12H0z"/><path fill="#fff" d="M7 0h7v12H7z"/><path fill="#ce1126" d="M14 0h7v12h-7z"/>'
           '<ellipse cx="10.5" cy="6" rx="1.7" ry="1.9" fill="#8c5a2b"/><path d="M8.9 7.2c.9 1 2.3 1 3.2 0" fill="none" stroke="#2e7d32" stroke-width=".45"/></svg>'),
    # 13 Streifen à 10 Einheiten; die 50 Sterne als runde Punkte (Strichmuster mit Länge 0), bei Flaggengröße nicht unterscheidbar
    "us": ('<svg class="flag" viewBox="0 0 247 130" width="38" height="20" aria-hidden="true"><path fill="#b22234" d="M0 0h247v130H0z"/>'
           '<path stroke="#fff" stroke-width="10" d="M0 15h247M0 35h247M0 55h247M0 75h247M0 95h247M0 115h247"/><path fill="#3c3b6e" d="M0 0h98.8v70H0z"/>'
           '<path fill="none" stroke="#fff" stroke-width="4.6" stroke-linecap="round" stroke-dasharray="0 16.4" '
           'd="M8.2 7h82.1M16.4 14h65.7M8.2 21h82.1M16.4 28h65.7M8.2 35h82.1M16.4 42h65.7M8.2 49h82.1M16.4 56h65.7M8.2 63h82.1"/></svg>'),
    # Weitere Länderseiten (2026-10-12). Wappen und Embleme vereinfacht – bei 20 px Höhe nicht unterscheidbar
    "at": '<svg class="flag" viewBox="0 0 3 2" width="30" height="20" aria-hidden="true"><path fill="#c8102e" d="M0 0h3v2H0z"/><path fill="#fff" d="M0 .667h3v.667H0z"/></svg>',
    "es": '<svg class="flag" viewBox="0 0 750 500" width="30" height="20" aria-hidden="true"><path fill="#aa151b" d="M0 0h750v500H0z"/><path fill="#f1bf00" d="M0 125h750v250H0z"/></svg>',
    "fr": '<svg class="flag" viewBox="0 0 3 2" width="30" height="20" aria-hidden="true"><path fill="#002395" d="M0 0h1v2H0z"/><path fill="#fff" d="M1 0h1v2H1z"/><path fill="#ed2939" d="M2 0h1v2H2z"/></svg>',
    "pt": ('<svg class="flag" viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><path fill="#da291c" d="M0 0h30v20H0z"/><path fill="#046a38" d="M0 0h12v20H0z"/>'
           '<circle cx="12" cy="10" r="4.2" fill="none" stroke="#ffe900" stroke-width="1"/><path fill="#fff" d="M9.9 7.4h4.2v3.6a2.1 2.1 0 0 1-4.2 0z"/>'
           '<path fill="#da291c" d="M10.4 7.9h3.2v3a1.6 1.6 0 0 1-3.2 0z"/></svg>'),
    "it": '<svg class="flag" viewBox="0 0 3 2" width="30" height="20" aria-hidden="true"><path fill="#009246" d="M0 0h1v2H0z"/><path fill="#fff" d="M1 0h1v2H1z"/><path fill="#ce2b37" d="M2 0h1v2H2z"/></svg>',
    "se": '<svg class="flag" viewBox="0 0 16 10" width="32" height="20" aria-hidden="true"><path fill="#006aa7" d="M0 0h16v10H0z"/><path fill="#fecc00" d="M5 0h2v10H5zM0 4h16v2H0z"/></svg>',
    "ru": '<svg class="flag" viewBox="0 0 9 6" width="30" height="20" aria-hidden="true"><path fill="#fff" d="M0 0h9v2H0z"/><path fill="#0039a6" d="M0 2h9v2H0z"/><path fill="#d52b1e" d="M0 4h9v2H0z"/></svg>',
    "tr": '<svg class="flag" viewBox="0 0 1200 800" width="30" height="20" aria-hidden="true"><path fill="#e30a17" d="M0 0h1200v800H0z"/><circle cx="425" cy="400" r="200" fill="#fff"/><circle cx="475" cy="400" r="160" fill="#e30a17"/><polygon fill="#fff" points="503.3,400.0 558.6,382.0 558.6,323.9 592.7,370.9 648.0,353.0 613.9,400.0 648.0,447.0 592.7,429.1 558.6,476.1 558.6,418.0"/></svg>',
    "pl": '<svg class="flag" viewBox="0 0 8 5" width="32" height="20" aria-hidden="true"><path fill="#fff" d="M0 0h8v5H0z"/><path fill="#dc143c" d="M0 2.5h8v2.5H0z"/></svg>',
    "si": ('<svg class="flag" viewBox="0 0 12 6" width="40" height="20" aria-hidden="true"><path fill="#fff" d="M0 0h12v2H0z"/><path fill="#0000ff" d="M0 2h12v2H0z"/><path fill="#f00" d="M0 4h12v2H0z"/>'
           '<path fill="#0000ff" stroke="#f00" stroke-width=".18" d="M2.3 1.1h2.2v1.3c0 .9-.6 1.3-1.1 1.6-.5-.3-1.1-.7-1.1-1.6z"/><path fill="#fff" d="m2.5 2.7.9-1 .9 1-.4.5h-1z"/></svg>'),
    "cz": '<svg class="flag" viewBox="0 0 6 4" width="30" height="20" aria-hidden="true"><path fill="#d7141a" d="M0 0h6v4H0z"/><path fill="#fff" d="M0 0h6v2H0z"/><path fill="#11457e" d="M0 0l3 2-3 2z"/></svg>',
    "hu": '<svg class="flag" viewBox="0 0 6 3" width="40" height="20" aria-hidden="true"><path fill="#ce2939" d="M0 0h6v1H0z"/><path fill="#fff" d="M0 1h6v1H0z"/><path fill="#477050" d="M0 2h6v1H0z"/></svg>',
    "sk": ('<svg class="flag" viewBox="0 0 9 6" width="30" height="20" aria-hidden="true"><path fill="#fff" d="M0 0h9v2H0z"/><path fill="#0b4ea2" d="M0 2h9v2H0z"/><path fill="#ee1c25" d="M0 4h9v2H0z"/>'
           '<path fill="#ee1c25" stroke="#fff" stroke-width=".15" d="M1.6 1.2h2.4v1.7c0 1-.7 1.5-1.2 1.8-.5-.3-1.2-.8-1.2-1.8z"/>'
           '<path fill="#0b4ea2" d="M1.75 3.5c.3-.3.7-.3 1.05 0 .35-.3.75-.3 1.05 0-.2.6-.6.9-1.05 1.1-.45-.2-.85-.5-1.05-1.1z"/>'
           '<path fill="#fff" d="M2.68 1.5h.24v1.9h-.24zM2.2 2h1.2v.22H2.2zM2.3 2.55h1v.22h-1z"/></svg>'),
    "cn": '<svg class="flag" viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><path fill="#ee1c25" d="M0 0h30v20H0z"/><path fill="#ffff00" d="M5.00 2.00L5.67 4.07L7.85 4.07L6.09 5.35L6.76 7.43L5.00 6.15L3.24 7.43L3.91 5.35L2.15 4.07L4.33 4.07zM9.14 2.51L9.62 1.97L9.25 1.34L9.91 1.63L10.39 1.08L10.33 1.80L11.00 2.09L10.29 2.25L10.22 2.97L9.85 2.35zM11.01 4.14L11.66 3.82L11.56 3.10L12.07 3.62L12.72 3.30L12.38 3.95L12.88 4.47L12.17 4.34L11.83 4.99L11.73 4.27zM11.04 6.73L11.76 6.70L11.96 6.00L12.21 6.68L12.94 6.66L12.37 7.10L12.62 7.79L12.01 7.38L11.44 7.83L11.64 7.13zM9.22 8.38L9.90 8.63L10.35 8.06L10.32 8.79L11.00 9.05L10.30 9.24L10.26 9.96L9.87 9.36L9.16 9.55L9.62 8.98z"/></svg>',
    "jp": '<svg class="flag" viewBox="0 0 3 2" width="30" height="20" aria-hidden="true"><path fill="#fff" d="M0 0h3v2H0z"/><circle cx="1.5" cy="1" r=".6" fill="#bc002d"/></svg>',
    "kr": ('<svg class="flag" viewBox="0 0 36 24" width="30" height="20" aria-hidden="true"><path fill="#fff" d="M0 0h36v24H0z"/>'
           '<g transform="rotate(33.69 18 12)"><path fill="#cd2e3a" d="M12 12a6 6 0 0 1 12 0 3 3 0 0 1-6 0 3 3 0 0 0-6 0z"/><path fill="#0047a0" d="M12 12a3 3 0 0 1 6 0 3 3 0 0 0 6 0 6 6 0 0 1-12 0z"/></g>'
           '<g fill="#000"><path transform="rotate(-56.31 6.5 5.2)" d="M4.5 4.1h4v.6h-4zM4.5 5h4v.6h-4zM4.5 5.9h4v.6h-4z"/>'
           '<path transform="rotate(56.31 29.5 5.2)" d="M27.5 4.1h4v.6h-4zM27.5 5h4v.6h-4zM27.5 5.9h4v.6h-4z"/>'
           '<path transform="rotate(56.31 6.5 18.8)" d="M4.5 17.7h4v.6h-4zM4.5 18.6h4v.6h-4zM4.5 19.5h4v.6h-4z"/>'
           '<path transform="rotate(-56.31 29.5 18.8)" d="M27.5 17.7h4v.6h-4zM27.5 18.6h4v.6h-4zM27.5 19.5h4v.6h-4z"/></g></svg>'),
    "in": ('<svg class="flag" viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><path fill="#ff9933" d="M0 0h30v6.67H0z"/><path fill="#fff" d="M0 6.67h30v6.66H0z"/><path fill="#138808" d="M0 13.33h30V20H0z"/>'
           '<circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width=".55"/><circle cx="15" cy="10" r=".6" fill="#000080"/></svg>'),
    "br": ('<svg class="flag" viewBox="0 0 20 14" width="29" height="20" aria-hidden="true"><path fill="#009c3b" d="M0 0h20v14H0z"/><path fill="#ffdf00" d="M1.7 7 10 1.7 18.3 7 10 12.3z"/>'
           '<circle cx="10" cy="7" r="3.5" fill="#002776"/><path fill="none" stroke="#fff" stroke-width=".55" d="M6.6 6.3c2.3-.6 4.9-.2 6.9 1.1"/></svg>'),
    "gb": ('<svg class="flag" viewBox="0 0 60 30" width="40" height="20" aria-hidden="true"><clipPath id="flag-gb-t"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath>'
           '<path fill="#012169" d="M0 0h60v30H0z"/><path stroke="#fff" stroke-width="6" d="M0 0l60 30m0-30L0 30"/>'
           '<path stroke="#c8102e" stroke-width="4" clip-path="url(#flag-gb-t)" d="M0 0l60 30m0-30L0 30"/>'
           '<path stroke="#fff" stroke-width="10" d="M30 0v30M0 15h60"/><path stroke="#c8102e" stroke-width="6" d="M30 0v30M0 15h60"/></svg>'),
}
