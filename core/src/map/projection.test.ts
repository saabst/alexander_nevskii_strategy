import { describe, expect, it } from 'vitest';
import fixture from './projection.fixture.json';
import {
  PROJECTION, PROJECTION_TOLERANCE_PX,
  makeProjector, makePixelScale, projectToKm, routePath,
  type GeoMeta,
} from './projection';

/**
 * Страж совпадения проекции с генератором геометрии.
 *
 * Фикстура снята не «на глаз», а прямо с питоновской реализации: скрипт
 * `tools/make-projection-fixture.py` вызывает tools/geo/build_geo.py и записывает
 * результат. Смысл — если проекции разойдутся, метка места боя уедет от
 * берега, а маршрут пойдёт по суше. Заметит это не тест, а школьник.
 *
 * Если тест упал — не подгоняйте допуск. Либо в TypeScript завели новую
 * формулу (её надо вернуть к питоновской), либо пересобрали фикстуру после
 * правки генератора (тогда это осознанное решение, и его надо записать).
 */

const meta = fixture.meta as unknown as GeoMeta;

describe('проекция: константы совпадают с генератором', () => {
  it('параллели, меридиан и радиус — те же числа', () => {
    expect(PROJECTION.P1).toBeCloseTo(fixture.constants.P1, 10);
    expect(PROJECTION.P2).toBeCloseTo(fixture.constants.P2, 10);
    expect(PROJECTION.P0).toBeCloseTo(fixture.constants.P0, 10);
    expect(PROJECTION.LON0).toBeCloseTo(fixture.constants.LON0, 10);
    expect(PROJECTION.R).toBeCloseTo(fixture.constants.R, 6);
  });

  it('рамка региона та же, что заложена в геометрию', () => {
    expect(meta.latlon).toEqual(fixture.meta.latlon);
    expect(meta.bbox_proj).toEqual(fixture.meta.bbox_proj);
  });
});

describe('проекция: сходится с Python', () => {
  const project = makeProjector(meta);

  it(`все ${fixture.points.length} контрольных точек совпадают до ${PROJECTION_TOLERANCE_PX} px`, () => {
    const misses: string[] = [];
    for (const point of fixture.points) {
      const got = project(point.lon, point.lat);
      const dx = Math.abs(got.x - point.x);
      const dy = Math.abs(got.y - point.y);
      if (dx > PROJECTION_TOLERANCE_PX || dy > PROJECTION_TOLERANCE_PX) {
        misses.push(`${point.name}: смещение ${dx.toFixed(4)} / ${dy.toFixed(4)} px`);
      }
    }
    expect(misses).toEqual([]);
  });

  it('углы рамки, заданные в градусах, попадают в лист, а не за его край', () => {
    const scale = makePixelScale(meta);
    const [latMin, latMax, lonMin, lonMax] = meta.latlon;
    const corners: Array<[number, number]> = [
      [lonMin, latMin], [lonMin, latMax], [lonMax, latMin], [lonMax, latMax],
    ];
    for (const [lon, lat] of corners) {
      const p = scale.toPx(lon, lat);
      expect(p.x, `долгота ${lon}`).toBeGreaterThanOrEqual(-1);
      expect(p.y, `широта ${lat}`).toBeGreaterThanOrEqual(-1);
      expect(p.x, `долгота ${lon}`).toBeLessThanOrEqual(meta.w + 1);
      expect(p.y, `широта ${lat}`).toBeLessThanOrEqual(meta.h + 1);
    }
  });

  it('длинная сторона рамки приведена ровно к 1000 px — лист не «плавает»', () => {
    const [x0, y0, x1, y1] = meta.bbox_proj;
    expect(Math.max(x1 - x0, y1 - y0) * makePixelScale(meta).scale).toBeCloseTo(1000, 6);
  });
});

describe('проекция: свойства, не зависящие от генератора', () => {
  it('север выше юга — ось Y развёрнута как надо для SVG', () => {
    const project = makeProjector(meta);
    expect(project(30.0, 61.5).y).toBeLessThan(project(30.0, 56.5).y);
  });

  it('восток правее запада', () => {
    const project = makeProjector(meta);
    expect(project(33.5, 59.0).x).toBeGreaterThan(project(23.5, 59.0).x);
  });

  it('на центральном меридиане проекция не смещается вбок', () => {
    // Ось конуса проходит через LON0: там x в километрах должен быть нулём.
    expect(projectToKm(PROJECTION.LON0, PROJECTION.P0).x).toBeCloseTo(0, 6);
  });

  it('точка вне рамки региона не улетает в бесконечность', () => {
    const p = makeProjector(meta)(0, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});

describe('маршрут', () => {
  it('первая точка — «M», остальные «L», координаты округлены до 0,1', () => {
    const project = makeProjector(meta);
    const d = routePath(project, [[31.271, 58.521], [32.298, 60.002], [30.604, 59.808]]);
    const parts = d.split(' ');
    expect(parts).toHaveLength(3);
    expect(parts[0]!.startsWith('M')).toBe(true);
    expect(parts[1]!.startsWith('L')).toBe(true);
    expect(parts[2]!.startsWith('L')).toBe(true);
    for (const part of parts) {
      expect(part.slice(1)).toMatch(/^-?\d+\.\d,-?\d+\.\d$/);
    }
  });

  it('пустой маршрут не превращается в мусор', () => {
    expect(routePath(makeProjector(meta), [])).toBe('');
  });
});
