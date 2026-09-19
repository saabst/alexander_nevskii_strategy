import { useMemo, type CSSProperties } from 'react';
import {
  geography,
  pxPerKm,
  viewBoxAttr,
  type Certainty,
  type GeoPoint,
  type LayerState,
  type MapWindow,
} from '@nevsky/core';
import {
  EMPHASIS_FONT_PX,
  MAP_CONTENT,
  PLAIN_FONT_PX,
  areaEllipse,
  areasToDraw,
  ghostsToDraw,
  layoutFullScene,
  markShapes,
  meta,
  placesToDraw,
  pointInFrame,
  project,
  routeById,
  type AltPoint,
} from '../lib/map';

/**
 * Холст карты.
 *
 * Один и тот же холст рисует и основную карту, и врезку: лупа — это не вторая
 * карта, а тот же взгляд с более близкого расстояния. Разница только в окне
 * и в том, какие знаки в него попадают.
 *
 * Знаки и подписи не масштабируются вместе с местностью: `u` — сколько
 * условных единиц листа приходится на пиксель экрана, и все размеры считаются
 * через неё. Иначе на увеличении 5 подписи были бы неразличимы, а на 10 —
 * во весь экран.
 */

const MAP = {
  ocean: '#ded4b4',
  water: '#d3c8a6',
  coast: '#5b4a33',
  river: '#7a6a52',
  land: '#6b5a41',
  zone: '#8a6a1f',
  ghost: '#8f8471',
} as const;

const CERT_COLOR: Record<Certainty, string> = {
  fact: 'var(--color-fact)',
  recon: 'var(--color-recon)',
  legend: 'var(--color-legend)',
  guess: 'var(--color-guess)',
};

/**
 * Пустой список по умолчанию.
 *
 * Константа, а не литерал `[]`: литерал в списке зависимостей `useMemo`
 * родится заново на каждый кадр и отменит запоминание расстановки.
 */
const NO_ALTERNATIVES: AltPoint[] = [];

export interface MapCanvasProps {
  box: MapWindow;
  /** условных единиц листа на пиксель экрана */
  u: number;
  layers: LayerState;
  zoom: number;
  /** задан — рисуется врезка: только тесная группа */
  cluster?: string;
  /** маршрут, которым игрок уже прошёл (только основная карта) */
  routeId?: string;
  /** место самого события: у половины событий его нет среди объектов карты */
  location?: GeoPoint;
  pulse?: GeoPoint[];
  alternatives?: AltPoint[];
  uncertaintyKm?: number;
  /** уникальный суффикс для id внутри SVG: холстов на странице два */
  uid: string;
  aspect: number;
  className?: string;
  style?: CSSProperties;
}

