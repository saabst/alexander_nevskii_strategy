import type {
  LayerState, MapContent, MapPlace, MapArea, MapGhost, MapRouteDef,
} from '../types/map';
import type { MapDirective, Scenario, Session } from '../types/scenario';

/**
 * Что открыто на карте.
 *
 * В демо этого механизма не было вовсе: карта рисовала все объекты сразу и
 * всегда. Контент при этом ссылался на слои — значит ссылки вели в пустоту.
 *
 * Здесь правило простое и без чудес: `show` добавляет, `hide` убирает,
 * накопленное живёт до конца прохождения. Так карта становится функцией от
 * хода игры: прошли разведку — появился путь сторожи; нашли лагерь — появился
 * лагерь. К концу видно всё, что вы успели узнать, и это правильно: итог
 * кампании и есть карта вашего знания.
 */

export const NO_LAYERS: LayerState = { show: new Set<string>(), ghosts: false };

/** Применить одну директиву к состоянию. Функция чистая — её можно проверять тестом. */
export function applyDirective(
  state: LayerState,
  directive?: MapDirective | null,
): LayerState {
  if (!directive) return state;
  const add = directive.show ?? [];
  const remove = directive.hide ?? [];
  if (add.length === 0 && remove.length === 0) return state;

  const show = new Set(state.show);
  for (const id of add) show.add(id);
  for (const id of remove) show.delete(id);
  return { ...state, show };
}

export function isVisible(state: LayerState, id: string): boolean {
  return state.show.has(id);
}

/** Включить или выключить слой «чего ещё нет». */
export function withGhosts(state: LayerState, on: boolean): LayerState {
  return state.ghosts === on ? state : { ...state, ghosts: on };
}

/**
 * Слои по всей прожитой кампании.
 *
 * Директивы применяются в том порядке, в каком игрок их встречал: сначала
 * директива события, потом — выбранного в нём варианта. Директива текущего
 * события добавляется последней, иначе на входе в событие карта ещё
 * показывала бы прошлый шаг.
 */
export function layersOf(scenario: Scenario, session: Session): LayerState {
  let state = NO_LAYERS;

  for (const record of session.history) {
    const event = scenario.events.find((e) => e.id === record.eventId);
    if (event) state = applyDirective(state, event.map);
    const choice = event?.choices.find((c) => c.id === record.choiceId);
    if (choice) state = applyDirective(state, choice.map);
  }

  const current = scenario.events.find((e) => e.id === session.currentEventId);
  if (current) state = applyDirective(state, current.map);

  return state;
}

/**
 * Всё, что вообще названо в контенте.
 *
 * Нужно тесту-стражу: если контент зовёт слой, которого нет в данных, игрок
 * не увидит ничего, и молча. Пусть лучше падает тест с именем потерянного
 * слоя — такую ошибку иначе не поймать глазами.
 */
export function referencedLayerIds(scenario: Scenario): string[] {
  const ids = new Set<string>();
  const take = (d?: MapDirective | null) => {
    for (const id of d?.show ?? []) ids.add(id);
    for (const id of d?.hide ?? []) ids.add(id);
  };
  for (const event of scenario.events) {
    take(event.map);
    for (const choice of event.choices) take(choice.map);
  }
  return [...ids].sort();
}

/** id маршрутов, названные в директивах (пространство geography.routes). */
export function referencedRouteIds(scenario: Scenario): string[] {
  const ids = new Set<string>();
  for (const event of scenario.events) {
    if (event.map?.route) ids.add(event.map.route);
    for (const choice of event.choices) {
      if (choice.map?.route) ids.add(choice.map.route);
    }
  }
  return [...ids].sort();
}

export interface MapIndex {
  places: Map<string, MapPlace>;
  areas: Map<string, MapArea>;
  ghosts: Map<string, MapGhost>;
  routes: Map<string, MapRouteDef>;
  all: Set<string>;
}

/** Быстрый доступ по id: рисование спрашивает «этот слой открыт?» сотни раз. */
export function indexMap(content: MapContent): MapIndex {
  const places = new Map(content.places.map((p) => [p.id, p]));
  const areas = new Map(content.areas.map((a) => [a.id, a]));
  const ghosts = new Map(content.ghosts.map((g) => [g.id, g]));
  const routes = new Map(content.routes.map((r) => [r.id, r]));
  const all = new Set<string>([...places.keys(), ...areas.keys(), ...ghosts.keys(), ...routes.keys()]);
  return { places, areas, ghosts, routes, all };
}

/** Имена слоёв из контента, которых нет в данных карты. */
export function missingLayers(scenario: Scenario, content: MapContent): string[] {
  const index = indexMap(content);
  return referencedLayerIds(scenario).filter((id) => !index.all.has(id));
}
