#!/usr/bin/env python3
"""Helper for Commons search / license check / download."""
import json, sys, urllib.parse, urllib.request, os

# Викимедиа требует контакт в User-Agent и без него режет запросы (403,
# «honor our robot policy»). Адрес должен быть свой: чужой домен здесь
# стоять не может. Задайте его переменной окружения WIKI_CONTACT.
UA = ('NevskyEducationalBot/1.0 (educational use; contact: '
      + os.environ.get('WIKI_CONTACT', 'ЗАДАЙТЕ-WIKI_CONTACT') + ')')
API = 'https://commons.wikimedia.org/w/api.php'
WHITELIST = ['public domain', 'pd-old', 'pd-art', 'cc0', 'pd-russia',
             'pd-old-100', 'pd-old-70', 'pd-old-80', 'pd-old-90',
             'pd-1923', 'pd-us', 'pd-soviet', 'pd-usgov', 'pd-self',
             'cc-zero', 'no restrictions', 'pd-anon', 'pd-1996']

def api(params):
    params = dict(params)
    params['format'] = 'json'
    url = API + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def search(term, limit=15):
    d = api({'action': 'query', 'list': 'search', 'srsearch': term,
             'srnamespace': 6, 'srlimit': limit})
    return [x['title'] for x in d.get('query', {}).get('search', [])]

def info(titles):
    if isinstance(titles, str):
        titles = [titles]
    d = api({'action': 'query', 'prop': 'imageinfo', 'titles': '|'.join(titles),
             'iiprop': 'extmetadata|url|size'})
    out = {}
    for pid, page in d.get('query', {}).get('pages', {}).items():
        t = page.get('title')
        if 'missing' in page or 'imageinfo' not in page:
            out[t] = None
            continue
        ii = page['imageinfo'][0]
        em = ii.get('extmetadata', {})
        def g(k):
            v = em.get(k, {}).get('value', '')
            return v
        out[t] = {
            'url': ii.get('url'),
            'width': ii.get('width'),
            'height': ii.get('height'),
            'size': ii.get('size'),
            'mime': ii.get('mime'),
            'license': g('LicenseShortName'),
            'licenseUrl': g('LicenseUrl'),
            'artist': g('Artist'),
            'date': g('DateTimeOriginal'),
            'objectname': g('ObjectName'),
            'desc': g('ImageDescription')[:300],
            'credit': g('Credit')[:200],
            'usage': g('UsageTerms'),
            'restrictions': g('Restrictions'),
        }
    return out

def is_ok(lic):
    if not lic:
        return False
    l = lic.lower().strip()
    return any(w in l for w in WHITELIST)

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'search':
        for t in search(' '.join(sys.argv[2:])):
            print(t)
    elif cmd == 'info':
        res = info(sys.argv[2:])
        for t, i in res.items():
            print('=' * 70)
            print('TITLE:', t)
            if not i:
                print('  MISSING')
                continue
            ok = is_ok(i['license'])
            print('  LICENSE:', i['license'], '->', 'OK' if ok else 'REJECT')
            print('  LICURL :', i['licenseUrl'])
            print('  ARTIST :', i['artist'])
            print('  DATE   :', i['date'])
            print('  SIZE   :', i['size'], 'bytes', i['width'], 'x', i['height'], i['mime'])
            print('  URL    :', i['url'])
            print('  DESC   :', i['desc'][:220])
