#!/usr/bin/env python3
"""Download selected Commons originals and write manifest."""
import json, os, re, sys, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commons_fetch import info, is_ok

# Викимедиа требует контакт в User-Agent и без него режет запросы (403,
# «honor our robot policy»). Адрес должен быть свой: чужой домен здесь
# стоять не может. Задайте его переменной окружения WIKI_CONTACT.
UA = ('NevskyEducationalBot/1.0 (educational use; contact: '
      + os.environ.get('WIKI_CONTACT', 'ЗАДАЙТЕ-WIKI_CONTACT') + ')')
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(_ROOT, 'raw-images')

# (commons title, local filename, subject, title_ru, author_ru, date_ru,
#  description_ru, isContemporaneous, license_url_override)
SEL = [
 ("File:Birch-bark letter 292 real.jpg",
  "berestyanaya-gramota-292.jpg",
  "Берестяная грамота",
  "Новгородская берестяная грамота № 292",
  "неизвестен (автор текста); фотография — Gratomy.ru",
  "начало XIII века",
  "Подлинная берестяная грамота № 292 из Новгорода на карельском (прибалтийско-финском) языке — редчайший документ, прямо связывающий Новгород с карельским населением накануне похода 1240 года.",
  True, None),

 ("File:St. Sophia Cathedral in Veliky Novgorod (general view from the belfry).jpg",
  "novgorod-sofiyskiy-sobor.jpg",
  "Новгородский детинец / Софийский собор",
  "Софийский собор и Новгородский детинец (общий вид с звонницы)",
  "Vityavo (фотограф)",
  "фотография 2026 года",
  "Софийский собор (1045-1050) — главный храм Новгородской республики, сохранившийся до наших дней; в игре задаёт облик города, откуда ушла дружина Александра.",
  True, None),

 ("File:Fortress Staraya Ladoga kremlin.jpg",
  "staraya-ladoga-krepost.jpg",
  "Старая Ладога",
  "Староладожская крепость (общий вид)",
  "Rakoon (фотограф)",
  "фотография 2006 года",
  "Каменная Староладожская крепость на мысу при впадении Ладожки в Волхов — ключевой пункт пути «из варяг в греки» и ближайший к Невской битве укреплённый город.",
  True, None),

 ("File:Volkhov river 2022-02.jpg",
  "reka-volkhov.jpg",
  "Река Волхов",
  "Река Волхов в Великом Новгороде",
  "Svetlov Artem (фотограф)",
  "фотография 2022 года",
  "Река Волхов — главная водная артерия Новгородской земли, по которой шли ладьи к Неве и Балтике.",
  True, None),

 ("File:Kupferstich - Russland - Kapurga-Gama - Jaama-Koporje - Stridbeck - 1720.jpg",
  "koporskaya-krepost-gravura-1720.jpg",
  "Копорская крепость",
  "Копорская крепость на гравюре 1720 года (Яма и Копорье)",
  "Riedt по Georg Perlberg; гравюра из собрания Stridbeck",
  "1720 год",
  "Копорский погост, где в 1240 году немцы поставили крепость, а в 1241 году её отбил Александр Невский. Заменяющая иллюстрация: подлинных фотографий Копорья со свободной лицензией на Commons нет, поэтому взята гравюра 1720 года (крепость и Яма).",
  False, None),

 ("File:Facial Chronicle - b.06, p.028 - Battle of Neva.png",
  "litsevoy-svod-nevskaya-bitva.jpg",
  "Лицевой летописный свод — Невская битва",
  "Невская битва. Миниатюра Лицевого летописного свода, том 6 (Лаптевский), лист 28",
  "неизвестен (русские книжники круга Ивана Грозного)",
  "XVI век (1560-1570-е)",
  "Миниатюра Лицевого летописного свода, изображающая, как Александр напал на неприятелей в шестом часу дня и ранил короля в лицо; прямой источник сцены битвы для игры.",
  False, None),

 ("File:Alexander Nevsky vita icon.jpg",
  "alekandr-nevskiy-ikona-zhitie.jpg",
  "Александр Невский (икона)",
  "Икона «Александр Невский в житии»",
  "неизвестен",
  "XVI век",
  "Житийная икона Александра Невского XVI века из Покровского собора (храм Василия Блаженного) — старейшее известное иконописное изображение князя, не современное перерисовкам.",
  False, None),

 ("File:Birgerjarlsigill.JPG",
  "pechat-birgera-yarla.jpg",
  "Печать Биргера Ярла / скандинавский корабль",
  "Оттиск печати Биргера Ярла",
  "неизвестен (фотография из книги «Kulturhistoriska bilder», 1938)",
  "печать XIII века, фотография 1938 года",
  "Оттиск личной печати Биргера Ярла — фактического руководителя шведского похода на Неву 1240 года; подлинный sigill шведского правителя.",
  True, None),

 ("File:Nasal of helmet - 13c - Izborsk Museum-Reserve.jpg",
  "shlem-nanosnik-izborsk-13c.jpg",
  "Древнерусский шлем / оружие XIII века",
  "Наносник боевого шлема, начало XIII века",
  "неизвестен (фотография — участник Commons «Лапоть»)",
  "начало XIII века",
  "Железный наносник боевого шлема начала XIII века из музея-заповедника «Изборск» — подлинная деталь защитного вооружения эпохи Невской битвы.",
  True, None),

 ("File:Sack of Chernigov (1239).png",
  "litsevoy-svod-razorеnie-1239.jpg",
  "Лицевой свод о нашествии Орды",
  "Разорение Чернигова (1239). Миниатюра Лицевого летописного свода",
  "неизвестен (русские книжники круга Ивана Грозного)",
  "XVI век (1560-1570-е)",
  "Миниатюра Лицевого свода о взятии и сожжении Чернигова татарами в 1239 году — контекст ордынского нашествия, на фоне которого происходит Невская битва.",
  False, None),
]

PD_URL = 'https://commons.wikimedia.org/wiki/Commons:Copyright_tags#Public_domain'

def download(url, path):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=180) as r, open(path, 'wb') as f:
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)

def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for title, fname, subj, tit, auth, date, desc, cont, lur in SEL:
        meta = info(title)
        m = meta.get(title)
        if not m:
            print('MISSING:', title)
            continue
        lic = re.sub(r'<[^>]+>', '', m['license'] or '').strip()
        if not is_ok(lic):
            print('REJECTED (license):', title, '->', lic)
            continue
        url = m['url'].split('?')[0]
        path = os.path.join(OUT, fname)
        download(url, path)
        size = os.path.getsize(path)
        lurl = (m['licenseUrl'] or '').strip() or PD_URL
        lu = re.sub(r'<[^>]+>', '', lurl)
        manifest.append({
            'file': fname,
            'subject': subj,
            'title': tit,
            'author': auth,
            'date': date,
            'license': lic,
            'licenseUrl': lu,
            'sourcePage': 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote(title.replace(' ', '_')),
            'descriptionRu': desc,
            'isContemporaneous': cont,
        })
        print('OK %-45s %8.1f KB  %s  %s' % (fname, size / 1024, lic, m['width']))

    with open(os.path.join(OUT, 'manifest-artefacts.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('manifest entries:', len(manifest))

if __name__ == '__main__':
    main()
