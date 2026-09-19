import {
  geography,
  makeProjector,
  mapContents,
  routePoints,
  layersOf,
  type GeoMeta,
  type LabelSide,
  type LayerState,
  type MapArea,
  type MapContent,
  type MapGhost,
  type MapPlace,
  type MapRouteDef,
  type MapWindow,
  type PlaceKind,
  type Projector,
  type Scenario,
  type Session,
} from '@nevsky/core';

/** Объекты карты. Пока один набор — на один сценарий. */
export const MAP_CONTENT: MapContent = mapContents[0]!;

export const meta = geography.meta as unknown as GeoMeta;

/**
 * Проекция. Константы считаются один раз на модуль: `makeProjector`
 * вызывается из `useMemo`, а не на каждый кадр.
 */
export const project: Projector = makeProjector(meta);

/**
 * Маршрут, которым игрок уже прошёл.
 *
 * Берём из последнего решения, где маршрут вообще был задан: не у каждого
 * выбора он есть, а пустой ответ должен означать «пути не было», а не
 * «путь сбросился». Нужно, чтобы карта была функцией от состояния, а не
 * картинкой к тексту.
 */
export function lastRouteId(session: Session, scenario: Scenario): string | undefined {
  for (let i = session.history.length - 1; i >= 0; i -= 1) {
    const record = session.history[i];
    if (!record) continue;
    const event = scenario.events.find((e) => e.id === record.eventId);
    const choice = event?.choices.find((c) => c.id === record.choiceId);
    const route = choice?.map?.route;
    if (route) return route;
  }
  return undefined;
}

/** Слои, открытые по ходу кампании. */
export function visibleLayers(session: Session, scenario: Scenario): LayerState {
  return layersOf(scenario, session);
}

/** Увеличение, с которым событие смотрит на карту. */
export function zoomOf(focusZoom?: number): number {
  return focusZoom ?? 2;
}

/* ——— знаки ——— */

export interface MarkShape {
  kind: 'circle' | 'poly' | 'path';
  cx?: number;
  cy?: number;
  r?: number;
  points?: string;
  d?: string;
  /** только обводка: погост показан кольцом, а не залитым кругом */
  strokeOnly?: boolean;
}

/**
 * Форма знака по роду места.
 *
 * Формы не украшение: они различают род места там, где подпись не помещается.
 * Город — круг, крепость — ромб, бой — косой крест, стан — треугольник,
 * погост — кольцо, добыча — квадрат.
 *
 * Знак масштабируется по `u` (условных единиц листа на пиксель экрана),
 * поэтому на любом увеличении он одного размера на экране — как на настоящей
 * карте, где значок не растёт вместе с местностью.
 */
export function markShapes(
  kind: PlaceKind,
  x: number,
  y: number,
  u: number,
  emphasis = false,
): MarkShape[] {
  const k = emphasis ? 1.22 : 1;
  switch (kind) {
    case 'city':
      return [{ kind: 'circle', cx: x, cy: y, r: 4.6 * u * k }];
    case 'fortress': {
      const a = 5.9 * u * k;
      return [{ kind: 'poly', points: `${x},${y - a} ${x + a},${y} ${x},${y + a} ${x - a},${y}` }];
    }
    case 'battle': {
      const a = 5.6 * u * k;
      return [{
        kind: 'path',
        d: `M${x - a} ${y - a} L${x + a} ${y + a} M${x - a} ${y + a} L${x + a} ${y - a}`,
      }];
    }
    case 'camp': {
      const w = 5.4 * u * k;
      const h = 9 * u * k;
      return [{
        kind: 'poly',
        points: `${x},${y - h * 0.6} ${x + w},${y + h * 0.4} ${x - w},${y + h * 0.4}`,
      }];
    }
    case 'pogost':
      return [{ kind: 'circle', cx: x, cy: y, r: 5 * u * k, strokeOnly: true }];
    case 'hoard': {
      const a = 3.9 * u * k;
      return [{
        kind: 'poly',
        points: `${x - a},${y - a} ${x + a},${y - a} ${x + a},${y + a} ${x - a},${y + a}`,
      }];
    }
    default:
      return [{ kind: 'circle', cx: x, cy: y, r: 4.6 * u * k }];
  }
}

