#!/usr/bin/env python3
"""Scan a Commons category for files with whitelisted licenses."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commons_fetch import api, is_ok

def scan(cat, limit=500):
    titles = []
    cont = None
    while True:
        p = {'action': 'query', 'list': 'categorymembers', 'cmtitle': 'Category:' + cat,
             'cmtype': 'file', 'cmlimit': 500}
        if cont:
            p['cmcontinue'] = cont
        d = api(p)
        titles += [x['title'] for x in d.get('query', {}).get('categorymembers', [])]
        cont = d.get('continue', {}).get('cmcontinue')
        if not cont or len(titles) >= limit:
            break
    good = []
    for i in range(0, len(titles), 15):
        chunk = titles[i:i + 15]
        d = api({'action': 'query', 'prop': 'imageinfo', 'titles': '|'.join(chunk),
                 'iiprop': 'extmetadata|url|size'})
        for pid, page in d.get('query', {}).get('pages', {}).items():
            if 'imageinfo' not in page:
                continue
            ii = page['imageinfo'][0]
            em = ii.get('extmetadata', {})
            lic = em.get('LicenseShortName', {}).get('value', '')
            date = em.get('DateTimeOriginal', {}).get('value', '')
            if is_ok(lic):
                good.append((page['title'], lic, date, ii.get('width'), ii.get('height'),
                             ii.get('size')))
    return titles, good

if __name__ == '__main__':
    cat = sys.argv[1]
    titles, good = scan(cat)
    print('total files in category:', len(titles))
    print('whitelisted:', len(good))
    for t, lic, date, w, h, s in good:
        import re
        date = re.sub('<[^>]+>', '', date)[:40]
        print('%-70s | %-18s | %s | %sx%s | %.1fKB' % (t[:70], lic, date, w, h, (s or 0) / 1024))
