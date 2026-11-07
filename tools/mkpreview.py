#!/usr/bin/env python3
"""Builds the THREE CHANGES pages from the live ones.
   python3 tools/mkpreview.py           -> /preview/ copies (noindex, links kept inside /preview/)
   python3 tools/mkpreview.py --ship    -> rewrites the live pages in place
Changes: Classifieds removed (3 of its ads kept as GIF banners), mosh-bg + appraisal turned on."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
ship = "--ship" in sys.argv
HEAD = '<link rel="stylesheet" href="/gate/appraisal.css">\n'
TAIL = ('<script src="/gate/mosh-bg.js" data-frames="/img/bg/" data-count="12" defer></script>\n'
        '<script src="/gate/appraisal.js" defer></script>\n')
def banner(name, alt): return f'<img class="ad" src="/gif/ad_{name}.gif" width="468" height="60" loading="lazy" alt="Advertisement: {alt}">\n<hr>\n'
BANNERS = {  # inserted just before these section anchors
  '<a name="stock" id="stock">': banner("revisit", "REVISIT KIT: ONE TUESDAY, 2007. $49.99. BUY NOW."),
  '<a name="hardcopy" id="hardcopy">': banner("singles", "HOT SINGLES IN YOUR AREA. They have been waiting since 2007. BUY NOW."),
  '<a name="standards" id="standards">': banner("freedom", "FREEDOM™, NOW AVAILABLE IN RED. Zero down. Zero APR. Zero. BUY NOW."),
}
def fix(src, page):
    s = src
    if page == "index":
        s = s.replace(' · <a href="#classifieds">Classifieds</a>', "")
        s = re.sub(r'<hr>\n<a name="classifieds".*?</ul>\n\n', "", s, flags=re.S)
        assert "classifieds" not in s.lower(), "classifieds left"
        for anchor, b in BANNERS.items():
            assert anchor in s, anchor
            s = s.replace(anchor, b + anchor, 1)
    if 'gate/appraisal.css' not in s:
        s = s.replace('<link rel="stylesheet" href="/gate.css">\n', '<link rel="stylesheet" href="/gate.css">\n' + HEAD)
        s = s.replace("</body>", TAIL + "</body>")
    if not ship:
        s = s.replace("<head>\n", '<head>\n<meta name="robots" content="noindex">\n', 1)
        s = re.sub(r'href="/(tools/|commissions/)?"', lambda m: f'href="/preview/{m.group(1) or ""}"', s)
    return s
for page, rel in [("index", "index.html"), ("tools", "tools/index.html"), ("commissions", "commissions/index.html")]:
    out = root / rel if ship else root / "preview" / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(fix((root / rel).read_text(), page))
    print("wrote", out.relative_to(root))