export interface LabelPlacement {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/** Куда ставить подпись относительно знака, чтобы она не легла на него. */
export function labelPlacement(
  side: LabelSide | undefined,
  x: number,
  y: number,
  u: number,
  fontSizePx = 12,
  offsetMul = 1,
): LabelPlacement {
  const gap = 9 * u * Math.max(1, offsetMul);
  const lift = 3.6 * u;
  const half = (fontSizePx / 2) * u;
  switch (side) {
    case 'l':  return { x: x - gap, y: y + lift, anchor: 'end' };
    case 't':  return { x, y: y - gap - half, anchor: 'middle' };
    case 'b':  return { x, y: y + gap + half, anchor: 'middle' };
    case 'rt': return { x: x + gap, y: y - gap, anchor: 'start' };
    case 'lt': return { x: x - gap, y: y - gap, anchor: 'end' };
    case 'rb': return { x: x + gap, y: y + gap + half, anchor: 'start' };
    case 'lb': return { x: x - gap, y: y + gap + half, anchor: 'end' };
    case 'r':
    default:   return { x: x + gap, y: y + lift, anchor: 'start' };
  }
}

/**
 * Ширина подписи в единицах листа.
 *
 * Коэффициент не выдуманный: он измерен на настоящем шрифте в браузере —
 * самая широкая подпись места дала 0,465 кегля на знак, подписи земель с
 * разрядкой — 0,617. Взято с запасом. Числа эти нужны, потому что решение
 * «влезает подпись в кадр или её срежет» должно приниматься до рисования,
 * а не после, — и проверяться тестом.
 */
export const GLYPH_EM = 0.48;
export const GLYPH_EM_SPACED = 0.63;

/**
 * Куда текст уходит от своей базовой линии.
 *
 * Тоже измерено, а не взято из общих соображений: у этого шрифта подъём
 * доходит до 0,846 кегля, спуск — до 0,385. Это важно, потому что в SVG
 * `y` у текста — базовая линия, а не середина: считать её серединой значит
 * ошибаться на полвысоты и гасить подписи, которые на самом деле влезают.
 */
export const ASCENT_EM = 0.86;
export const DESCENT_EM = 0.40;

export function textWidth(text: string, fontSizePx: number, u: number, spaced = false): number {
  const em = spaced ? GLYPH_EM_SPACED : GLYPH_EM;
  return em * fontSizePx * [...text].length * u;
}

export interface LabelBox {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/** Прямоугольник подписи — с учётом выключки и того, что `y` — базовая линия. */
export function labelBox(
  text: string,
  at: LabelPlacement,
  fontSizePx: number,
  u: number,
  spaced = false,
): LabelBox {
  const w = textWidth(text, fontSizePx, u, spaced);
  const x1 = at.anchor === 'start' ? at.x : at.anchor === 'end' ? at.x - w : at.x - w / 2;
  return {
    x1,
    x2: x1 + w,
    y1: at.y - ASCENT_EM * fontSizePx * u,
    y2: at.y + DESCENT_EM * fontSizePx * u,
  };
}

/** Влезает ли прямоугольник в кадр целиком. */
export function fitsInFrame(b: LabelBox, box: MapWindow, pad = 0): boolean {
  return b.x1 >= box.x + pad && b.x2 <= box.x + box.w - pad
      && b.y1 >= box.y + pad && b.y2 <= box.y + box.h - pad;
}

/** Точка вообще в кадре. Знак за кадром подписывать нечего. */
export function pointInFrame(x: number, y: number, box: MapWindow, margin = 0): boolean {
  return x >= box.x - margin && x <= box.x + box.w + margin
      && y >= box.y - margin && y <= box.y + box.h + margin;
}

/** Сторона, с которой подпись встанет, не вылезая за кадр. */
const FLIP: Record<LabelSide, LabelSide> = {
  r: 'l', l: 'r', rt: 'lt', lt: 'rt', rb: 'lb', lb: 'rb', t: 'b', b: 't',
};

/**
 * Поставить подпись так, чтобы её не срезало краем.
 *
 * Срезанная подпись — это не мелочь: она читается как «ЛИВОНСКОЕ ЛАНДМЕЙСТЕР»
 * и выглядит поломкой. Поэтому подпись сперва пробуется на своём месте, потом
 * на противоположном, а если не влезает нигде — не рисуется вовсе: знак
 * остаётся, имя молчит.
 */
export function placeLabel(
  text: string,
  side: LabelSide | undefined,
  x: number,
  y: number,
  u: number,
  fontSizePx: number,
  box: MapWindow,
  options: { offsetMul?: number; spaced?: boolean; pad?: number } = {},
): { at: LabelPlacement; flipped: boolean } | null {
  const { offsetMul = 1, spaced = false, pad = 0 } = options;
  const first = side ?? 'r';

  for (const candidate of [first, FLIP[first]]) {
    const at = labelPlacement(candidate, x, y, u, fontSizePx, offsetMul);
    if (fitsInFrame(labelBox(text, at, fontSizePx, u, spaced), box, pad)) {
      return { at, flipped: candidate !== first };
    }
  }
  return null;
}

/**
 * Подпись области: подвинуть внутрь кадра, а не гасить.
 *
 * У точки подпись можно и убрать — точка либо есть, либо её нет. У области
 * так нельзя: она подписывает площадь, и «Орда: где — неизвестно» на финале
 * кампании нужнее всего. Поэтому имя области сдвигается внутрь кадра — но не
 * дальше чем на заданную долю ширины: иначе подпись уехала бы от самой
 * области и стала бы враньём.
 */
export function clampLabelIntoFrame(
  text: string,
  x: number,
  y: number,
  fontSizePx: number,
  u: number,
  box: MapWindow,
  options: { spaced?: boolean; pad?: number; maxShift?: number; maxShiftY?: number } = {},
): LabelPlacement | null {
  const { spaced = false, pad = 0, maxShift = Infinity, maxShiftY = 0 } = options;
  const w = textWidth(text, fontSizePx, u, spaced);
  const up = ASCENT_EM * fontSizePx * u;
  const down = DESCENT_EM * fontSizePx * u;

  if (w > box.w - 2 * pad || up + down > box.h - 2 * pad) return null;

  const cx = Math.max(box.x + pad + w / 2, Math.min(box.x + box.w - pad - w / 2, x));
  if (Math.abs(cx - x) > maxShift) return null;

  // По высоте подвинуть можно, но не всяко: если подпись уехала бы далеко от
  // своей области, это уже подпись к другому месту. Для подписей земель
  // сдвиг по высоте запрещён вовсе — земля подписана там, где стоит.
  const cy = Math.max(box.y + pad + up, Math.min(box.y + box.h - pad - down, y));
  if (Math.abs(cy - y) > maxShiftY) return null;

  return { x: cx, y: cy, anchor: 'middle' };
}

/* ——— расстановка подписей ——— */

export interface LabelItem {
  id: string;
  text: string;
  x: number;
  y: number;
  /** сторона, с которой подпись хотелось бы поставить */
  preferred: LabelSide;
  fontSizePx: number;
  offsetMul?: number;
  /** разрядка: у имён земель она шире */
  spaced?: boolean;
}

/** Порядок перебора сторон: сначала желаемая, потом остальные. */
const SIDE_ORDER: LabelSide[] = ['r', 'l', 't', 'b', 'rt', 'lt', 'rb', 'lb'];

/**
 * Расстановка подписей по очереди, с оглядкой на уже поставленные.
 *
 * Подбирать сторону руками бессмысленно: у устья Невы пять мест, и на каждом
 * увеличении они ложатся по-разному. Настоящая картография решает это
 * перебором — подпись пробуется с разных сторон, ставится в первое свободное
 * место, а если свободного нет, то молчит. Знак при этом остаётся на карте:
 * лучше место без имени, чем два имени друг на друге.
 *
 * Порядок входа — это приоритет. Кто идёт первым, тому и лучшее место,
 * поэтому важные места надо подавать раньше.
 */
export function layoutLabels(
  items: LabelItem[],
  u: number,
  box: MapWindow,
  options: { pad?: number; gap?: number } = {},
): Map<string, LabelPlacement> {
  const { pad = 0, gap = 0.6 * u } = options;
  const taken: LabelBox[] = [];
  const out = new Map<string, LabelPlacement>();

  for (const item of items) {
    const candidates: LabelSide[] = [];
    for (const side of [item.preferred, FLIP[item.preferred], ...SIDE_ORDER]) {
      if (!candidates.includes(side)) candidates.push(side);
    }

    for (const side of candidates) {
      const at = labelPlacement(side, item.x, item.y, u, item.fontSizePx, item.offsetMul ?? 1);
      const b = labelBox(item.text, at, item.fontSizePx, u, item.spaced ?? false);
      if (!fitsInFrame(b, box, pad)) continue;

      const room = {
        x1: b.x1 - gap, x2: b.x2 + gap, y1: b.y1 - gap, y2: b.y2 + gap,
      };
      if (taken.some((t) => boxesIntersect(room, t))) continue;

      out.set(item.id, at);
      taken.push(room);
      break;
    }
  }

  return out;
}

/* ——— сборка подписей холста ——— */

/** Точка-догадка: «где ещё могло быть» вместе с тем, как её назвать. */
export interface AltPoint {
  lon: number;
  lat: number;
  label: string;
}

/** Всё, что надобно знать, чтобы расставить подписи на одном холсте. */
export interface LabelScene {
  places: MapPlace[];
  ghosts: MapGhost[];
  /** места, о которых идёт речь в событии: их подписи встают первыми */
  highlighted: ReadonlySet<string>;
  alternatives?: readonly AltPoint[];
  /** холст рисует врезку, а не основную карту */
  inLoupe: boolean;
  box: MapWindow;
  ghostFontPx?: number;
  altFontPx?: number;
}

/** Кегль подписи места: о котором речь — крупнее. */
export const EMPHASIS_FONT_PX = 13;
export const PLAIN_FONT_PX = 12;

/**
 * Подписи одного холста в порядке приоритета.
 *
 * Отдельной функцией, а не разметкой внутри компонента, потому что именно
 * здесь решается, что с чем может столкнуться, — и проверять это надо без
 * браузера. В устье Невы на общем плане четыре знака на десяток километров,
 * и подбирать им стороны руками бессмысленно: они ложатся по-разному на
 * каждом увеличении.
 */
export function labelItemsOf(scene: LabelScene): LabelItem[] {
  const {
    places, ghosts, highlighted, alternatives = [], inLoupe, box,
    ghostFontPx = 10.5, altFontPx = 11,
  } = scene;

  const items: LabelItem[] = [];
  const ordered = [...places].sort(
    (a, b) => Number(highlighted.has(b.id)) - Number(highlighted.has(a.id)),
  );

  for (const p of ordered) {
    const q = project(p.lon, p.lat);
    if (!pointInFrame(q.x, q.y, box)) continue;
    items.push({
      id: `p:${p.id}`,
      text: p.name,
      x: q.x,
      y: q.y,
      preferred: p.labelSide ?? 'r',
      fontSizePx: highlighted.has(p.id) ? EMPHASIS_FONT_PX : PLAIN_FONT_PX,
      offsetMul: p.labelOffset ?? 1,
    });
  }

  for (const g of ghosts) {
    const q = project(g.lon, g.lat);
    if (!pointInFrame(q.x, q.y, box)) continue;
    items.push({
      id: `g:${g.id}`,
      text: `${g.name} · ${g.year}`,
      x: q.x,
      y: q.y,
      preferred: inLoupe ? 't' : 'r',
      fontSizePx: ghostFontPx,
    });
  }

  // Во врезке догадок нет: зарубка «где ещё могло быть» стоит вне тесной
  // группы, а врезка показывает только саму группу.
  if (!inLoupe) {
    alternatives.forEach((alt, i) => {
      const q = project(alt.lon, alt.lat);
      if (!pointInFrame(q.x, q.y, box)) return;
      items.push({
        id: `a:${i}`,
        text: alt.label,
        x: q.x,
        y: q.y,
        preferred: 'rt',
        fontSizePx: altFontPx,
      });
    });
  }

  return items;
}

/** Готовые места подписей холста: расстановка по очереди, с оглядкой на занятое. */
export function layoutScene(
  scene: LabelScene,
  u: number,
): Map<string, LabelPlacement> {
  return layoutLabels(labelItemsOf(scene), u, scene.box, { pad: 1.5 * u });
}

/* ——— подписи земель и областей ——— */

/** Кегли подписей площадей. Земля крупнее: её имя относится к целой стране. */
export const AREA_FONT_PX = 13;
export const ZONE_FONT_PX = 10.5;

/**
 * Эллипс области в единицах листа.
 *
 * Углы проекции считаются, а не берутся на глаз: коническая проекция сжимает
 * градус долготы и градус широты по-разному, и пятно, заданное полуосями
 * в градусах, на листе оказывается не кругом.
 */
export function areaEllipse(
  area: MapArea,
): { cx: number; cy: number; rx: number; ry: number; rot: number } | null {
  if (!area.rx || !area.ry) return null;
  const c = project(area.lon, area.lat);
  const px = project(area.lon + area.rx, area.lat);
  const py = project(area.lon, area.lat + area.ry);
  return {
    cx: c.x,
    cy: c.y,
    rx: Math.abs(px.x - c.x),
    ry: Math.abs(py.y - c.y),
    rot: area.rot ?? 0,
  };
}

/** Подпись площади: земля подписывается в точке, область — внутри пятна. */
export interface AreaLabelPlan {
  area: MapArea;
  fontPx: number;
  /** разрядка: у имён земель она шире */
  spaced: boolean;
  at: LabelPlacement;
}

/**
 * Где имя области вправе стоять.
 *
 * Имя ставится внутри самого пятна, а не там, куда его пустит край кадра.
 * Разница не косметическая: у Орды пятно огромное, и его имя, прижатое к краю
 * кадра, оказывалось далеко от самой Орды — а на финале кампании «где — 
 * неизвестно» важнее всего. Направление берётся из данных (`labelSide`), но
 * если с него места нет, имя обходит пятно по кругу, пока не найдёт свободное.
 *
 * Доли считаются от полуосей, поэтому точка заведомо внутри пятна: сумма
 * квадратов долей здесь меньше единицы.
 */
const ZONE_RING = 0.78;

function zoneDirections(preferAbove: boolean): Array<[number, number]> {
  const near = preferAbove ? -90 : 90;
  const far = -near;
  const dirs: number[] = [];
  for (const step of [0, 30, 60, 90, 120, 150]) {
    dirs.push(near + step, near - step);
  }
  dirs.push(far, 0, 180);
  return dirs.map((deg) => {
    const t = (deg * Math.PI) / 180;
    return [ZONE_RING * Math.cos(t), ZONE_RING * Math.sin(t)];
  });
}

/** Точка внутри эллипса: сумма квадратов долей не больше единицы. */
function insideEllipse(
  x: number,
  y: number,
  e: { cx: number; cy: number; rx: number; ry: number; rot: number },
  tolerance = 1,
): boolean {
  const t = (-e.rot * Math.PI) / 180;
  const dx = x - e.cx;
  const dy = y - e.cy;
  const lx = dx * Math.cos(t) - dy * Math.sin(t);
  const ly = dx * Math.sin(t) + dy * Math.cos(t);
  return (lx / e.rx) ** 2 + (ly / e.ry) ** 2 <= tolerance;
}

/**
 * Подписи земель и областей — с оглядкой на уже поставленное.
 *
 * Земли идут первыми: их имя относится к целой стране и стоит там, где стоит,
 * а сдвинуться может на строку, не больше, — дальше это была бы подпись
 * к другому месту. Области идут вторыми и обходят занятое внутри своего пятна.
 * Кто не нашёл места нигде — остаётся без имени: пятно со штриховкой видно
 * и молча.
 */
export function layoutAreaLabels(
  content: MapContent,
  scene: { box: MapWindow; inLoupe: boolean },
  u: number,
  taken: readonly LabelBox[],
): AreaLabelPlan[] {
  const { box, inLoupe } = scene;
  const out: AreaLabelPlan[] = [];
  // Во врезке показан кусок в десяток километров: «Шведское королевство»
  // в кадре не помещается по смыслу, а не только по ширине.
  if (inLoupe) return out;

  const pad = 1.5 * u;
  const gap = 0.6 * u;
  const busy = [...taken];

  /** Свободно ли место под подпись: влезает в кадр и ни на кого не легла. */
  const roomFor = (
    text: string,
    at: LabelPlacement,
    fontPx: number,
    spaced: boolean,
  ): LabelBox | null => {
    const b = labelBox(text, at, fontPx, u, spaced);
    if (!fitsInFrame(b, box, pad)) return null;
    const room = {
      x1: b.x1 - gap, x2: b.x2 + gap, y1: b.y1 - gap, y2: b.y2 + gap,
    };
    return busy.some((t) => boxesIntersect(room, t)) ? null : room;
  };

  const line = AREA_FONT_PX * 1.35 * u;

  for (const a of content.areas.filter((x) => !x.rx && !x.ry)) {
    const q = project(a.lon, a.lat);
    // Земля за кадром не подписывается: имя земли, которой не видно, — это
    // подпись к пустоте.
    if (!pointInFrame(q.x, q.y, box)) continue;

    // Если имя упирается в край — оно сдвигается внутрь, но не дальше двух
    // процентов ширины: дальше это уже подпись к другому месту.
    const base = clampLabelIntoFrame(a.label, q.x, q.y, AREA_FONT_PX, u, box, {
      spaced: true, pad, maxShift: box.w * 0.02,
    });
    if (!base) continue;

    for (const dy of [0, -line, line]) {
      const at = { ...base, y: base.y + dy };
      const room = roomFor(a.label, at, AREA_FONT_PX, true);
      if (!room) continue;
      out.push({ area: a, fontPx: AREA_FONT_PX, spaced: true, at });
      busy.push(room);
      break;
    }
  }

  const frame = { x1: box.x, y1: box.y, x2: box.x + box.w, y2: box.y + box.h };

  for (const a of content.areas.filter((x) => x.rx && x.ry)) {
    const e = areaEllipse(a);
    if (!e) continue;

    // Имя к пятну, которого не видно, — это подпись к пустоте. Пятно, видное
    // одним краем, подписывать можно: край и есть то, что показано.
    if (!boxesIntersect(rotatedEllipseBox(e.cx, e.cy, e.rx, e.ry, e.rot), frame)) continue;

    const t = (e.rot * Math.PI) / 180;
    for (const [kx, ky] of zoneDirections(a.labelSide === 'above')) {
      const dx = kx * e.rx;
      const dy = ky * e.ry;
      const at = clampLabelIntoFrame(
        a.label,
        e.cx + dx * Math.cos(t) - dy * Math.sin(t),
        e.cy + dx * Math.sin(t) + dy * Math.cos(t),
        ZONE_FONT_PX, u, box,
        // Сдвиг здесь не ограничивается долей кадра: имя области вправе стоять
        // в любом месте своего пятна, и это не враньё. Враньём было бы выйти
        // за пятно — за этим следит проверка ниже.
        { pad, maxShift: Infinity, maxShiftY: Infinity },
      );
      if (!at) continue;
      if (!insideEllipse(at.x, at.y, e)) continue;
      const room = roomFor(a.label, at, ZONE_FONT_PX, false);
      if (!room) continue;
      out.push({ area: a, fontPx: ZONE_FONT_PX, spaced: false, at });
      busy.push(room);
      break;
    }
  }

  return out;
}

/** Всё, что холст рисует подписями: точки, земли и области — за один проход. */
export interface FullSceneLayout {
  points: Map<string, LabelPlacement>;
  areas: Map<string, AreaLabelPlan>;
}

/**
 * Расстановка всех подписей холста.
 *
 * Точки и площади считаются вместе, потому что налезть друг на друга они могут
 * одинаково: «Новгородская земля» и «Орда: где — неизвестно» стоят по соседству
 * и на увеличении 8 сходятся. Считать их порознь значит чинить одно и ломать
 * другое.
 */
export function layoutFullScene(
  content: MapContent,
  scene: LabelScene,
  u: number,
): FullSceneLayout {
  const points = layoutScene(scene, u);
  const taken: LabelBox[] = [];
  const gap = 0.6 * u;

  for (const item of labelItemsOf(scene)) {
    const at = points.get(item.id);
    if (!at) continue;
    const b = labelBox(item.text, at, item.fontSizePx, u, item.spaced ?? false);
    taken.push({ x1: b.x1 - gap, x2: b.x2 + gap, y1: b.y1 - gap, y2: b.y2 + gap });
  }

  const areas = new Map<string, AreaLabelPlan>();
  for (const plan of layoutAreaLabels(content, scene, u, taken)) {
    areas.set(plan.area.id, plan);
  }

  return { points, areas };
}

/* ——— что на карте видно ——— */

/**
 * Прямоугольник, в который вписано пятно области.
 *
 * Считается с учётом поворота: у повёрнутого эллипса стороны описывающего
 * прямоугольника не равны полуосям, и брать их «на глаз» значит гасить
 * области, которые на самом деле видны.
 */
export function rotatedEllipseBox(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotDeg = 0,
): LabelBox {
  const t = (rotDeg * Math.PI) / 180;
  const hw = Math.hypot(rx * Math.cos(t), ry * Math.sin(t));
  const hh = Math.hypot(rx * Math.sin(t), ry * Math.cos(t));
  return { x1: cx - hw, x2: cx + hw, y1: cy - hh, y2: cy + hh };
}

export function boxesIntersect(a: LabelBox, b: LabelBox): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
}

export interface Showable {
  id: string;
  base?: boolean;
  cluster?: string;
  minZoom?: number;
}

/**
 * С какого увеличения тесная группа расходится и рисуется прямо на карте.
 * Одно число на два места — здесь и в `neededLoupe`: разъедутся — получится
 * либо дырка (не видно нигде), либо двойной рисунок.
 */
export const CLUSTER_MIN_ZOOM = 8;

/** Показывать ли объект на основной карте. */
export function showOnMain(el: Showable, layers: LayerState, zoom: number): boolean {
  const minZoom = el.minZoom ?? (el.cluster ? CLUSTER_MIN_ZOOM : 2);
  if (zoom < minZoom) return false;
  if (el.base) return true;
  return layers.show.has(el.id);
}

/** Показывать ли объект во врезке-лупе. */
export function showInLoupe(
  el: { id: string; cluster?: string },
  layers: LayerState,
  cluster: string,
): boolean {
  if (el.cluster !== cluster) return false;
  return layers.show.has(el.id);
}

/**
 * Нужна ли врезка.
 *
 * Теснота — свойство не вёрстки, а места: устье Невы занимает на общем плане
 * десяток километров, и четыре знака там сливаются в пятно. На увеличении от 8
 * они расходятся сами, и лупа становится не нужна.
 */
export function neededLoupe(
  layers: LayerState,
  zoom: number,
  box: MapWindow,
  content: MapContent = MAP_CONTENT,
  proj: Projector = project,
): boolean {
  if (!content.loupe || zoom >= CLUSTER_MIN_ZOOM) return false;

  const cluster = content.loupe.cluster;
  const ids = new Set(layers.show);
  const anyVisible =
    content.places.some((p) => p.cluster === cluster && ids.has(p.id)) ||
    (layers.ghosts && content.ghosts.some((g) => g.cluster === cluster));
  if (!anyVisible) return false;

  const c = proj(content.loupe.lon, content.loupe.lat);
  return (
    c.x >= box.x - box.w * 0.25 && c.x <= box.x + box.w * 1.25 &&
    c.y >= box.y - box.h * 0.25 && c.y <= box.y + box.h * 1.25
  );
}

/** Окно врезки: границы заданы в градусах, потому что это свойство места. */
export function loupeWindow(
  content: MapContent = MAP_CONTENT,
  proj: Projector = project,
): MapWindow | null {
  const l = content.loupe;
  if (!l) return null;
  const a = proj(l.lon - l.dLon, l.lat + l.dLat);
  const b = proj(l.lon + l.dLon, l.lat - l.dLat);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

/** Готовый путь маршрута — с учётом того, что известна лишь часть дороги. */
export function routeById(
  id: string,
  content: MapContent = MAP_CONTENT,
): { def: MapRouteDef; pts: Array<[number, number]> } | null {
  const def = content.routes.find((r) => r.id === id);
  if (!def) return null;
  const geo = (geography.routes as Record<string, { pts: Array<[number, number]> } | undefined>)[def.from];
  if (!geo) return null;
  return { def, pts: routePoints(geo.pts, def) };
}

/** Области, которые надо нарисовать. */
export function areasToDraw(
  content: MapContent,
  layers: LayerState,
  zoom: number,
): MapArea[] {
  return content.areas.filter((a) => showOnMain(a, layers, zoom));
}

/**
 * «Гости из будущего». Без врезки — только те, что не в тесной группе:
 * иначе Петербург встал бы поверх устья Ижоры.
 */
export function ghostsToDraw(
  content: MapContent,
  layers: LayerState,
  inLoupe: boolean,
): MapGhost[] {
  if (!layers.ghosts) return [];
  return content.ghosts.filter((g) => (inLoupe ? Boolean(g.cluster) : !g.cluster));
}

export function placesToDraw(
  content: MapContent,
  layers: LayerState,
  zoom: number,
  cluster?: string,
): MapPlace[] {
  return content.places.filter((p) =>
    cluster ? showInLoupe(p, layers, cluster) : showOnMain(p, layers, zoom),
  );
}
