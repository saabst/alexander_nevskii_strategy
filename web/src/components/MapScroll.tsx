import { useEffect, useMemo, useRef, useState } from 'react';
import {
  makeViewBox,
  withGhosts,
  type Scenario,
  type ScenarioEvent,
  type Session,
} from '@nevsky/core';
import MapCanvas from './MapCanvas';
import {
  MAP_CONTENT, lastRouteId, loupeWindow, meta, neededLoupe, project,
  visibleLayers, zoomOf,
} from '../lib/map';

/**
 * Карта-вырезка.
 *
 * География приходит готовыми путями SVG (их считает tools/geo/build_geo.py из
 * Natural Earth 1:10m, public domain). Всё, что зависит от хода игры — какие
 * объекты открыты, куда смотрит окно, какой путь пройден, — берётся из
 * состояния и объектов карты (content/map/*.map.json).
 *
 * Два улучшения против прежней версии, и оба не косметические:
 *
 * 1. Врезка. Устье Невы занимает на общем плане десяток километров, и четыре
 *    знака там сливаются в пятно. Пока увеличение меньше 8, они показываются
 *    крупнее в отдельном окне — тем же холстом, а не второй картой.
 * 2. Знаки и подписи не растут вместе с местностью: `u` считается от ширины
 *    блока, поэтому подпись читается на любом увеличении, как на настоящей
 *    карте.
 */

/** Пропорции блока. Те же, что передаются в расчёт окна. */
const ASPECT = 1.6;

/** Ширина врезки — доля ширины блока. */
const LOUPE_WIDTH = 0.34;

export default function MapScroll({
  event, session, scenario, className = '',
}: {
  event: ScenarioEvent;
  session: Session;
  scenario: Scenario;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pxWidth, setPxWidth] = useState(0);
  const [ghosts, setGhosts] = useState(false);

  // Размер блока нужен, чтобы знаки и подписи были одного размера на экране
  // при любом увеличении. Без измерения это угадывание.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    setPxWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPxWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = zoomOf(event.map?.focus?.zoom);
  const box = useMemo(() => makeViewBox(event.map?.focus, meta, ASPECT, project), [event]);
  const routeId = useMemo(() => lastRouteId(session, scenario), [session, scenario]);
  const layers = useMemo(
    () => withGhosts(visibleLayers(session, scenario), ghosts),
    [session, scenario, ghosts],
  );

  const width = pxWidth || 760;
  const u = box.w / width;

  const loupe = loupeWindow();
  const loupeOn = loupe ? neededLoupe(layers, zoom, box) : false;
  const loupeAspect = loupe ? loupe.w / loupe.h : 1;
  const loupeU = loupe ? loupe.w / (width * LOUPE_WIDTH) : 0;

  const pulse = event.map?.pulse ?? [];
  const alternatives = event.map?.alternatives ?? [];
  const uncertaintyKm = event.map?.uncertaintyKm ?? 0;
  // Директива называет маршрут коротко («knyaz»), а в данных он записан как
  // «knyaz-route» — искать по имени нельзя, только по источнику.
  const shownRoute = routeId ? MAP_CONTENT.routes.find((r) => r.from === routeId) : undefined;

  return (
    <figure className={`m-0 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          aria-pressed={ghosts}
          onClick={() => setGhosts((v) => !v)}
          className={`tappable ${ghosts ? 'bark-btn-primary' : 'bark-btn'} px-3 py-1.5`}
        >
          чего ещё нет
        </button>
        <span className="text-ink-soft">
          {ghosts
            ? 'показаны города, которых в 1240 году не было'
            : 'показать города позднейших веков'}
        </span>
      </div>

      <div
        ref={wrapRef}
        className="relative overflow-hidden"
        style={{
          border: '2px solid #4a382624',
          borderRadius: '16px 6px 18px 7px',
          background: '#ded4b4',
        }}
      >
        <MapCanvas
          uid="main"
          box={box}
          u={u}
          layers={layers}
          zoom={zoom}
          routeId={routeId}
          location={event.location}
          pulse={pulse}
          alternatives={alternatives}
          uncertaintyKm={uncertaintyKm}
          aspect={ASPECT}
        />

        {/* Врезка: то же место, но ближе. Знаки у устья Невы на общем плане
            сливаются, и показать их там точкой — значит ничего не показать. */}
        {loupeOn && loupe && (
          <div
            className="absolute right-2 bottom-2 overflow-hidden"
            style={{
              width: `${LOUPE_WIDTH * 100}%`,
              border: '2px solid #4a382680',
              borderRadius: '12px 4px 12px 5px',
              background: '#ded4b4',
              boxShadow: '0 6px 18px #4a382633',
            }}
          >
            <MapCanvas
              uid="loupe"
              box={loupe}
              u={loupeU}
              layers={layers}
              zoom={zoom}
              cluster={MAP_CONTENT.loupe?.cluster}
              routeId={routeId}
              location={event.location}
              pulse={pulse}
              alternatives={alternatives}
              aspect={loupeAspect}
            />
            <div className="px-2 pb-1 text-[10px] leading-tight text-ink-soft">
              врезка · устье Невы
            </div>
          </div>
        )}
      </div>

      <figcaption className="mt-2 text-xs text-ink-soft">
        {event.location ? `${event.location.name}` : 'Место в источнике не названо'}
        {uncertaintyKm > 0 && ` · место известно с точностью около ±${uncertaintyKm} км`}
        {alternatives.length > 0 && ` · возможных мест: ${alternatives.length + 1}, все показаны`}
        {shownRoute && ` · показан путь: ${shownRoute.label}`}
        {loupeOn && ' · устье Невы дано врезкой крупнее'}
      </figcaption>
    </figure>
  );
}
