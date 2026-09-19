import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeViewBox, replay, scenarios, startSession, type Session } from '@nevsky/core';
import {
  MAP_CONTENT, areaEllipse, boxesIntersect, clampLabelIntoFrame, fitsInFrame,
  ghostsToDraw, labelBox, labelItemsOf, labelPlacement, layoutFullScene,
  layoutLabels, placesToDraw, zoomOf,
  lastRouteId, loupeWindow, markShapes, rotatedEllipseBox,
  meta, neededLoupe, placeLabel, pointInFrame, project, routeById, showInLoupe, showOnMain,
  textWidth,
  type LabelBox,
  type LabelItem,
  type LabelScene,
} from './map';

const scenario = scenarios[0]!;

describe('маршрут на карте', () => {
  it('пока решений нет — пути тоже нет', () => {
    expect(lastRouteId(startSession(scenario), scenario)).toBeUndefined();
  });

  it('путь берётся из решения, где он был задан', () => {
    // У варианта «выступить немедленно» в контенте указан маршрут дружины
    const session = replay(scenario, ['marchnow']);
    expect(lastRouteId(session, scenario)).toBe('knyaz');
  });

  it('путь не теряется, если следующее решение его не задавало', () => {
    // Иначе карта обнуляла бы путь на каждом шаге, где маршрут не меняется:
    // дружина не телепортируется, и карта не должна это показывать.
    const session: Session = {
      ...startSession(scenario),
      history: [
        {
          eventId: 'neva-vesti', choiceId: 'marchnow', eventTitle: 'Тревожные вести',
          choiceTitle: 'Выступить немедленно', effects: [], canonical: true,
          certainty: 'fact', createdAt: new Date().toISOString(),
        },
        {
          eventId: 'neva-ladoga', choiceId: 'нет-такого-варианта', eventTitle: 'Ладога',
          choiceTitle: '—', effects: [], canonical: false,
          certainty: 'fact', createdAt: new Date().toISOString(),
        },
      ],
    };
    expect(lastRouteId(session, scenario)).toBe('knyaz');
  });

  it('чужое событие в истории не роняет поиск', () => {
    const session: Session = {
      ...startSession(scenario),
      history: [
        {
          eventId: 'событие-которого-нет', choiceId: 'что-то', eventTitle: 'x',
          choiceTitle: 'y', effects: [], canonical: false, certainty: 'fact',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    expect(() => lastRouteId(session, scenario)).not.toThrow();
    expect(lastRouteId(session, scenario)).toBeUndefined();
  });
});

describe('формы знаков', () => {
  it('у каждого рода места своя форма', () => {
    const kinds = ['city', 'fortress', 'battle', 'camp', 'pogost', 'hoard'] as const;
    const shapes = kinds.map((k) => JSON.stringify(markShapes(k, 0, 0, 1)));
    expect(new Set(shapes).size, 'два рода места рисуются одинаково').toBe(kinds.length);
  });

  it('город — круг, погост — кольцо, бой — косой крест', () => {
    expect(markShapes('city', 10, 20, 1)[0]).toMatchObject({ kind: 'circle', cx: 10, cy: 20 });
    expect(markShapes('pogost', 0, 0, 1)[0]!.strokeOnly).toBe(true);
    // Крест — две черты, то есть два подпути в одном path.
    const battle = markShapes('battle', 0, 0, 1)[0]!;
    expect(battle.kind).toBe('path');
    expect(battle.d?.match(/M/g)?.length).toBe(2);
  });

  it('размер знака идёт от увеличения, а не от местности', () => {
    const small = markShapes('city', 0, 0, 1)[0]!.r!;
    const big = markShapes('city', 0, 0, 2)[0]!.r!;
    expect(big / small).toBeCloseTo(2, 5);
  });

  it('знак события крупнее, чем общий', () => {
    const plain = markShapes('city', 0, 0, 1)[0]!.r!;
    const hit = markShapes('city', 0, 0, 1, true)[0]!.r!;
    expect(hit).toBeGreaterThan(plain);
  });
});

describe('подписи', () => {
  it('подпись не ложится на сам знак', () => {
    for (const side of ['r', 'l', 't', 'b', 'rt', 'lt', 'rb', 'lb'] as const) {
      const at = labelPlacement(side, 100, 100, 1);
      const dist = Math.hypot(at.x - 100, at.y - 100);
      expect(dist, `подпись сбоку «${side}» стоит на знаке`).toBeGreaterThan(6);
    }
  });

  it('слева — выключка вправо, справа — влево, сверху и снизу — по центру', () => {
    expect(labelPlacement('l', 0, 0, 1).anchor).toBe('end');
    expect(labelPlacement('r', 0, 0, 1).anchor).toBe('start');
    expect(labelPlacement('t', 0, 0, 1).anchor).toBe('middle');
    expect(labelPlacement('b', 0, 0, 1).anchor).toBe('middle');
  });

  it('без указания сторона берётся по умолчанию, а не теряется', () => {
    expect(labelPlacement(undefined, 0, 0, 1).x).toBeGreaterThan(0);
  });
});

describe('что видно на карте и что во врезке', () => {
  const layers = { show: new Set(['svei-camp', 'novgorod']), ghosts: false };

  it('база видна без указаний контента', () => {
    expect(showOnMain({ id: 'ladoga', base: true }, layers, 5)).toBe(true);
  });

  it('неоткрытый объект не виден, сколько бы ни было решений', () => {
    expect(showOnMain({ id: 'trophies', minZoom: 8 }, layers, 12)).toBe(false);
  });

  it('тесная группа на общем плане уходит во врезку', () => {
    const camp = { id: 'svei-camp', cluster: 'neva-ustye', minZoom: 8 };
    expect(showOnMain(camp, layers, 6), 'показан на общем плане — слипнется').toBe(false);
    expect(showOnMain(camp, layers, 9), 'на увеличении обязан показаться').toBe(true);
    expect(showInLoupe(camp, layers, 'neva-ustye')).toBe(true);
    expect(showInLoupe(camp, layers, 'другая-группа')).toBe(false);
  });

  it('врезка нужна только пока знаки тесны', () => {
    const box = makeViewBox({ lat: 59.6, lon: 30.6, zoom: 6 }, meta, 1.6, project);
    expect(neededLoupe(layers, 6, box)).toBe(true);
    expect(neededLoupe(layers, 9, box), 'на увеличении врезка лишняя').toBe(false);
  });

  it('врезка не показывается, если открывать нечего', () => {
    const box = makeViewBox({ lat: 59.6, lon: 30.6, zoom: 6 }, meta, 1.6, project);
    const пусто = { show: new Set<string>(), ghosts: false };
    expect(neededLoupe(пусто, 6, box)).toBe(false);
  });

  it('окно врезки накрывает все точки устья Невы', () => {
    const win = loupeWindow()!;
    for (const p of MAP_CONTENT.places.filter((x) => x.cluster)) {
      const q = project(p.lon, p.lat);
      expect(q.x, `${p.id} западнее окна`).toBeGreaterThan(win.x);
      expect(q.x, `${p.id} восточнее окна`).toBeLessThan(win.x + win.w);
      expect(q.y, `${p.id} севернее окна`).toBeGreaterThan(win.y);
      expect(q.y, `${p.id} южнее окна`).toBeLessThan(win.y + win.h);
    }
  });
});

describe('маршруты на карте', () => {
  it('путь сторожи — часть пути дружины, а не выдуманная линия', () => {
    const whole = routeById('knyaz-route')!;
    const scout = routeById('scouts-route')!;
    expect(scout.pts.length).toBeLessThan(whole.pts.length);
    expect(scout.pts[0]).toEqual(whole.pts[0]);
    // Каждая точка сторожи обязана лежать на пути дружины.
    for (const p of scout.pts) {
      expect(whole.pts.some((q) => q[0] === p[0] && q[1] === p[1]), `точка ${p} не с пути`).toBe(true);
    }
  });

  it('неизвестного маршрута нет, и это не ошибка', () => {
    expect(routeById('нет-такого')).toBeNull();
  });

  it('путь дружины начинается в Новгороде и кончается у устья Ижоры', () => {
    const r = routeById('knyaz-route')!;
    const first = r.pts[0]!;
    const last = r.pts[r.pts.length - 1]!;
    expect(Math.hypot(first[0] - 31.271, first[1] - 58.521)).toBeLessThan(0.3);
    expect(Math.hypot(last[0] - 30.604, last[1] - 59.808)).toBeLessThan(0.3);
  });
});

describe('подписи не срезаются краем', () => {
  const box = { x: 0, y: 0, w: 100, h: 60 };

  it('ширина подписи растёт с длиной и кеглем', () => {
    expect(textWidth('Новгород', 12, 1)).toBeGreaterThan(textWidth('Псков', 12, 1));
    expect(textWidth('Новгород', 24, 1)).toBeCloseTo(textWidth('Новгород', 12, 1) * 2, 4);
    // Разрядка у подписей земель добавляет ширины — коэффициент другой.
    expect(textWidth('Водь', 12, 1, true)).toBeGreaterThan(textWidth('Водь', 12, 1));
  });

  it('подпись, которой хватает места, остаётся на своей стороне', () => {
    const placed = placeLabel('Псков', 'r', 40, 30, 1, 12, box, { pad: 1 });
    expect(placed).not.toBeNull();
    expect(placed!.flipped).toBe(false);
    expect(placed!.at.anchor).toBe('start');
  });

  it('подпись у правого края переезжает налево, а не режется', () => {
    // Знак у самого края: справа подписи некуда деться.
    const placed = placeLabel('Линданисе', 'r', 99, 30, 1, 12, box, { pad: 1 });
    expect(placed).not.toBeNull();
    expect(placed!.flipped).toBe(true);
    expect(placed!.at.anchor).toBe('end');
    expect(fitsInFrame(labelBox('Линданисе', placed!.at, 12, 1), box, 1)).toBe(true);
  });

  it('подпись, которой не хватает места нигде, не рисуется вовсе', () => {
    const placed = placeLabel('Ливонское ландмейстерство', 'r', 50, 30, 1, 13, box, { pad: 1 });
    expect(placed).toBeNull();
  });

  it('решение о подписи не зависит от того, что нарисовано рядом', () => {
    // Одна и та же подпись при одном и том же кадре решается одинаково:
    // иначе карта «мигала» бы при перерисовке.
    const a = placeLabel('Порхов', 'b', 50, 30, 1, 12, box, { pad: 1 });
    const b = placeLabel('Порхов', 'b', 50, 30, 1, 12, box, { pad: 1 });
    expect(a).toEqual(b);
  });

  it('точка за кадром не подписывается', () => {
    expect(pointInFrame(-5, 30, box)).toBe(false);
    expect(pointInFrame(50, 30, box)).toBe(true);
    expect(pointInFrame(-2, 30, box, 5)).toBe(true);
  });

  it('на финале кампании западные подписи не режутся, а не рисуются', () => {
    // Окно финала: 6748 год, взгляд на весь край. Здесь и резались
    // «Ливонское ландмейстерство» и «Варяжское море».
    const w = makeViewBox({ lat: 59.3, lon: 30.6, zoom: 5 }, meta, 1.6, project);
    for (const id of ['lindanise', 'riga']) {
      const p = MAP_CONTENT.places.find((x) => x.id === id)!;
      const q = project(p.lon, p.lat);
      const placed = placeLabel(p.name, p.labelSide, q.x, q.y, w.w / 758, 12, w, { pad: 1 });
      const рисуется = placed !== null;
      const помещается = placed
        ? fitsInFrame(labelBox(p.name, placed.at, 12, w.w / 758), w, 1)
        : true;
      expect(помещается, `подпись «${p.name}» нарисована и при этом срезана`).toBe(true);
      if (рисуется) expect(pointInFrame(q.x, q.y, w)).toBe(true);
    }
  });
});

describe('подписи областей не гаснут, а сдвигаются', () => {
  const box = { x: 0, y: 0, w: 100, h: 60 };

  // Кадр шириной 100 для этой подписи мал: 23 знака при кегле 10,5 занимают
  // 116 единиц. Берём кадр, в который она влезает, — иначе проверяли бы не то.
  const wide = { x: 0, y: 0, w: 200, h: 60 };
  const ORDA = 'Орда: где — неизвестно';

  it('подпись, упёршаяся в край, сдвигается внутрь кадра', () => {
    expect(textWidth(ORDA, 10.5, 1)).toBeLessThan(wide.w);
    const at = clampLabelIntoFrame(ORDA, 199, 30, 10.5, 1, wide, { pad: 1, maxShift: 80 });
    expect(at).not.toBeNull();
    expect(fitsInFrame(labelBox(ORDA, at!, 10.5, 1), wide, 1)).toBe(true);
    expect(at!.x).toBeLessThan(199);
  });

  it('сдвиг не дальше положенного: иначе подпись уедет от своей области', () => {
    // Сдвинуть нужно почти на 60, а разрешено на 2 — лучше промолчать.
    const at = clampLabelIntoFrame(ORDA, 199, 30, 10.5, 1, wide, { pad: 1, maxShift: 2 });
    expect(at).toBeNull();
  });

  it('подпись не той полосы не рисуется: по высоте не подвинуть', () => {
    expect(clampLabelIntoFrame('Водь', 50, 59, 10.5, 1, box, { pad: 1 })).toBeNull();
  });

  it('слишком длинная подпись не влезает никуда', () => {
    expect(clampLabelIntoFrame('Ливонское ландмейстерство и половина Пскова', 50, 30, 13, 1, box, { pad: 1 })).toBeNull();
  });

  it('подпись, которой хватает места, остаётся на месте', () => {
    const at = clampLabelIntoFrame('Водь', 50, 30, 10.5, 1, box, { pad: 1, maxShift: 5 });
    expect(at!.x).toBeCloseTo(50, 5);
  });

  it('на финале метки «предел знания» остаются на карте', () => {
    // Именно на финале они и нужны, а раньше пропадали: упирались в край
    // и гасились. Подпись области обязана сдвинуться, а не исчезнуть.
    const w = makeViewBox({ lat: 59.3, lon: 30.6, zoom: 5 }, meta, 1.6, project);
    const u = w.w / 758;
    const drawn: string[] = [];
    for (const a of MAP_CONTENT.areas) {
      if (!a.rx || !a.ry) continue;
      const cx = project(a.lon, a.lat).x;
      const cy = project(a.lon, a.lat).y;
      const shift = (project(a.lon, a.lat + a.ry).y - cy) * 0.9 * (a.labelSide === 'above' ? -1 : 1);
      const at = clampLabelIntoFrame(a.label, cx, cy + shift, 10.5, u, w,
        { pad: 1.5 * u, maxShift: w.w * 0.06, maxShiftY: w.h * 0.1 });
      if (at) {
        drawn.push(a.label);
        expect(fitsInFrame(labelBox(a.label, at, 10.5, u), w, 1.5 * u), `«${a.label}» срезана`).toBe(true);
      }
    }
    // Хотя бы метка востока обязана дойти до игрока на финале.
    expect(drawn).toContain('Орда: где — неизвестно');
  });
});

describe('подпись высокой области не выталкивается за кадр', () => {
  const box = { x: 0, y: 0, w: 400, h: 300 };

  it('сдвиг вниз на полуось прижимается к нижнему краю, а не гасит подпись', () => {
    // Так ведёт себя восточная зона: она высокая, и сдвиг на её полуось
    // уводил подпись за кадр. Раньше она просто пропадала.
    const at = clampLabelIntoFrame('Орда: где — неизвестно', 200, 305, 10.5, 1, box,
      { pad: 1, maxShift: 10, maxShiftY: 30 });
    expect(at).not.toBeNull();
    expect(at!.y).toBeLessThan(300);
    expect(fitsInFrame(labelBox('Орда: где — неизвестно', at!, 10.5, 1), box, 1)).toBe(true);
  });

  it('если подпись уехала бы слишком далеко, она молчит', () => {
    const at = clampLabelIntoFrame('Орда: где — неизвестно', 200, 305, 10.5, 1, box,
      { pad: 1, maxShift: 10, maxShiftY: 2 });
    expect(at).toBeNull();
  });

  it('подпись земли по высоте не сдвигается: землю подписывают там, где она стоит', () => {
    expect(clampLabelIntoFrame('Водь', 200, 305, 10.5, 1, box, { pad: 1 })).toBeNull();
    expect(clampLabelIntoFrame('Водь', 200, 150, 10.5, 1, box, { pad: 1 })).not.toBeNull();
  });
});

describe('высота подписи считается от базовой линии', () => {
  it('подпись уходит вверх больше, чем вниз — как и настоящий текст', () => {
    // Ошибка здесь тихая: если считать `y` серединой, решение «влезает или
    // нет» смещается на полвысоты и подписи гаснут без причины.
    const at = { x: 0, y: 100, anchor: 'middle' as const };
    const b = labelBox('Новгород', at, 12, 1);
    expect(100 - b.y1, 'вверх').toBeGreaterThan(b.y2 - 100);
    expect(b.y2 - b.y1).toBeCloseTo(1.26 * 12, 4);
  });

  it('все подписи одного кегля имеют одну высоту', () => {
    const at = { x: 0, y: 0, anchor: 'start' as const };
    const a = labelBox('Псков', at, 12, 1);
    const b = labelBox('Ливонское ландмейстерство', at, 12, 1);
    expect(b.y2 - b.y1).toBeCloseTo(a.y2 - a.y1, 6);
    expect(b.x2 - b.x1).toBeGreaterThan(a.x2 - a.x1);
  });
});

describe('имя области появляется, только если область видна', () => {
  it('поворот пятна учитывается, а не прикидывается на глаз', () => {
    // Вытянутое пятно при повороте СУЖАЕТСЯ по X и растёт по Y — это
    // описывающий прямоугольник, а не сами полуоси. Прикинуть «на глаз»
    // здесь значит либо гасить видимые области, либо рисовать имя к пустоте.
    const straight = rotatedEllipseBox(0, 0, 100, 20, 0);
    expect(straight.x2 - straight.x1).toBeCloseTo(200, 3);
    expect(straight.y2 - straight.y1).toBeCloseTo(40, 3);

    const quarter = rotatedEllipseBox(0, 0, 100, 20, 90);
    expect(quarter.x2 - quarter.x1).toBeCloseTo(40, 3);
    expect(quarter.y2 - quarter.y1).toBeCloseTo(200, 3);

    const turned = rotatedEllipseBox(0, 0, 100, 20, 45);
    expect(turned.x2 - turned.x1).toBeCloseTo(2 * Math.hypot(100 * Math.SQRT1_2, 20 * Math.SQRT1_2), 3);
    expect(turned.x2 - turned.x1).toBeLessThan(200);
    expect(turned.y2 - turned.y1).toBeGreaterThan(40);
  });

  it('у круглого пятна поворот ничего не меняет', () => {
    for (const rot of [0, 17, 45, 90]) {
      const b = rotatedEllipseBox(0, 0, 50, 50, rot);
      expect(b.x2 - b.x1).toBeCloseTo(100, 3);
      expect(b.y2 - b.y1).toBeCloseTo(100, 3);
    }
  });

  it('пересечение прямоугольников считается верно', () => {
    const a = { x1: 0, y1: 0, x2: 10, y2: 10 };
    expect(boxesIntersect(a, { x1: 5, y1: 5, x2: 15, y2: 15 })).toBe(true);
    expect(boxesIntersect(a, { x1: 11, y1: 0, x2: 20, y2: 10 })).toBe(false);
    expect(boxesIntersect(a, { x1: 0, y1: 11, x2: 10, y2: 20 })).toBe(false);
  });

  it('высокая полоса с именем на финале: имя прижато к кадру и не срезано', () => {
    // «Орда» — высокая полоса. Имя сдвигается ниже её середины, но обязано
    // остаться в кадре: раньше оно либо вылезало за край, либо пропадало.
    const w = makeViewBox({ lat: 59.3, lon: 30.6, zoom: 5 }, meta, 1.6, project);
    const u = w.w / 758;
    const frame = { x1: w.x, y1: w.y, x2: w.x + w.w, y2: w.y + w.h };
    const zone = MAP_CONTENT.areas.find((a) => a.id === 'east-threat')!;
    const cx = project(zone.lon, zone.lat).x;
    const cy = project(zone.lon, zone.lat).y;
    const rx = Math.abs(project(zone.lon + zone.rx!, zone.lat).x - cx);
    const ry = Math.abs(project(zone.lon, zone.lat + zone.ry!).y - cy);

    expect(boxesIntersect(rotatedEllipseBox(cx, cy, rx, ry, zone.rot ?? 0), frame)).toBe(true);

    const wantedY = Math.max(w.y + 2 * u, Math.min(w.y + w.h - 2 * u, cy + ry * 0.9));
    const at = clampLabelIntoFrame(zone.label, cx, wantedY, 10.5, u, w,
      { pad: 1.5 * u, maxShift: w.w * 0.06, maxShiftY: w.h * 0.1 });
    expect(at, 'имя видимой области пропало').not.toBeNull();
    expect(fitsInFrame(labelBox(zone.label, at!, 10.5, u), w, 1.5 * u)).toBe(true);
  });

  it('область за кадром имени не получает', () => {
    const w = makeViewBox({ lat: 61.5, lon: 24.0, zoom: 12 }, meta, 1.6, project);
    const frame = { x1: w.x, y1: w.y, x2: w.x + w.w, y2: w.y + w.h };
    const far = MAP_CONTENT.areas.find((a) => a.id === 'east-threat')!;
    const cx = project(far.lon, far.lat).x;
    const cy = project(far.lon, far.lat).y;
    const rx = Math.abs(project(far.lon + far.rx!, far.lat).x - cx);
    const ry = Math.abs(project(far.lon, far.lat + far.ry!).y - cy);
    expect(boxesIntersect(rotatedEllipseBox(cx, cy, rx, ry, 0), frame)).toBe(false);
  });
});

describe('подписи не налезают друг на друга', () => {
  const ASPECT = 1.6;
  const LOUPE_WIDTH = 0.34;
  const SCREEN_WIDTH = 760;

  /** К концу кампании открыто всё — это и есть самый тесный случай. */
  const allLayers = {
    show: new Set(MAP_CONTENT.places.map((p) => p.id)),
    ghosts: true,
  };

  interface Placed {
    id: string;
    text: string;
    box: LabelBox;
    /** контур того, к чему подпись относится: пятно области или её точку */
    zone?: { cx: number; cy: number; rx: number; ry: number; rot: number };
  }

  function sceneFor(event: (typeof scenario.events)[number], inLoupe: boolean) {
    const zoom = zoomOf(event.map?.focus?.zoom);
    const box = inLoupe
      ? loupeWindow()!
      : makeViewBox(event.map?.focus, meta, ASPECT, project);
    const u = inLoupe
      ? box.w / (SCREEN_WIDTH * LOUPE_WIDTH)
      : box.w / SCREEN_WIDTH;
    return {
      box,
      u,
      scene: {
        places: placesToDraw(
          MAP_CONTENT, allLayers, zoom,
          inLoupe ? MAP_CONTENT.loupe?.cluster : undefined,
        ),
        ghosts: ghostsToDraw(MAP_CONTENT, allLayers, inLoupe),
        highlighted: allLayers.show,
        inLoupe,
        box,
      },
    };
  }

  /** Ровно то, что холст рисует: те же места, те же прямоугольники. */
  function placedOf(scene: LabelScene, u: number): Placed[] {
    const layout = layoutFullScene(MAP_CONTENT, scene, u);
    const out: Placed[] = [];
    for (const item of labelItemsOf(scene)) {
      const at = layout.points.get(item.id);
      if (!at) continue;
      out.push({
        id: item.id,
        text: item.text,
        box: labelBox(item.text, at, item.fontSizePx, u, item.spaced ?? false),
      });
    }
    for (const plan of layout.areas.values()) {
      const e = areaEllipse(plan.area);
      out.push({
        id: `area:${plan.area.id}`,
        text: plan.area.label,
        box: labelBox(plan.area.label, plan.at, plan.fontPx, u, plan.spaced),
        zone: e ?? undefined,
      });
    }
    return out;
  }

  function expectNothingOverlaps(placed: Placed[], where: string) {
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(
          boxesIntersect(placed[i]!.box, placed[j]!.box),
          `${where}: «${placed[i]!.text}» налезла на «${placed[j]!.text}»`,
        ).toBe(false);
      }
    }
  }

  it('на каждом событии — и на карте, и во врезке', () => {
    for (const event of scenario.events) {
      for (const inLoupe of [false, true]) {
        const { box, u, scene } = sceneFor(event, inLoupe);
        const placed = placedOf(scene, u);
        const where = `${event.id}, ${inLoupe ? 'врезка' : 'карта'}`;

        expectNothingOverlaps(placed, where);

        // Срезанная краем подпись читается как поломка: «ЛИВОНСКОЕ
        // ЛАНДМЕЙСТЕР». Такой на карте быть не должно.
        for (const p of placed) {
          expect(
            fitsInFrame(p.box, box, 1.5 * u),
            `${where}: подпись «${p.text}» срезана краем`,
          ).toBe(true);
        }
      }
    }
  });

  it('имя области не уезжает со своего пятна', () => {
    for (const event of scenario.events) {
      const { u, scene } = sceneFor(event, false);
      for (const plan of layoutFullScene(MAP_CONTENT, scene, u).areas.values()) {
        const e = areaEllipse(plan.area);
        if (!e) continue;
        // Имя, ушедшее за пятно, — это подпись к другому месту: «Орда»
        // на Новгородской земле.
        const t = (-e.rot * Math.PI) / 180;
        const dx = plan.at.x - e.cx;
        const dy = plan.at.y - e.cy;
        const lx = dx * Math.cos(t) - dy * Math.sin(t);
        const ly = dx * Math.sin(t) + dy * Math.cos(t);
        expect(
          (lx / e.rx) ** 2 + (ly / e.ry) ** 2,
          `${event.id}: имя «${plan.area.label}» вышло за своё пятно`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it('у устья Невы поименованы все пять знаков', () => {
    const event = scenario.events.find((e) => e.id === 'neva-bitva')!;
    const { u, scene } = sceneFor(event, true);
    const placed = placedOf(scene, u);
    const names = placed.map((p) => p.text);
    expect(names).toContain('Невское устье');
    expect(names).toContain('Устье Ижоры');
    expect(names).toContain('Лагерь шведов');
    expect(names).toContain('Ижорский погост');
    expect(names, 'гость из будущего остался без имени').toContain('Санкт-Петербург · осн. 1703');
  });

  it('«Новгородская земля» и «Орда» расходятся, а не ложатся друг на друга', () => {
    // На увеличении 8 эти две подписи сходились — и «Орда: где — неизвестно»
    // стояла при этом у края кадра, вдали от самой Орды.
    const event = scenario.events.find((e) => e.id === 'neva-ladoga')!;
    const { u, scene } = sceneFor(event, false);
    const placed = placedOf(scene, u);
    const land = placed.find((p) => p.text === 'Новгородская земля');
    const horde = placed.find((p) => p.text === 'Орда: где — неизвестно');
    expect(land, 'имя Новгородской земли пропало').toBeDefined();
    expect(horde, 'имя Орды пропало').toBeDefined();
    expect(boxesIntersect(land!.box, horde!.box)).toBe(false);
  });

  it('место, о котором речь в событии, выбирает сторону первым', () => {
    const u = 1;
    const box = { x: 0, y: 0, w: 400, h: 400 };
    const items: LabelItem[] = [
      { id: 'glavnoe', text: 'Невское устье', x: 200, y: 200, preferred: 'r', fontSizePx: 13 },
      { id: 'vtoroe', text: 'Лагерь шведов', x: 200, y: 200, preferred: 'r', fontSizePx: 13 },
    ];
    const at = layoutLabels(items, u, box);
    // Первый в списке получает ровно ту сторону, которую просил.
    expect(at.get('glavnoe')).toEqual(labelPlacement('r', 200, 200, u, 13));
    expect(at.has('vtoroe')).toBe(true);
    expect(at.get('vtoroe')).not.toEqual(at.get('glavnoe'));
    const b1 = labelBox('Невское устье', at.get('glavnoe')!, 13, u);
    const b2 = labelBox('Лагерь шведов', at.get('vtoroe')!, 13, u);
    expect(boxesIntersect(b1, b2)).toBe(false);
  });

  it('второму месту в той же точке сторона уступается, а не навязывается', () => {
    const u = 1;
    const box = { x: 0, y: 0, w: 400, h: 400 };
    const items: LabelItem[] = [
      { id: 'a', text: 'Первое', x: 200, y: 200, preferred: 'r', fontSizePx: 13 },
      { id: 'b', text: 'Второе', x: 200, y: 200, preferred: 'r', fontSizePx: 13 },
    ];
    const at = layoutLabels(items, u, box);
    expect(at.get('a')!.x).toBeGreaterThan(200);
    expect(at.get('b')!.x).not.toBe(at.get('a')!.x);
  });

  it('холст не ставит подписи в обход общей расстановки', () => {
    // Эта проверка сторожит не разметку, а порядок: подписи, поставленные
    // порознь, снова разъедутся — так уже было, когда знаки звали
    // `placeLabel` напрямую, а площадь считалась отдельно.
    const src = readFileSync(resolve(process.cwd(), 'src/components/MapCanvas.tsx'), 'utf8');
    expect(src, 'холст снова зовёт placeLabel в обход расстановки').not.toMatch(/\bplaceLabel\s*\(/);
    expect(src, 'холст снова считает подписи площадей сам').not.toMatch(/\bclampLabelIntoFrame\s*\(/);
    expect(src, 'общая расстановка не используется').toMatch(/\blayoutFullScene\s*\(/);
  });
});
