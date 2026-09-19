#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nevsky — генератор геометрии карты-свитка.
Источник: Natural Earth 1:10m (public domain). Проекция: коническая
равнопромежуточная/Ламберта (LCC), std parallels 57.5 и 61.5, центр 30.0E.

Выход: geo.json — массивы SVG-патчей в системе координат 0..W / 0..H.
"""
import json, math, os, sys

NE = "/tmp/ne"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # корень репозитория
OUT = os.path.join(HERE, "geo.json")
# Вторая копия — та, что уезжает в сборку. Геометрия нужна и инструменту,
# и продукту, а два независимых файла разошлись бы молча. Пишем оба сразу,
# источником правды остаётся этот генератор.
OUT_APP = os.path.join(ROOT, "core", "src", "map", "geography.json")

# --- рамка региона: политический театр 1240 г. --------------------------
LAT_MIN, LAT_MAX = 56.4, 61.9
LON_MIN, LON_MAX = 22.8, 34.2

# --- проекция: Lambert Conformal Conic ----------------------------------
P1, P2, P0 = 57.5, 61.5, 59.0
LON0 = 30.0
R = 6371.0

def _t(phi):
    return math.tan(math.pi / 4 + phi / 2)

_phi1, _phi2 = math.radians(P1), math.radians(P2)
_n = (math.log(math.cos(_phi1) / math.cos(_phi2)) /
      math.log(_t(_phi2) / _t(_phi1)))
_F = math.cos(_phi1) * _t(_phi1) ** _n / _n
_rho0 = _F / _t(math.radians(P0)) ** _n

def proj(lon, lat):
    """(lon,lat) -> (x,y) в километрах, ось Y вверх."""
    lam = math.radians(lon - LON0)
    rho = _F / _t(math.radians(lat)) ** _n
    return (R * rho * math.sin(_n * lam), R * (_rho0 - rho * math.cos(_n * lam)))


def clip_poly(ring, box):
    """Sutherland–Hodgman: кольцо -> отсечение прямоугольником box=(x0,y0,x1,y1)."""
    x0, y0, x1, y1 = box
    edges = [
        (lambda p: p[0] >= x0, lambda a, b: _ix(a, b, x0)),
        (lambda p: p[0] <= x1, lambda a, b: _ix(b, a, x1)),
        (lambda p: p[1] >= y0, lambda a, b: _iy(a, b, y0)),
        (lambda p: p[1] <= y1, lambda a, b: _iy(b, a, y1)),
    ]
    out = list(ring)
    for inside, cross in edges:
        if not out:
            return []
        prev, acc = out[-1], []
        for cur in out:
            if inside(cur):
                if not inside(prev):
                    acc.append(cross(prev, cur))
                acc.append(cur)
            elif inside(prev):
                acc.append(cross(prev, cur))
            prev = cur
        out = acc
    return out


def _ix(a, b, x):
    if b[0] == a[0]:
        return (x, a[1])
    t = (x - a[0]) / (b[0] - a[0])
    return (x, a[1] + t * (b[1] - a[1]))


def _iy(a, b, y):
    if b[1] == a[1]:
        return (a[0], y)
    t = (y - a[1]) / (b[1] - a[1])
    return (a[0] + t * (b[0] - a[0]), y)


def clip_line(pts, box):
    """Отсечение ломаной: список независимых сегментов внутри box."""
    x0, y0, x1, y1 = box
    segs, cur = [], []
    for p in pts:
        if x0 <= p[0] <= x1 and y0 <= p[1] <= y1:
            cur.append(p)
        else:
            if len(cur) > 1:
                segs.append(cur)
            cur = []
    if len(cur) > 1:
        segs.append(cur)
    return segs


def rings(geom):
    """Все кольца/линии из любой геометрии."""
    t, c = geom["type"], geom["coordinates"]
    if t == "Polygon":
        return [c[0]] + [r for r in c[1:]]
    if t == "MultiPolygon":
        return [p[0] for p in c]
    if t == "LineString":
        return [c]
    if t == "MultiLineString":
        return list(c)
    return []


def load(name):
    with open(os.path.join(NE, name), encoding="utf-8") as f:
        return json.load(f)["features"]


def in_box(lon, lat):
    return LON_MIN - 1.5 <= lon <= LON_MAX + 1.5 and LAT_MIN - 1.0 <= lat <= LAT_MAX + 1.0


# ══════════════════════════════════════════════════════════════════════
#  МАРШРУТЫ: собираются из настоящей геометріи рѣкъ, озёръ и моря,
#  потомъ проверяются. Внутренній порядокъ координатъ — (lat, lon).
# ══════════════════════════════════════════════════════════════════════

R_KM = 6371.0


def _load(name):
    with open(os.path.join(NE, name), encoding="utf-8") as f:
        return json.load(f)["features"]


def _km(a, b):
    d = math.radians
    p1, p2 = d(a[0]), d(b[0])
    h = (math.sin((p2 - p1) / 2) ** 2 +
         math.cos(p1) * math.cos(p2) * math.sin(d(b[1] - a[1]) / 2) ** 2)
    return 2 * R_KM * math.asin(math.sqrt(h))


def _line_of(features, name, want_latlon=True):
    parts = []
    for f in features:
        if f["properties"].get("name") != name:
            continue
        g = f["geometry"]
        if g["type"] == "LineString":
            parts.append(g["coordinates"])
        elif g["type"] == "MultiLineString":
            parts.extend(g["coordinates"])
    if not parts:
        return None
    ln = max(parts, key=len)
    return [(pt[1], pt[0]) for pt in ln] if want_latlon else [tuple(pt[:2]) for pt in ln]


def _ring_of(features, name):
    for f in features:
        if f["properties"].get("name") != name:
            continue
        g = f["geometry"]
        if g["type"] == "Polygon":
            return [(pt[1], pt[0]) for pt in g["coordinates"][0]]
        if g["type"] == "MultiPolygon":
            big = max(g["coordinates"], key=lambda poly: len(poly[0]))
            return [(pt[1], pt[0]) for pt in big[0]]
    return None


def _coast_points():
    """Всѣ точки береговой линіи въ нашей рамкѣ — для провѣрки «далеко ли до суши»."""
    pts = []
    for f in _load("ne_10m_coastline.geojson"):
        g = f["geometry"]
        lines = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        for ln in lines:
            for c in ln:
                if 54 < c[1] < 66 and 8 < c[0] < 42:
                    pts.append((c[1], c[0]))
    return pts


def _in_poly(p, poly):
    y, x = p
    ins, n = False, len(poly)
    for i in range(n):
        y1, x1 = poly[i]
        y2, x2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            ins = not ins
    return ins


def _nearest_idx(seq, pt):
    """Ближайшая точка съ учётомъ сжатія долготы по широтѣ (иначе метрика врётъ)."""
    k = math.cos(math.radians(pt[0]))
    return min(range(len(seq)),
               key=lambda i: (seq[i][0] - pt[0]) ** 2 + ((seq[i][1] - pt[1]) * k) ** 2)


def _chain_of(features, name, start_pt):
    """Сшить рѣку изъ кусковъ: Natural Earth рвётъ линіи на части."""
    parts = []
    for f in features:
        if f["properties"].get("name") != name:
            continue
        g = f["geometry"]
        if g["type"] == "LineString":
            parts.append([(pt[1], pt[0]) for pt in g["coordinates"]])
        elif g["type"] == "MultiLineString":
            parts.extend([[(pt[1], pt[0]) for pt in ln] for ln in g["coordinates"]])
    if not parts:
        return None
    # начинаемъ съ куска, гдѣ есть точка, ближайшая къ началу
    k = math.cos(math.radians(start_pt[0]))
    def dist(a, b):
        return (a[0] - b[0]) ** 2 + ((a[1] - b[1]) * k) ** 2
    idx = min(range(len(parts)),
              key=lambda i: min(dist(p, start_pt) for p in parts[i]))
    chain = list(parts.pop(idx))
    if dist(chain[-1], start_pt) < dist(chain[0], start_pt):
        chain.reverse()
    while parts:
        end = chain[-1]
        best, j, rev = None, None, False
        for i, part in enumerate(parts):
            for rv in (False, True):
                q = part[-1] if rv else part[0]
                d = dist(q, end)
                if best is None or d < best:
                    best, j, rev = d, i, rv
        part = parts.pop(j)
        if rev:
            part = list(reversed(part))
        chain.extend(part)
    return chain


def _orient(line, start_pt, end_pt):
    i0, i1 = _nearest_idx(line, start_pt), _nearest_idx(line, end_pt)
    return list(reversed(line[i1:i0 + 1])) if i0 > i1 else line[i0:i1 + 1]


def _despike(seq, k=0.55):
    """Убрать петли и выбросы: ежели путь черезъ точку длиннѣе обхода — точка лишняя."""
    out = list(seq)
    changed = True
    while changed and len(out) > 3:
        changed = False
        for i in range(1, len(out) - 1):
            a, b, c = out[i - 1], out[i], out[i + 1]
            d_ab, d_bc, d_ac = _km(a, b), _km(b, c), _km(a, c)
            if d_ab + d_bc > 0 and d_ac < k * (d_ab + d_bc):
                out.pop(i)
                changed = True
                break
    return out


def _simplify(pts, step):
    out = pts[::step]
    if out[-1] != pts[-1]:
        out.append(pts[-1])
    return out


# ══════════════════════════════════════════════════════════════════════
#  ВОДА ИЛИ СУША: растровый тестъ. Береговая линія — стѣны, заливка отъ моря.
#  Нуженъ потому, что «далеко отъ берега» ≠ «на водѣ» (точка въ глубинѣ
#  Эстоніи тоже далека отъ берега). Natural Earth ocean однимъ кольцомъ на
#  весь міръ — point-in-polygon по нему безполезенъ.
# ══════════════════════════════════════════════════════════════════════

class WaterMask:
    def __init__(self, lat0=58.0, lat1=62.0, lon0=19.5, lon1=33.0, step=0.006,
                 seed=(58.20, 19.90)):
        self.lat0, self.lon0, self.step = lat0, lon0, step
        self.ny = int((lat1 - lat0) / step) + 1
        self.nx = int((lon1 - lon0) / step) + 1
        self.wall = bytearray(self.nx * self.ny)
        self.water = bytearray(self.nx * self.ny)
        self._walls()
        self._flood(seed)
        self.coast = [p for p in _coast_points()
                      if lat0 <= p[0] <= lat1 and lon0 <= p[1] <= lon1][::2]

    def _idx(self, la, lo):
        x = int((lo - self.lon0) / self.step)
        y = int((la - self.lat0) / self.step)
        return x, y

    def _walls(self):
        for f in _load("ne_10m_coastline.geojson"):
            g = f["geometry"]
            lines = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
            for ln in lines:
                for i in range(1, len(ln)):
                    x0, y0 = ln[i - 1][0], ln[i - 1][1]
                    x1, y1 = ln[i][0], ln[i][1]
                    if not (self.lon0 - .2 < x0 < self.lon0 + (self.nx - 1) * self.step + .2 and
                            self.lat0 - .2 < y0 < self.lat0 + (self.ny - 1) * self.step + .2):
                        continue
                    n = max(2, int(max(abs(x1 - x0), abs(y1 - y0)) / self.step) + 1)
                    for k in range(n + 1):
                        xa = x0 + (x1 - x0) * k / n
                        ya = y0 + (y1 - y0) * k / n
                        cx, cy = self._idx(ya, xa)
                        for dy in (-1, 0, 1):
                            for dx in (-1, 0, 1):
                                X, Y = cx + dx, cy + dy
                                if 0 <= X < self.nx and 0 <= Y < self.ny:
                                    self.wall[Y * self.nx + X] = 1

    def _flood(self, seed):
        from collections import deque
        sx, sy = self._idx(*seed)
        if self.wall[sy * self.nx + sx]:
            raise SystemExit("заливка начата со стѣны — смѣсти seed")
        q = deque([(sx, sy)])
        self.water[sy * self.nx + sx] = 1
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < self.nx and 0 <= Y < self.ny:
                    i = Y * self.nx + X
                    if not self.water[i] and not self.wall[i]:
                        self.water[i] = 1
                        q.append((X, Y))

    def is_water(self, lat, lon):
        x, y = self._idx(lat, lon)
        if not (0 <= x < self.nx and 0 <= y < self.ny):
            return False
        i = y * self.nx + x
        return bool(self.water[i]) and not self.wall[i]

    def land_km(self, lat, lon):
        k = math.cos(math.radians(lat))
        return min(math.hypot(lat - a, (lon - b) * k) for a, b in self.coast) * 111.2


def build_routes():
    rivers = _load("ne_10m_rivers_lake_centerlines.geojson")
    lakes = _load("ne_10m_lakes.geojson")

    volkhov = _chain_of(rivers, "Volkhov", (58.52, 31.28))
    neva = _chain_of(rivers, "Neva", (59.945, 31.03))
    ladoga = _ring_of(lakes, "Lake Ladoga")
    coast = _coast_points()
    if not (volkhov and neva and ladoga):
        raise SystemExit("нѣтъ геометріи Волхова/Невы/Ладоги — маршруты не построить")

    NOVGOROD = (58.52, 31.28)
    VOLKHOV_MOUTH = (60.10, 32.30)
    NEVA_SOURCE = (59.945, 31.03)      # Шлиссельбургъ
    IZHORA = (59.808, 30.604)          # устье Ижоры: сѣверная точка р. Ижоры по OSM
    NEVA_SEA = (59.95, 30.20)          # устье Невы (море)

    # 1) Волховъ: Новгородъ -> устье
    leg_volkhov = _simplify(_orient(volkhov, NOVGOROD, VOLKHOV_MOUTH),
                            max(1, len(_orient(volkhov, NOVGOROD, VOLKHOV_MOUTH)) // 8))

    # 2) Ладога: южный берегъ, сдвинутый въ озеро на 12 %
    n = len(ladoga)
    i0, i1 = _nearest_idx(ladoga, VOLKHOV_MOUTH), _nearest_idx(ladoga, NEVA_SOURCE)
    arcA = [ladoga[(i0 + k) % n] for k in range((i1 - i0) % n + 1)]
    arcB = [ladoga[(i1 + k) % n] for k in range((i0 - i1) % n + 1)]
    arc = arcB if (sum(p[0] for p in arcB) / len(arcB)) < (sum(p[0] for p in arcA) / len(arcA)) else arcA
    cy = sum(p[0] for p in ladoga) / n
    cx = sum(p[1] for p in ladoga) / n
    def into_lake(p):
        q = (p[0] + (cy - p[0]) * 0.12, p[1] + (cx - p[1]) * 0.12)
        for _ in range(40):
            if _in_poly(q, ladoga):
                return q
            q = (q[0] + (cy - q[0]) * 0.05, q[1] + (cx - q[1]) * 0.05)
        return q
    arc_in = [into_lake(p) for p in arc]
    leg_ladoga = _simplify(arc_in, max(1, len(arc_in) // 6))

    # 3) Нева: истокъ -> устье Ижоры (для дружины) и устье -> Ижора (для свеев)
    leg_neva_down = _simplify(_orient(neva, NEVA_SOURCE, IZHORA),
                              max(1, len(_orient(neva, NEVA_SOURCE, IZHORA)) // 5))
    leg_neva_up = _simplify(_orient(neva, NEVA_SEA, IZHORA),
                            max(1, len(_orient(neva, NEVA_SEA, IZHORA)) // 3))

    def dedup(seq, eps=0.03):
        out = [seq[0]]
        for p in seq[1:]:
            if abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) > eps:
                out.append(p)
        return out

    knyaz = _despike(dedup([NOVGOROD] + leg_volkhov + leg_ladoga + leg_neva_down))
    if _km(knyaz[-1], IZHORA) > 0.5:
        knyaz.append(IZHORA)

    problems_pre = []
    mask = WaterMask()

    # не выпускать морскія точки за рамку карты
    FLAT, FLON = (56.9, 61.5), (23.4, 33.8)

    def open_water_near(guess, rad=0.50):
        """Ближайшая ОТКРЫТАЯ ВОДА въ предѣлахъ карты."""
        best, bd = None, -1.0
        for i in range(-10, 11):
            for j in range(-8, 9):
                q = (guess[0] + i * rad / 10, guess[1] + j * rad / 8)
                if not (FLAT[0] <= q[0] <= FLAT[1] and FLON[0] <= q[1] <= FLON[1]):
                    continue
                if not mask.is_water(*q):
                    continue
                d = mask.land_km(*q)
                if d > bd:
                    best, bd = q, d
        if best is None:
            return guess, 0.0
        return (round(best[0], 3), round(best[1], 3)), round(bd, 1)

    SEA, sea_report = [], []
    for guess in ((59.42, 23.70), (59.55, 24.55), (59.75, 26.20), (59.95, 27.80), (59.90, 29.10)):
        q, d = open_water_near(guess)
        SEA.append(q)
        sea_report.append(f"{guess} → {q}, до берега {d} км")
    print("морскія точки свеевъ:")
    for r in sea_report:
        print("   ", r)
    problems_pre += [f"море: до берега меньше 12 км — {r}" for r in sea_report
                     if float(r.split("до берега ")[1].split(" км")[0]) < 12]
    svei = _despike(dedup(SEA + leg_neva_up))
    if _km(svei[-1], IZHORA) > 0.5:
        svei.append(IZHORA)

    # ─── провѣрка ──────────────────────────────────────────────────────
    problems_pre = []
    problems = []
    for i, p in enumerate(SEA):
        if not mask.is_water(*p):
            problems.append(f"свеи, точка {i} {p}: не вода (растровый тестъ)")
        else:
            d = mask.land_km(*p)
            if d < 12:
                problems.append(f"свеи, точка {i} {p}: до суши {d:.1f} км (< 12)")
    if not mask.is_water(*knyaz[-1]):
        pass  # конечная точка — берегъ, гдѣ стояла дружина: суша законна
    for i, p in enumerate(knyaz):
        d_r = min(min(_km(p, q) for q in volkhov), min(_km(p, q) for q in neva))
        in_lad = _in_poly(p, ladoga)
        if not in_lad and d_r > 8:
            problems.append(f"дружина, точка {i} {p}: до Волхова/Невы {d_r:.1f} км и не въ Ладогѣ")
    for i, p in enumerate(leg_ladoga):
        if not _in_poly(p, ladoga):
            problems.append(f"ладожскій отрѣзокъ, точка {i} {p}: внѣ озера")
    # разрывы: по рѣкамъ/озеру ходъ короткій, по морю — длинные переходы (до 300 км)
    for nm, seq, lim in (("дружина", knyaz, 60), ("свеи", svei, 300)):
        for i in range(1, len(seq)):
            d = _km(seq[i - 1], seq[i])
            if d > lim:
                problems.append(f"{nm}: разрывъ {d:.0f} км между точками {i-1} и {i} (> {lim})")

    problems = problems_pre + problems
    if problems:
        print("!! МАРШРУТЫ НЕ ПРОШЛИ ПРОВѢРКУ:")
        for x in problems:
            print("   -", x)
    else:
        print("маршруты прошли провѣрку: всѣ точки на водѣ, разрывовъ нѣтъ")

    ll = lambda seq: [[round(lon, 5), round(lat, 5)] for lat, lon in seq]
    return ({"knyaz": {"id": "knyaz", "label": "дружина князя", "pts": ll(knyaz)},
             "svei": {"id": "svei", "label": "шведы, июль 1240", "pts": ll(svei)}},
            {"knyaz_pts": len(knyaz), "svei_pts": len(svei),
             "problems": problems,
             "knyaz_km": round(sum(_km(knyaz[i - 1], knyaz[i]) for i in range(1, len(knyaz)))),
             "svei_km": round(sum(_km(svei[i - 1], svei[i]) for i in range(1, len(svei))))})


def main():
    box_geo = (LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)
    # проектная рамка с запасом
    corners = [proj(*c) for c in [(LON_MIN, LAT_MIN), (LON_MIN, LAT_MAX),
                                 (LON_MAX, LAT_MIN), (LON_MAX, LAT_MAX)]]
    px0 = min(c[0] for c in corners) - 20
    px1 = max(c[0] for c in corners) + 20
    py0 = min(c[1] for c in corners) - 20
    py1 = max(c[1] for c in corners) + 20
    pbox = (px0, py0, px1, py1)

    # масштаб: большая сторона = 1000, вторая — по пропорции geography
    _sc = 1000.0 / max(px1 - px0, py1 - py0)
    W = round((px1 - px0) * _sc, 1)
    H = round((py1 - py0) * _sc, 1)

    def to_svg(x, y):
        return ((x - px0) * _sc,
                (py1 - y) * _sc)

    def path(ring, close=True):
        pts = [to_svg(*proj(lon, lat)) for lon, lat in ring]
        if len(pts) < 3:
            return None
        d = "M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        return d + ("Z" if close else "")

    out = {"ocean": [], "lakes": [], "rivers": [], "meta": {}}

    # --- море -----------------------------------------------------------
    for f in load("ne_10m_ocean.geojson"):
        for r in rings(f["geometry"]):
            g = clip_poly([proj(*p[:2]) for p in r], pbox)
            if len(g) >= 3:
                pts = [to_svg(*p) for p in g]
                out["ocean"].append("M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")

    # --- озёра (только те, что реально в рамке) --------------------------
    lake_names = []
    for f in load("ne_10m_lakes.geojson"):
        pr = f["properties"]
        cen = None
        for r in rings(f["geometry"]):
            if r:
                cen = r[0]
                break
        if not cen or not in_box(cen[0], cen[1]):
            continue
        nm = pr.get("name") or ""
        lake_names.append(nm)
        for r in rings(f["geometry"]):
            g = clip_poly([proj(*p[:2]) for p in r], pbox)
            if len(g) >= 3:
                pts = [to_svg(*p) for p in g]
                out["lakes"].append({"d": "M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z",
                                     "name": nm, "name_ru": pr.get("name_ru") or nm})

    # --- реки -----------------------------------------------------------
    river_names = []
    for f in load("ne_10m_rivers_lake_centerlines.geojson"):
        pr = f["properties"]
        nm = pr.get("name") or ""
        for r in rings(f["geometry"]):
            if not any(in_box(p[0], p[1]) for p in r):
                continue
            for seg in clip_line([proj(*p[:2]) for p in r], pbox):
                if len(seg) < 2:
                    continue
                pts = [to_svg(*p) for p in seg]
                out["rivers"].append({"d": "M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts),
                                      "name": nm,
                                      "scalerank": pr.get("scalerank", 10)})
            if nm and nm not in river_names:
                river_names.append(nm)

    out["meta"] = {"w": W, "h": H,
                   "bbox_proj": [px0, py0, px1, py1],
                   "latlon": [LAT_MIN, LAT_MAX, LON_MIN, LON_MAX],
                   "lakes": sorted(set(lake_names)),
                   "rivers": sorted(set(river_names))}

    # маршруты — из настоящей геометрии, съ проверкой «по водѣ»
    routes, rstats = build_routes()
    out["routes"] = routes
    out["meta"]["route_stats"] = rstats
    print("маршруты:", {k: len(v["pts"]) for k, v in routes.items()},
          "| км:", rstats["knyaz_km"], "/", rstats["svei_km"])

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    os.makedirs(os.path.dirname(OUT_APP), exist_ok=True)
    with open(OUT_APP, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print("записано:", os.path.basename(OUT), "и", os.path.relpath(OUT_APP, os.path.dirname(OUT)))
    print("ocean:", len(out["ocean"]), "lakes:", len(out["lakes"]), "rivers:", len(out["rivers"]))
    print("озёра:", ", ".join(out["meta"]["lakes"][:30]))
    print("реки:", ", ".join(out["meta"]["rivers"][:40]))
    print("файл:", OUT, os.path.getsize(OUT), "байт")


if __name__ == "__main__":
    main()
