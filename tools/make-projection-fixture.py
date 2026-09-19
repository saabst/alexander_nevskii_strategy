#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Снимает фикстуру проекции с питоновской реализации — той самой, что строит
геометрию карты. Нужна затем, чтобы тест сверял TypeScript с Python, а не
сам с собой.

Запуск из корня проекта:
    python3 tools/make-projection-fixture.py

Если менялись константы проекции или рамка региона в tools/geo/build_geo.py —
фикстуру надо пересобрать и убедиться, что тесты остались зелёными.
"""
import importlib.util
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO_DIR = os.path.join(ROOT, "tools", "geo")
sys.path.insert(0, GEO_DIR)

# Импортируем генератор: у него есть защита __main__, побочных эффектов нет.
spec = importlib.util.spec_from_file_location("build_geo", os.path.join(GEO_DIR, "build_geo.py"))
build_geo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_geo)

GEO = json.load(open(os.path.join(GEO_DIR, "geo.json"), encoding="utf-8"))
META = GEO["meta"]
X0, Y0, X1, Y1 = META["bbox_proj"]
SCALE = 1000.0 / max(X1 - X0, Y1 - Y0)


def to_px(lon, lat):
    """То же преобразование, что в шаблоне карты."""
    x, y = build_geo.proj(lon, lat)
    return [(x - X0) * SCALE, (Y1 - y) * SCALE]


LAT_MIN, LAT_MAX, LON_MIN, LON_MAX = META["latlon"]

points = []


def add(name, lon, lat):
    px, py = to_px(lon, lat)
    points.append({
        "name": name,
        "lon": lon,
        "lat": lat,
        "x": round(px, 6),
        "y": round(py, 6),
    })


# 1. Углы рамки региона — сразу видно, вписалась ли проекция в лист.
add("угол: юго-запад", LON_MIN, LAT_MIN)
add("угол: северо-запад", LON_MIN, LAT_MAX)
add("угол: юго-восток", LON_MAX, LAT_MIN)
add("угол: северо-восток", LON_MAX, LAT_MAX)

# 2. Точки, которые встречаются в игре: по ним метки и маршруты.
add("Новгород", 31.271, 58.521)
add("Ладога", 32.298, 60.002)
add("устье Ижоры", 30.604, 59.808)
add("устье Невы", 30.28, 59.9)
add("Копорье", 29.03, 59.71)

# 3. Сетка по всему региону — чтобы совпадение проверялось не в трёх местах.
for i in range(6):
    for j in range(5):
        lon = LON_MIN + (LON_MAX - LON_MIN) * i / 5
        lat = LAT_MIN + (LAT_MAX - LAT_MIN) * j / 4
        add(f"сетка {i}/{j}", round(lon, 4), round(lat, 4))

out = {
    "источник": "tools/geo/build_geo.py, функция proj + преобразование из шаблона карты",
    "constants": {
        "P1": build_geo.P1,
        "P2": build_geo.P2,
        "P0": build_geo.P0,
        "LON0": build_geo.LON0,
        "R": build_geo.R,
        "n": build_geo._n,
        "F": build_geo._F,
        "rho0": build_geo._rho0,
    },
    "meta": {"w": META["w"], "h": META["h"], "bbox_proj": META["bbox_proj"], "latlon": META["latlon"]},
    "scale": SCALE,
    "tolerance": 0.01,
    "points": points,
}

dst = os.path.join(ROOT, "core", "src", "map", "projection.fixture.json")
os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
    f.write("\n")

print(f"точек: {len(points)}  →  {os.path.relpath(dst, ROOT)}")
print(f"масштаб: {SCALE:.6f} px на км")
print(f"рамка в километрах: {[round(v, 3) for v in META['bbox_proj']]}")
print(f"углы рамки в пикселях: {points[0]['x']:.2f},{points[0]['y']:.2f} … {points[3]['x']:.2f},{points[3]['y']:.2f}")
