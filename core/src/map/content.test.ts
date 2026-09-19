import { describe, it, expect } from 'vitest';
import rawScenario from '../content/scenarios/neva-1240.json';
import rawMap from '../content/map/neva-1240.map.json';
import type { MapContent } from '../types/map';
import type { Scenario, Session } from '../types/scenario';
import { validateMapContent } from '../validation/map-schema';
import { geography } from './geography';
import {
  NO_LAYERS, applyDirective, indexMap, isVisible, layersOf, missingLayers,
  referencedLayerIds, referencedRouteIds, withGhosts,
} from './layers';
import { routePoints } from './routes';
import { applyChoice, canShowChoice, getCurrentEvent, startSession } from '../engine';

const scenario = rawScenario as unknown as Scenario;
const map = rawMap as unknown as MapContent;

/**
 * Пройти кампанию, выбирая по подсказке.
 *
 * Нужно потому, что карта — функция от хода игры: проверять накопление слоёв
 * на выдуманном состоянии бессмысленно, а на настоящем прохождении — видно,
 * что игрок увидит на самом деле.
 */
function walk(pick: (ids: string[]) => string): { session: Session; visited: string[] } {
  let session = startSession(scenario);
  const visited: string[] = [];
  let guard = 0;

  while (session.status === 'active' && guard < 60) {
    guard += 1;
    const event = getCurrentEvent(session, scenario);
    if (!event) break;
    visited.push(event.id);
    const allowed = event.choices.filter((c) => canShowChoice(session, c));
    const pool = allowed.length > 0 ? allowed : event.choices;
    session = applyChoice(session, scenario, pick(pool.map((c) => c.id))).session;
  }

  return { session, visited };
}

describe('объекты карты', () => {
  it('проходят схему проверки', () => {
    const { ok, issues } = validateMapContent(rawMap);
    if (!ok) console.error(issues);
    expect(issues).toEqual([]);
  });

  it('ни один слой из контента не потерян', () => {
    // Тот самый страж: контент зовёт слои по именам, и если имя не совпало,
    // игрок не увидит ничего — и молча. Пусть падает тест.
    const missing = missingLayers(scenario, map);
    expect(missing, `нет на карте: ${missing.join(', ')}`).toEqual([]);
  });

  it('каждый маршрут контента есть в геометрии', () => {
    const known = Object.keys(geography.routes);
    for (const id of referencedRouteIds(scenario)) {
      expect(known, `маршрут «${id}» не собран в geography.json`).toContain(id);
    }
  });

  it('нет объектов-сирот: всё, что не база, открывается из контента', () => {
    // Обратная сторона стража: объект, на который никто не ссылается, никогда
    // не появится на карте. Это мёртвые данные, и лучше узнать о них сразу.
    const index = indexMap(map);
    const named = new Set(referencedLayerIds(scenario));
    const orphans: string[] = [];

    for (const p of map.places) if (!p.base && !named.has(p.id)) orphans.push(`место ${p.id}`);
    for (const a of map.areas) if (!a.base && !named.has(a.id)) orphans.push(`область ${a.id}`);
    for (const r of map.routes) if (!named.has(r.id)) orphans.push(`маршрут ${r.id}`);
    // «гости из будущего» живут под отдельным тумблером и в show не называются.

    expect(orphans, `никогда не появятся: ${orphans.join(', ')}`).toEqual([]);
    expect(index.all.size).toBeGreaterThan(0);
  });

  it('у каждого места и области есть пояснение и источник', () => {
    for (const p of map.places) {
      expect(p.note, `место ${p.id}`).toBeTruthy();
      expect(p.source, `место ${p.id}`).toBeTruthy();
    }
    for (const a of map.areas) {
      expect(a.note, `область ${a.id}`).toBeTruthy();
      expect(a.source, `область ${a.id}`).toBeTruthy();
    }
  });

  it('у «гостей из будущего» год основания виден рядом с именем', () => {
    for (const g of map.ghosts) {
      expect(g.year, `гость ${g.id}`).toMatch(/осн\.\s*\d{4}/);
    }
  });

  it('все объекты попадают в лист карты', () => {
    const [lat0, lat1, lon0, lon1] = geography.meta.latlon;
    for (const p of [...map.places, ...map.ghosts]) {
      expect(p.lat, `${p.id} по широте`).toBeGreaterThanOrEqual(lat0 - 1);
      expect(p.lat, `${p.id} по широте`).toBeLessThanOrEqual(lat1 + 1);
      expect(p.lon, `${p.id} по долготе`).toBeGreaterThanOrEqual(lon0 - 1);
      expect(p.lon, `${p.id} по долготе`).toBeLessThanOrEqual(lon1 + 1);
    }
  });
});