export default function MapCanvas({
  box, u, layers, zoom, cluster, routeId, location, pulse = [], alternatives = NO_ALTERNATIVES,
  uncertaintyKm = 0, uid, aspect, className = '', style,
}: MapCanvasProps) {
  const inLoupe = Boolean(cluster);
  const areas = areasToDraw(MAP_CONTENT, layers, zoom);
  const places = placesToDraw(MAP_CONTENT, layers, zoom, cluster);
  const ghosts = ghostsToDraw(MAP_CONTENT, layers, inLoupe);
  const shown = new Set(layers.show);

  // Маршруты: те, что открыты контентом, плюс пройденный дружиной.
  const routeIds = new Set<string>([...shown].filter((id) => routeById(id)));
  if (!inLoupe && routeId) routeIds.add(`route:${routeId}`);

  // Кегли в пикселях экрана, а не в единицах листа: размеры знаков и подписей
  // не должны ехать вместе с увеличением.
  const ghostFontPx = 10.5;
  const altFontPx = 11;

  /**
   * Расстановка всех подписей холста — и точек, и площадей.
   *
   * Порядок входа — приоритет: места, о которых идёт речь в событии, встают
   * первыми и получают лучшие места; за ними «гости» и догадки; площади —
   * последними, обходя уже занятое. Кто не влез нигде — остаётся знаком без
   * имени: два имени друг на друге хуже, чем место без имени.
   */
  const layout = useMemo(() => layoutFullScene(MAP_CONTENT, {
    places, ghosts, highlighted: shown, alternatives, inLoupe, box,
    ghostFontPx, altFontPx,
  }, u), [
    places, ghosts, shown, alternatives, inLoupe, box, u,
    altFontPx, ghostFontPx,
  ]);
  const labelLayout = layout.points;
  const areaLayout = layout.areas;

  return (
    <svg
      viewBox={viewBoxAttr(box)}
      className={`block h-auto w-full ${className}`}
      style={{ aspectRatio: String(aspect), ...style }}
      role="img"
    >
      <defs>
        <pattern id={`hatch-${uid}`} width={7 * u} height={7 * u} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={7 * u} stroke={MAP.zone} strokeWidth={1.1} opacity={0.5} />
        </pattern>
      </defs>

      {/* Море и озёра */}
      {geography.ocean.map((d, i) => <path key={`o${i}`} d={d} fill={MAP.ocean} />)}
      {geography.lakes.map((f, i) => <path key={`l${i}`} d={f.d} fill={MAP.water} />)}

      {/* Реки */}
      <g fill="none" stroke={MAP.river} strokeWidth={1.1} vectorEffect="non-scaling-stroke" opacity={0.85}>
        {geography.rivers.map((f, i) => <path key={`r${i}`} d={f.d} />)}
      </g>

      {/* Берег поверх воды — иначе реки вылезают за него */}
      <g fill="none" stroke={MAP.coast} strokeWidth={1.4} vectorEffect="non-scaling-stroke" opacity={0.75}>
        {geography.ocean.map((d, i) => <path key={`c${i}`} d={d} />)}
      </g>

      {/* Области: спорные границы и предел знания — штриховкой, не заливкой */}
      {areas.filter((a) => a.rx && a.ry).map((a) => {
        const e = areaEllipse(a);
        if (!e) return null;
        return (
          <g key={`z${a.id}`}>
            <ellipse
              cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry}
              transform={`rotate(${e.rot} ${e.cx} ${e.cy})`}
              fill={`url(#hatch-${uid})`}
              stroke={CERT_COLOR[a.certainty]}
              strokeWidth={1.3}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              opacity={0.85}
            />
          </g>
        );
      })}

      {/* Стрелка: куда идёт вода. Нужна только там, где явление — не путь. */}
      {areas.filter((a) => a.arrow).map((a) => {
        const from = project(a.arrow!.from.lon, a.arrow!.from.lat);
        const to = project(a.arrow!.to.lon, a.arrow!.to.lat);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const head = 9 * u;
        const tipX = to.x;
        const tipY = to.y;
        const baseX = to.x - head * ux;
        const baseY = to.y - head * uy;
        const w = head * 0.5;
        return (
          <g key={`ar${a.id}`} stroke={CERT_COLOR[a.certainty]} fill="none" vectorEffect="non-scaling-stroke">
            <line x1={from.x} y1={from.y} x2={baseX} y2={baseY} strokeWidth={2} strokeDasharray="5 4" />
            <path d={`M${tipX} ${tipY} L${baseX + w * uy} ${baseY - w * ux} L${baseX - w * uy} ${baseY + w * ux} Z`} fill={CERT_COLOR[a.certainty]} />
          </g>
        );
      })}

      {/* Пути */}
      {[...routeIds].map((id) => {
        const direct = id.startsWith('route:');
        const route = routeById(direct ? id.slice(6) : id);
        if (!route) return null;
        const d = route.pts
          .map((p: [number, number], i: number) => {
            const q = project(p[0], p[1]);
            return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
          })
          .join(' ');
        return (
          <path
            key={`rt${id}`}
            d={d}
            fill="none"
            stroke={route.def.certainty === 'guess' ? CERT_COLOR.guess : 'var(--color-accent)'}
            strokeWidth={direct ? 2.8 : 1.8}
            strokeDasharray={route.def.certainty === 'guess' ? '2 5' : direct ? '7 5' : '10 4'}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={direct ? 0.92 : 0.7}
          />
        );
      })}

      {/* Где известно неточно: не точка, а круг сомнения */}
      {uncertaintyKm > 0 && pulse[0] && (() => {
        const c = project(pulse[0].lon, pulse[0].lat);
        const r = uncertaintyKm * pxPerKm(meta);
        return (
          <circle
            cx={c.x} cy={c.y} r={r}
            fill="var(--color-guess)" fillOpacity={0.08}
            stroke="var(--color-guess)" strokeWidth={1.2} strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        );
      })()}

      {/* Место события: зарубка с обводкой. Нужна отдельно от объектов карты —
          у половины событий место названо в тексте, но в списке мест его нет
          («Волховские пороги», «Восточный рубеж»). */}
      {location && (() => {
        const q = project(location.lon, location.lat);
        const a = 5.5 * u;
        const b = 9 * u;
        return (
          <g>
            <rect
              x={q.x - a} y={q.y - a} width={a * 2} height={a * 2}
              transform={`rotate(45 ${q.x} ${q.y})`}
              fill="var(--color-accent)"
            />
            <rect
              x={q.x - b} y={q.y - b} width={b * 2} height={b * 2}
              transform={`rotate(45 ${q.x} ${q.y})`}
              fill="none" stroke="var(--color-accent)" strokeWidth={1.2}
              opacity={0.5} vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })()}

      {/* Место: зарубка */}
      {pulse.map((p, i) => {
        const q = project(p.lon, p.lat);
        const a = 4 * u;
        return (
          <rect
            key={`p${i}`}
            x={q.x - a} y={q.y - a} width={a * 2} height={a * 2}
            transform={`rotate(45 ${q.x} ${q.y})`}
            fill="var(--color-accent)" opacity={0.55}
          />
        );
      })}

      {/* Где ещё могло быть: пустая зарубка. Одна уверенная точка там, где
          источники молчат, — это обман, а не упрощение. */}
      {alternatives.map((alt, i) => {
        const q = project(alt.lon, alt.lat);
        const a = 5 * u;
        const at = labelLayout.get(`a:${i}`);
        return (
          <g key={`a${i}`}>
            <rect
              x={q.x - a} y={q.y - a} width={a * 2} height={a * 2}
              transform={`rotate(45 ${q.x} ${q.y})`}
              fill="none" stroke="var(--color-guess)" strokeWidth={1.6}
              strokeDasharray="3 3" opacity={0.9}
              vectorEffect="non-scaling-stroke"
            />
            {at && (
              <text
                x={at.x} y={at.y} textAnchor={at.anchor}
                fontSize={altFontPx * u}
                fill="var(--color-guess)"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {alt.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Чего ещё нет */}
      {ghosts.map((g) => {
        const q = project(g.lon, g.lat);
        const at = labelLayout.get(`g:${g.id}`);
        return (
          <g key={`g${g.id}`} opacity={0.85}>
            <circle
              cx={q.x} cy={q.y} r={4 * u}
              fill="none" stroke={MAP.ghost} strokeWidth={1.2}
              strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
            />
            {at && (
              <text
                x={at.x} y={at.y} textAnchor={at.anchor}
                fontSize={ghostFontPx * u} fill={MAP.ghost}
                style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}
              >
                {g.name} · {g.year}
              </text>
            )}
          </g>
        );
      })}

      {/* Знаки мест */}
      {places.map((p) => {
        const q = project(p.lon, p.lat);
        // За кадром не рисуем ничего: подпись к невидимому знаку — это
        // обрывок слова у края листа.
        if (!pointInFrame(q.x, q.y, box)) return null;

        const color = CERT_COLOR[p.certainty];
        const emphasis = shown.has(p.id);
        const offMul = p.labelOffset ?? 1;
        const fontSizePx = emphasis ? EMPHASIS_FONT_PX : PLAIN_FONT_PX;
        const placed = labelLayout.get(`p:${p.id}`);

        // Выноска: если подпись отодвинута, она обязана показывать, к чему
        // относится, — иначе отодвинутая подпись превращается в догадку.
        let leader: { x1: number; y1: number; x2: number; y2: number } | null = null;
        if (placed && offMul > 1) {
          const dx = placed.x - q.x;
          const dy = placed.y - q.y;
          const len = Math.hypot(dx, dy) || 1;
          leader = {
            x1: q.x + (dx / len) * 6 * u, y1: q.y + (dy / len) * 6 * u,
            x2: placed.x - (dx / len) * 5 * u, y2: placed.y - (dy / len) * 5 * u,
          };
        }

        return (
          <g key={`m${p.id}`}>
            {/* У подписи к чужой зарубке своей нет: две зарубки в одной точке
                слиплись бы, а место здесь одно. */}
            {!p.sameSpot && markShapes(p.kind, q.x, q.y, u, emphasis).map((s, i) => {
              const stroke = emphasis ? color : 'var(--color-ink)';
              if (s.kind === 'circle') {
                return (
                  <circle
                    key={i}
                    cx={s.cx} cy={s.cy} r={s.r}
                    fill={s.strokeOnly ? 'none' : color}
                    stroke={s.strokeOnly ? stroke : 'none'}
                    strokeWidth={1.4}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }
              if (s.kind === 'poly') {
                return <polygon key={i} points={s.points} fill={color} />;
              }
              return (
                <path
                  key={i} d={s.d}
                  fill="none" stroke={color} strokeWidth={2.2}
                  strokeLinecap="round" vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {leader && (
              <line
                x1={leader.x1} y1={leader.y1} x2={leader.x2} y2={leader.y2}
                stroke={color} strokeWidth={1} strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke" opacity={0.8}
              />
            )}
            {placed && (
              <text
                x={placed.x} y={placed.y} textAnchor={placed.anchor}
                fontSize={fontSizePx * u}
                fontWeight={emphasis ? 700 : 400}
                fill="var(--color-ink)"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {p.name}
              </text>
            )}
          </g>
        );
      })}

      {/* Подписи земель поверх всего: они относятся к площади, а не к точке.
          Где именно — решено расстановкой: имя земли прижато к своей земле,
          сдвинуться могло на строку, а если и там занято — молчит. */}
      {areas.filter((a) => !a.rx && !a.ry).map((a) => {
        const plan = areaLayout.get(a.id);
        if (!plan) return null;
        return (
          <text
            key={`t${a.id}`}
            x={plan.at.x} y={plan.at.y}
            textAnchor="middle"
            fontSize={plan.fontPx * u}
            letterSpacing={1.4 * u}
            fill={a.kind === 'water' ? MAP.river : MAP.land}
            opacity={0.75}
            style={{ fontFamily: 'var(--font-serif)', textTransform: 'uppercase' }}
          >
            {a.label}
          </text>
        );
      })}

      {/* Названия областей — внутри самого пятна. Прежде имя прижималось к краю
          кадра, и у Орды — пятна в триста вёрст — оно оказывалось далеко от
          Орды. Теперь имя обходит занятое по своему пятну и уходит за его
          пределы только вместе с кадром, а не по своей воле. */}
      {areas.filter((a) => a.rx && a.ry).map((a) => {
        const plan = areaLayout.get(a.id);
        if (!plan) return null;
        return (
          <text
            key={`zt${a.id}`}
            x={plan.at.x} y={plan.at.y}
            textAnchor="middle"
            fontSize={plan.fontPx * u}
            fill={CERT_COLOR[a.certainty]}
            opacity={0.95}
            style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}
