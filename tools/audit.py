#!/usr/bin/env python3
"""Static audit of the site: every local href/src/url() target exists, every media file named in
archive/index.json exists, list external links and big files.  python3 tools/audit.py"""
import json, os, re, sys, html
from urllib.parse import urlparse, unquote
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'.git', 'preview', 'tools'}
pages = []
for d, ds, fs in os.walk(ROOT):
    ds[:] = [x for x in ds if x not in SKIP]
    pages += [os.path.join(d, f) for f in fs if f.endswith(('.html', '.css', '.js'))]
ref = re.compile(r'''(?:href|src|poster|content)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)|fetch\(\s*["']([^"']+)["']|location\.href\s*=\s*["']([^"']+)["']''', re.I)
broken, external = [], {}
def local(base, u):
    p = urlparse(u)
    if p.scheme in ('http', 'https'):
        if p.netloc in ('liveanddie.xyz', 'www.liveanddie.xyz'): u = p.path or '/'
        else: return None
    if p.scheme in ('mailto', 'data', 'javascript', 'tel') or u.startswith('#') or '${' in u or u.startswith('//'): return None
    path = unquote(urlparse(u).path)
    if not path: return None
    t = os.path.join(ROOT, path.lstrip('/')) if path.startswith('/') else os.path.normpath(os.path.join(os.path.dirname(base), path))
    if os.path.isdir(t): t = os.path.join(t, 'index.html')
    return t
for f in sorted(pages):
    src = open(f, encoding='utf-8', errors='replace').read()
    for m in ref.finditer(src):
        u = html.unescape(next(g for g in m.groups() if g))
        if re.match(r'https?://', u) and urlparse(u).netloc not in ('liveanddie.xyz', 'www.liveanddie.xyz'):
            external.setdefault(u, set()).add(os.path.relpath(f, ROOT)); continue
        if not re.match(r'^[\w./#?%~-]|^https?://', u) or ' ' in u: continue
        t = local(f, u)
        if t and not os.path.exists(t): broken.append((os.path.relpath(f, ROOT), u))
idx = json.load(open(os.path.join(ROOT, 'archive/index.json')))
miss = [(p['date'], m[k]) for p in idx for m in p['media'] for k in ('img', 'thumb', 'loop', 'audio') if m.get(k) and not os.path.exists(os.path.join(ROOT, 'archive', m[k]))]
big = []
for d, ds, fs in os.walk(ROOT):
    ds[:] = [x for x in ds if x != '.git']
    for x in fs:
        p = os.path.join(d, x); s = os.path.getsize(p)
        lim = 3 << 20 if x.endswith(('.mp4', '.m4a')) else 400 << 10
        if s > lim: big.append((s, os.path.relpath(p, ROOT)))
print(f'pages scanned: {len(pages)}')
print(f'BROKEN local refs: {len(broken)}'); [print('  ', a, '->', b) for a, b in broken]
print(f'MISSING archive media: {len(miss)}'); [print('  ', a, b) for a, b in miss[:40]]
print(f'BIG files: {len(big)}'); [print(f'   {s/1048576:.1f}M {p}') for s, p in sorted(big, reverse=True)[:40]]
print(f'EXTERNAL links: {len(external)}'); [print('  ', u, '<-', ', '.join(sorted(v))[:80]) for u, v in sorted(external.items())]