describe('слои как функция от хода игры', () => {
  it('на входе в первое событие карта уже знает своё место', () => {
    const session = startSession(scenario);
    const layers = layersOf(scenario, session);
    expect(isVisible(layers, 'novgorod')).toBe(true);
    expect(isVisible(layers, 'neva-mouth')).toBe(true);
    expect(isVisible(layers, 'svei-camp')).toBe(false);
  });

  it('разведка открывает путь сторожи', () => {
    const { session } = walk((ids) => (ids.includes('sendscouts') ? 'sendscouts' : ids[0]!));
    const layers = layersOf(scenario, session);
    expect(isVisible(layers, 'scouts-route')).toBe(true);
  });

  it('к финалу открыто всё, что игрок успел узнать', () => {
    const { session, visited } = walk((ids) => ids[0]!);
    expect(session.status).toBe('finished');
    expect(visited.length).toBeGreaterThan(5);

    const layers = layersOf(scenario, session);
    // То, что открывалось по дороге, не пропадает: карта помнит.
    for (const id of ['novgorod', 'neva-mouth', 'svei-camp', 'battle-site', 'knyaz-route']) {
      expect(isVisible(layers, id), `к финалу потерялся слой ${id}`).toBe(true);
    }
  });

  it('new: show добавляет, hide убирает', () => {
    const a = applyDirective(NO_LAYERS, { show: ['x', 'y'] });
    expect([...a.show].sort()).toEqual(['x', 'y']);
    const b = applyDirective(a, { hide: ['x'] });
    expect([...b.show]).toEqual(['y']);
    // Исходное состояние не тронуто: директивы — не мутация.
    expect([...a.show].sort()).toEqual(['x', 'y']);
  });

  it('пустая директива возвращает то же состояние, а не копию', () => {
    const a = applyDirective(NO_LAYERS, {});
    expect(a).toBe(NO_LAYERS);
    expect(applyDirective(NO_LAYERS, null)).toBe(NO_LAYERS);
  });

  it('«чего ещё нет» включается отдельно от знаний о 1240 годе', () => {
    const off = withGhosts(NO_LAYERS, false);
    expect(off.ghosts).toBe(false);
    const on = withGhosts(off, true);
    expect(on.ghosts).toBe(true);
    // Повторное включение не плодит новые объекты состояния.
    expect(withGhosts(on, true)).toBe(on);
  });

  it('слои не зависят от порядка повторного применения', () => {
    const once = applyDirective(NO_LAYERS, { show: ['a', 'b'] });
    const twice = applyDirective(once, { show: ['a', 'b'] });
    expect([...twice.show].sort()).toEqual(['a', 'b']);
  });
});

describe('маршруты, известные лишь частью', () => {
  const pts: Array<[number, number]> = [
    [31.28, 58.52], [31.4, 58.9], [31.6, 59.4], [31.9, 59.85], [30.6, 59.808],
  ];

  it('целый маршрут не режется', () => {
    expect(routePoints(pts, {})).toHaveLength(pts.length);
  });

  it('доля пути оставляет начало и не съедает последнюю точку', () => {
    const half = routePoints(pts, { portion: [0, 0.5] });
    expect(half[0]).toEqual(pts[0]);
    expect(half.length).toBeGreaterThan(1);
    expect(half.length).toBeLessThan(pts.length);
  });

  it('доля до конца отдаёт весь маршрут', () => {
    expect(routePoints(pts, { portion: [0, 1] })).toHaveLength(pts.length);
  });

  it('обратный ход разворачивает те же точки, а не берёт другие', () => {
    const back = routePoints(pts, { reverse: true });
    expect(back).toHaveLength(pts.length);
    expect(back[0]).toEqual(pts[pts.length - 1]);
    expect([...back].sort()).toEqual([...pts].sort());
  });

  it('маршрут из одной точки не ломает рисование', () => {
    expect(routePoints([[30, 59]], {})).toEqual([[30, 59]]);
  });
});
