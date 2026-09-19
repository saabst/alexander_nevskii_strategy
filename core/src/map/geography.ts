import raw from './geography.json';
import type { GeoMeta } from './projection';

/**
 * Геометрия карты.
 *
 * Берега, озёра и реки уже спроецированы и лежат готовыми путями SVG: их
 * считает `tools/geo/build_geo.py` из Natural Earth 1:10m (public domain). В
 * браузере ничего не пересчитывается — только точки, которые появляются
 * во время игры (место события, метка, маршрут), идут через `makeProjector`.
 *
 * Источник правды — генератор. Правка `geography.json` руками будет
 * затёрта при следующей пересборке геометрии.
 */

export interface GeoFeature {
  /** путь SVG в системе координат 0..w / 0..h */
  d: string;
  name?: string;
  scalerank?: number;
}

export interface GeoRoute {
  id: string;
  label: string;
  /** точки маршрута в градусах: [долгота, широта] */
  pts: Array<[number, number]>;
}

export interface Geography {
  ocean: string[];
  lakes: GeoFeature[];
  rivers: GeoFeature[];
  routes: Record<string, GeoRoute>;
  meta: GeoMeta & {
    /** названия озёр, попавших на карту */
    lakes: string[];
    /** названия рек, попавших на карту */
    rivers: string[];
    route_stats: {
      knyaz_pts: number;
      svei_pts: number;
      problems: string[];
      knyaz_km: number;
      svei_km: number;
    };
  };
}

export const geography = raw as unknown as Geography;
