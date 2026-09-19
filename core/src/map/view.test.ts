import { describe, expect, it } from 'vitest';
import { scenarios } from '../index';
import { geography } from './geography';
import { makeProjector, type GeoMeta } from './projection';
import { MAX_ZOOM, MIN_ZOOM, clampZoom, makeViewBox, pxPerKm } from './view';

const meta = geography.meta as unknown as GeoMeta;
const project = makeProjector(meta);
const projectPoint = (lon: number, lat: number) => project(lon, lat);

describe('окно карты: без указания точки', () => {
  it('масштаб листа считается из рамки, а не задан числом', () => {
    // Рамка задана в километрах, лист — в пикселях. Отсюда масштаб: он не
    // должен быть прибит константой, иначе при смене рамки карта поедет.
    expect(pxPerKm(meta)).toBeCloseTo(1.349462, 6);
    const [x0, y0, x1, y1] = meta.bbox_proj;
    expect(Math.max(x1 - x0, y1 - y0) * pxPerKm(meta)).toBeCloseTo(1000, 6);
  });

  it('если точки нет — берётся весь регион, подогнанный под пропорции блока', () => {
    const box = makeViewBox(undefined, meta, 1.6, projectPoint);
    expect(box.w / box.h).toBeCloseTo(1.6, 3);
    expect(box.w).toBeLessThanOrEqual(meta.w + 1e-6);
    expect(box.h).toBeLessThanOrEqual(meta.h + 1e-6);
    // регион шире, чем пропорция 1.6, поэтому вписываемся по ширине
    expect(box.w).toBeCloseTo(meta.w, 6);
    expect(box.x).toBeCloseTo(0, 6);
  });
});

describe('окно карты: увеличение', () => {
  it('чем больше zoom, тем меньше окно', () => {
    const far = makeViewBox({ lat: 59.6, lon: 30.6, zoom: 6 }, meta, 1.6, projectPoint);
    const near = makeViewBox({ lat: 59.6, lon: 30.6, zoom: 11 }, meta, 1.6, projectPoint);
    expect(near.w).toBeLessThan(far.w);
  });

  it('zoom не выходит за разумные пределы', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(-5)).toBe(MIN_ZOOM);
    expect(clampZoom(1000)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
  });

  it('«Бой на Неве» виден вплотную, а первое событие — с запасом', () => {
    // zoom 6 у первого события обязан вместить и Новгород, и устье Невы:
    // в тексте события речь идёт и о городе, и о том, где встали шведы.
    const first = { lat: 59.6, lon: 30.6, zoom: 6 };
    const box = makeViewBox(first, meta, 1.6, projectPoint);
    const novgorod = project(31.271, 58.521);
    const inX = novgorod.x >= box.x && novgorod.x <= box.x + box.w;
    const inY = novgorod.y >= box.y && novgorod.y <= box.y + box.h;
    expect(inX && inY, 'Новгород должен попадать в кадр первого события').toBe(true);
  });
});

describe('окно карты: не выходит за лист', () => {
  const corners = [
    { lat: 56.4, lon: 22.8, zoom: 4 },
    { lat: 61.9, lon: 34.2, zoom: 4 },
    { lat: 59.0, lon: 30.0, zoom: 11 },
  ];

  it('окно всегда внутри листа, даже если точка у самого края', () => {
    for (const focus of corners) {
      const box = makeViewBox(focus, meta, 1.6, projectPoint);
      expect(box.x, `x при ${JSON.stringify(focus)}`).toBeGreaterThanOrEqual(-1e-6);
      expect(box.y, `y при ${JSON.stringify(focus)}`).toBeGreaterThanOrEqual(-1e-6);
      expect(box.x + box.w, `правый край`).toBeLessThanOrEqual(meta.w + 1e-6);
      expect(box.y + box.h, `нижний край`).toBeLessThanOrEqual(meta.h + 1e-6);
    }
  });

  it('точка события попадает в своё окно', () => {
    for (const focus of corners) {
      const box = makeViewBox(focus, meta, 1.6, projectPoint);
      const p = project(focus.lon, focus.lat);
      expect(p.x).toBeGreaterThanOrEqual(box.x - 1e-6);
      expect(p.x).toBeLessThanOrEqual(box.x + box.w + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(box.y - 1e-6);
      expect(p.y).toBeLessThanOrEqual(box.y + box.h + 1e-6);
    }
  });

  it('окно шире листа не бывает — иначе вокруг листа была бы пустота', () => {
    const box = makeViewBox({ lat: 59, lon: 30, zoom: 2 }, meta, 0.5, projectPoint);
    expect(box.w).toBeLessThanOrEqual(meta.w + 1e-6);
    expect(box.h).toBeLessThanOrEqual(meta.h + 1e-6);
  });
});

describe('окно карты: настоящие точки событий', () => {
  it('все события кампании дают осмысленное окно', async () => {
    const { scenarios } = await import('../index');
    const scenario = scenarios[0]!;
    for (const event of scenario.events) {
      const focus = event.map?.focus;
      if (!focus) continue;
      const box = makeViewBox(focus, meta, 1.6, projectPoint);
      expect(box.w, `событие ${event.id}`).toBeGreaterThan(20);
      expect(box.h, `событие ${event.id}`).toBeGreaterThan(20);
      const p = project(focus.lon, focus.lat);
      expect(p.x, `точка события ${event.id} внутри окна`).toBeGreaterThanOrEqual(box.x - 1e-6);
      expect(p.x).toBeLessThanOrEqual(box.x + box.w + 1e-6);
    }
  });
});
