import type { GeoMeta } from './projection';

/**
 * Видимое окно карты.
 *
 * В демо `focus` и `zoom` лежали в контенте, но нигде не использовались.
 * Значит шкалу увеличения задаём здесь впервые — и лучше чистым кодом с
 * тестом, чем подбором на глаз внутри компонента.
 *
 * Окно задаётся РАССТОЯНИЕМ, а не долей листа. Первая попытка мерила окно
 * в пикселях листа, и получалось, что при zoom 6 в кадр не попадает
 * Новгород — а в том же событии речь идёт и о нём, и об устье Невы.
 * Поэтому: высота окна = VIEW_KM_AT_ZOOM_1 / zoom километров. Проверено на
 * настоящих координатах кампании: при zoom 6 окно выходит около 300 км по
 * высоте, и оба места помещаются с запасом.
 */
export const VIEW_KM_AT_ZOOM_1 = 1800;

export const MIN_ZOOM = 2;
export const MAX_ZOOM = 16;

export interface MapFocus {
  lat: number;
  lon: number;
  zoom?: number;
}

export interface MapWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Пикселей листа на километр — из рамки региона, которая задана в километрах. */
export function pxPerKm(meta: GeoMeta): number {
  const [x0, y0, x1, y1] = meta.bbox_proj;
  return 1000 / Math.max(x1 - x0, y1 - y0);
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/** Прямоугольник нужных пропорций, вписанный в лист и отцентрованный. */
function fitAspect(meta: GeoMeta, aspect: number): MapWindow {
  let w: number;
  let h: number;
  if (meta.w / meta.h > aspect) {
    h = meta.h;
    w = h * aspect;
  } else {
    w = meta.w;
    h = w / aspect;
  }
  return { x: (meta.w - w) / 2, y: (meta.h - h) / 2, w, h };
}

/**
 * Окно вокруг точки события.
 *
 * Пропорции контейнера сохраняются строго: иначе карта «поедет» относительно
 * рамки. Окно не выходит за лист — у края оно прижимается к краю, а не
 * показывает пустоту вокруг.
 */
export function makeViewBox(
  focus: MapFocus | undefined,
  meta: GeoMeta,
  aspect: number,
  project: (lon: number, lat: number) => { x: number; y: number },
): MapWindow {
  if (!focus || !Number.isFinite(focus.lat) || !Number.isFinite(focus.lon)) {
    return fitAspect(meta, aspect);
  }

  const scale = pxPerKm(meta);
  let h = (VIEW_KM_AT_ZOOM_1 / clampZoom(focus.zoom ?? MIN_ZOOM)) * scale;
  let w = h * aspect;

  if (w > meta.w) {
    w = meta.w;
    h = w / aspect;
  }
  if (h > meta.h) {
    h = meta.h;
    w = h * aspect;
  }

  const center = project(focus.lon, focus.lat);
  return {
    x: clamp(center.x - w / 2, 0, Math.max(0, meta.w - w)),
    y: clamp(center.y - h / 2, 0, Math.max(0, meta.h - h)),
    w,
    h,
  };
}

/** Строка для атрибута viewBox у SVG. */
export function viewBoxAttr(box: MapWindow): string {
  return `${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.w.toFixed(1)} ${box.h.toFixed(1)}`;
}
