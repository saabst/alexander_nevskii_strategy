/**
 * Проверка объектов карты.
 *
 * Правило то же, что и для сценария: ошибка в данных должна падать на тестах,
 * а не у игрока. Плюс два требования, которых нет у сценария, и оба не
 * формальные:
 *
 * 1. У места и области обязательны `note` и `source`. Из этих полей собирается
 *    научный лист; пустое поле означает, что объект попал на карту без
 *    основания — а это ровно та ложь, против которой продукт построен.
 * 2. Полуоси области не могут быть нулевыми: область без размера — это точка,
 *    и называть её «пределом знания» нельзя.
 */
import { z } from 'zod';
import type { MapContent } from '../types/map';

const certainty = z.enum(['fact', 'recon', 'legend', 'guess']);

const lat = z.number().gte(54).lte(66);
const lon = z.number().gte(18).lte(36);

const point = z.object({ lat, lon });

/** Объяснение для научного листа: короткая строка бесполезна. */
const note = z.string().min(20, 'пояснение короче 20 знаков — это не пояснение');
const source = z.string().min(3, 'источник не назван');

const placeKind = z.enum(['city', 'fortress', 'battle', 'camp', 'pogost', 'hoard']);
const areaKind = z.enum(['land', 'water', 'zone', 'phenomenon']);
const labelSide = z.enum(['r', 'l', 't', 'b', 'rt', 'lt', 'rb', 'lb']);

export const mapPlace = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  now: z.string().optional(),
  lat,
  lon,
  kind: placeKind,
  certainty,
  labelSide: labelSide.optional(),
  base: z.boolean().optional(),
  cluster: z.string().min(1).optional(),
  mainLabel: z.boolean().optional(),
  /** от 1 и выше: подпись отодвигается от знака вместе с выноской */
  labelOffset: z.number().gte(1).lte(8).optional(),
  sameSpot: z.boolean().optional(),
  minZoom: z.number().gte(1).lte(16).optional(),
  note,
  source,
});

export const mapArea = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  lat,
  lon,
  kind: areaKind,
  certainty,
  rx: z.number().positive().optional(),
  ry: z.number().positive().optional(),
  rot: z.number().optional(),
  base: z.boolean().optional(),
  labelSide: z.enum(['above', 'below']).optional(),
  minZoom: z.number().gte(1).lte(16).optional(),
  arrow: z.object({ from: point, to: point }).optional(),
  note,
  source,
});

export const mapGhost = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lat,
  lon,
  year: z.string().min(3, 'у «гостя из будущего» обязан быть год основания'),
  cluster: z.string().min(1).optional(),
  note: z.string().optional(),
});

export const mapRouteDef = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  label: z.string().min(1),
  certainty,
  reverse: z.boolean().optional(),
  portion: z
    .tuple([z.number().gte(0).lte(1), z.number().gte(0).lte(1)])
    .refine(([a, b]) => b > a, 'доля пути задана наоборот: конец раньше начала')
    .optional(),
  note,
});

export const mapContentSchema = z.object({
  id: z.string().min(1),
  loupe: z
    .object({
      cluster: z.string().min(1),
      lat,
      lon,
      dLat: z.number().positive(),
      dLon: z.number().positive(),
    })
    .optional(),
  places: z.array(mapPlace),
  areas: z.array(mapArea),
  ghosts: z.array(mapGhost),
  routes: z.array(mapRouteDef),
});

export interface MapIssue {
  path: string;
  message: string;
}

/** Проверка данных карты. Возвращает все проблемы разом, а не первую. */
export function validateMapContent(raw: unknown): { ok: boolean; issues: MapIssue[] } {
  const issues: MapIssue[] = [];
  const parsed = mapContentSchema.safeParse(raw);
  if (!parsed.success) {
    for (const e of parsed.error.issues) {
      issues.push({ path: e.path.join('.'), message: e.message });
    }
    return { ok: false, issues };
  }

  const content = parsed.data as MapContent;

  // id общие для всех видов объектов: контент зовёт слой по имени и не знает,
  // место это, область или путь. Значит и дубли ловим по общему списку.
  const seen = new Map<string, string>();
  const all: Array<[string, string]> = [
    ...content.places.map((p) => [p.id, 'place'] as [string, string]),
    ...content.areas.map((a) => [a.id, 'area'] as [string, string]),
    ...content.ghosts.map((g) => [g.id, 'ghost'] as [string, string]),
    ...content.routes.map((r) => [r.id, 'route'] as [string, string]),
  ];
  for (const [id, kind] of all) {
    const was = seen.get(id);
    if (was) {
      issues.push({ path: id, message: `id занят дважды: ${was} и ${kind}` });
    } else {
      seen.set(id, kind);
    }
  }

  // область без размера — это точка под чужим именем
  for (const a of content.areas) {
    const sized = (a.rx ?? 0) > 0 && (a.ry ?? 0) > 0;
    if ((a.kind === 'zone' || a.kind === 'phenomenon') && !sized) {
      issues.push({ path: `areas.${a.id}`, message: 'у зоны нет полуосей — это точка, а не область' });
    }
    if ((a.kind === 'land' || a.kind === 'water') && sized) {
      issues.push({ path: `areas.${a.id}`, message: 'у подписи земли задан размер: она должна быть строкой, а не пятном' });
    }
  }

  // «гость из будущего» обязан быть теснее связан с временем, чем просто имя
  for (const g of content.ghosts) {
    if (!/осн\.\s*\d{4}/.test(g.year)) {
      issues.push({ path: `ghosts.${g.id}`, message: `год основания не распознан: «${g.year}»` });
    }
  }

  return { ok: issues.length === 0, issues };
}
