import type { MapRouteDef } from '../types/map';

/**
 * Точки маршрута с учётом того, что путь известен не целиком.
 *
 * Геометрия приходит из geography.json целой линией — она собрана по руслам рек.
 * Но у сторожи своего описания хода нет: она шла той же водой, что и дружина,
 * только вперёд. Поэтому маршрут умеет отдавать часть себя (`portion`) и
 * разворачиваться (`reverse`), а не обрастать второй выдуманной линией.
 */
export function routePoints(
  pts: Array<[number, number]>,
  def: Pick<MapRouteDef, 'portion' | 'reverse'>,
): Array<[number, number]> {
  if (pts.length < 2) return [...pts];

  let out = pts;

  if (def.portion) {
    const [from, to] = def.portion;
    // Индекс считаем по «внутренним» отрезкам, иначе последняя точка теряется:
    // доля 0..1 относится к пути, а в массиве точек на одну меньше.
    const last = pts.length - 1;
    const i = Math.max(0, Math.min(last, Math.round(from * last)));
    const j = Math.max(0, Math.min(last, Math.round(to * last)));
    out = pts.slice(i, j + 1);
  }

  if (def.reverse) out = [...out].reverse();

  return out;
}
