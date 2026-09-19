/**
 * Проекция карты. Коническая равноугольная Ламберта — та же самая, что в
 * `tools/geo/build_geo.py`. Здесь она нужна не для рисования берегов (те уже
 * спроецированы и лежат готовыми путями), а для точек, которые появляются
 * во время игры: место события, метка, маршрут дружины.
 *
 * Почему это отдельный модуль, а не пара строк в компоненте: проекция и
 * преобразование в пиксели должны совпадать с Python до сотой доли пикселя.
 * Разъедутся — метка места боя уедет от самого места боя, и заметит это не
 * тест, а школьник. Совпадение стережёт `projection.test.ts`, сверяясь с
 * фикстурой, снятой с питоновской реализации.
 *
 * Формулы повторяют Python буква в букву. Не «улучшать»: любая
 * «оптимизация» здесь ломает совпадение с генератором геометрии.
 */

/** Параллели и центральный меридиан. Значения — из build_geo.py. */
export const PROJECTION = {
  /** первая стандартная параллель */
  P1: 57.5,
  /** вторая стандартная параллель */
  P2: 61.5,
  /** параллель начала отсчёта */
  P0: 59.0,
  /** центральный меридиан (восточная долгота) */
  LON0: 30.0,
  /** радиус Земли, км */
  R: 6371.0,
} as const;

/** Допуск совпадения с генератором, в пикселях системы карты. */
export const PROJECTION_TOLERANCE_PX = 0.01;

const DEG = Math.PI / 180;
const t = (phi: number) => Math.tan(Math.PI / 4 + phi / 2);

const phi1 = PROJECTION.P1 * DEG;
const phi2 = PROJECTION.P2 * DEG;

/** Показатель конуса. */
const N = Math.log(Math.cos(phi1) / Math.cos(phi2)) / Math.log(t(phi2) / t(phi1));
/** Множитель радиуса. */
const F = (Math.cos(phi1) * t(phi1) ** N) / N;
/** Радиус на параллели начала отсчёта. */
const RHO0 = F / t(PROJECTION.P0 * DEG) ** N;

export interface KmPoint {
  x: number;
  y: number;
}

/** (долгота, широта) → километры в плоской системе проекции, ось Y вверх. */
export function projectToKm(lon: number, lat: number): KmPoint {
  const lam = (lon - PROJECTION.LON0) * DEG;
  const rho = F / t(lat * DEG) ** N;
  return {
    x: PROJECTION.R * rho * Math.sin(N * lam),
    y: PROJECTION.R * (RHO0 - rho * Math.cos(N * lam)),
  };
}

/** Описание системы координат готовой геометрии — из geo.json. */
export interface GeoMeta {
  w: number;
  h: number;
  /** прямоугольник проекции в километрах: [x0, y0, x1, y1] */
  bbox_proj: [number, number, number, number];
  /** рамка региона в градусах: [latMin, latMax, lonMin, lonMax] */
  latlon: [number, number, number, number];
}

export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * Пересчёт километров в пиксели карты: длинная сторона рамки приводится к 1000,
 * ось Y разворачивается — в SVG она вниз, в проекции вверх.
 */
export function makePixelScale(meta: GeoMeta) {
  const [x0, y0, x1, y1] = meta.bbox_proj;
  const scale = 1000 / Math.max(x1 - x0, y1 - y0);
  return {
    scale,
    /** (долгота, широта) → пиксели карты. */
    toPx(lon: number, lat: number): PixelPoint {
      const km = projectToKm(lon, lat);
      return { x: (km.x - x0) * scale, y: (y1 - km.y) * scale };
    },
  };
}

/** Готовая функция пересчёта для конкретной системы координат карты. */
export type Projector = (lon: number, lat: number) => PixelPoint;

export function makeProjector(meta: GeoMeta): Projector {
  return makePixelScale(meta).toPx;
}

/** Путь SVG по списку точек маршрута. */
export function routePath(project: Projector, pts: Array<[number, number]>): string {
  return pts
    .map(([lon, lat], i) => {
      const p = project(lon, lat);
      return `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
}
