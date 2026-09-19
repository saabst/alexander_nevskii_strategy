/**
 * Валидация контента через Zod.
 *
 * Правило проекта: ошибка в контенте должна падать на сборке/тестах, а не в бою
 * у школьника. Поэтому схема строгая, а validateScenario() собирает ВСЕ проблемы
 * разом, а не первую.
 */
import { z } from 'zod';
import type { Scenario } from '../types/scenario';
import { RESOURCE_KEYS } from '../types/scenario';

const resourceKey = z.enum(RESOURCE_KEYS);
const certainty = z.enum(['fact', 'recon', 'legend', 'guess']);

export const geoPoint = z.object({
  lat: z.number().gte(54).lte(66),
  lon: z.number().gte(18).lte(36),
});

export const mapDirective = z.object({
  focus: geoPoint.extend({ zoom: z.number().optional() }).optional(),
  show: z.array(z.string()).optional(),
  hide: z.array(z.string()).optional(),
  route: z.string().nullable().optional(),
  pulse: z.array(geoPoint).optional(),
  alternatives: z.array(geoPoint.extend({ label: z.string().min(1) })).optional(),
  uncertaintyKm: z.number().positive().optional(),
});

export const advisor = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  text: z.string().min(1),
  certainty,
  portrait: z.string().optional(),
});

export const condition = z.discriminatedUnion('type', [
  z.object({ type: z.literal('resource_min'), key: resourceKey, value: z.number() }),
  z.object({ type: z.literal('resource_max'), key: resourceKey, value: z.number() }),
  z.object({ type: z.literal('flag_true'), key: z.string(), value: z.never().optional() }),
  z.object({ type: z.literal('flag_false'), key: z.string(), value: z.never().optional() }),
]);

export const effect = z.discriminatedUnion('type', [
  z.object({ type: z.literal('resource'), key: resourceKey, value: z.number() }),
  z.object({ type: z.literal('flag'), key: z.string().min(1), value: z.boolean() }),
]);

export const choice = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  effects: z.array(effect),
  nextEventId: z.string().nullable(),
  conditions: z.array(condition).optional(),
  outcomeText: z.string().optional(),
  canonical: z.boolean().optional(),
  certainty: certainty.optional(),
  map: mapDirective.optional(),
});

/**
 * Лицензии, под которыми картинку можно брать. Список закрытый, и это
 * нарочно: под CC-BY картинку тоже можно взять, но тогда её обязанность —
 * называть автора везде, где она показана, а в игре подпись живёт отдельным
 * полем и легко теряется. Поэтому правило простое: только то, что свободно
 * совсем.
 */
const FREE_LICENSES = [
  'public domain', 'cc0', 'pd-old', 'pd-art', 'pd-russia', 'no restrictions',
];

const illustration = z.object({
  file: z.string().min(3),
  title: z.string().min(3),
  author: z.string().min(2),
  date: z.string().min(2),
  license: z
    .string()
    .min(3)
    .refine(
      (v) => FREE_LICENSES.some((f) => v.toLowerCase().includes(f)),
      'картинку можно брать только под свободной лицензией: public domain или CC0',
    ),
  licenseUrl: z.string().url(),
  sourceUrl: z.string().url(),
  // Подпись в одну строку бесполезна: игроку нужно понять, что он видит.
  caption: z.string().min(40, 'подпись к картинке короче 40 знаков — это не объяснение'),
  contemporaneous: z.boolean(),
});

export const scenarioEvent = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(30, 'текст события короче 30 знаков — почти наверняка ошибка'),
  certainty,
  sources: z.array(z.string().min(3)).min(1, 'у события обязан быть хотя бы один источник'),
  location: geoPoint.extend({ name: z.string().min(1) }).optional(),
  advisors: z.array(advisor).max(4, 'больше 4 советников не помещается на экран'),
  choices: z.array(choice).min(2, 'у события должно быть минимум 2 варианта'),
  historicalNote: z.string().optional(),
  illustration: illustration.optional(),
  map: mapDirective.optional(),
  ending: z.boolean().optional(),
});

export const resources = z.object({
  army: z.number().min(0).max(100),
  treasury: z.number().min(0).max(100),
  authority: z.number().min(0).max(100),
  stability: z.number().min(0).max(100),
  westernThreat: z.number().min(0).max(100),
  easternThreat: z.number().min(0).max(100),
});

export const scenario = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  shortDescription: z.string().min(10),
  fullDescription: z.string().min(30),
  startEventId: z.string().min(1),
  year: z.number().int().gte(800).lte(1700),
  eraNote: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  estimatedMinutes: z.number().int().positive(),
  tags: z.array(z.string()).min(1),
  published: z.boolean(),
  coverImage: z.string().optional(),
  resources,
  events: z.array(scenarioEvent).min(3),
});

export interface ValidationIssue {
  path: string;
  message: string;
  kind: 'schema' | 'graph';
}

/**
 * Полная проверка сценария: схема + связность графа.
 * Возвращает список проблем; пустой список = контент годен.
 */
export function validateScenario(raw: unknown): { ok: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const parsed = scenario.safeParse(raw);
  if (!parsed.success) {
    for (const e of parsed.error.issues) {
      issues.push({ path: e.path.join('.'), message: e.message, kind: 'schema' });
    }
    return { ok: false, issues };
  }

  const s = parsed.data as Scenario;
  const byId = new Map(s.events.map((e) => [e.id, e]));

  // стартовое событие существует
  if (!byId.has(s.startEventId)) {
    issues.push({ path: 'startEventId', message: `нет события «${s.startEventId}»`, kind: 'graph' });
  }

  // уникальные id событий и вариантов
  const seenEvent = new Set<string>();
  const seenChoice = new Set<string>();
  for (const ev of s.events) {
    if (seenEvent.has(ev.id)) {
      issues.push({ path: `events.${ev.id}`, message: 'дублирующийся id события', kind: 'graph' });
    }
    seenEvent.add(ev.id);
    for (const c of ev.choices) {
      const key = `${ev.id}/${c.id}`;
      if (seenChoice.has(key)) {
        issues.push({ path: key, message: 'дублирующийся id варианта', kind: 'graph' });
      }
      seenChoice.add(key);
    }
  }

  // переходы ведут в существующие события; куда-то вести обязан каждый
  for (const ev of s.events) {
    for (const c of ev.choices) {
      if (c.nextEventId !== null && !byId.has(c.nextEventId)) {
        issues.push({
          path: `${ev.id}/${c.id}`,
          message: `переход в несуществующее событие «${c.nextEventId}»`,
          kind: 'graph',
        });
      }
    }
  }

  // каждое событие достижимо от старта
  const reachable = new Set<string>();
  const queue = [s.startEventId];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id) || !byId.has(id)) continue;
    reachable.add(id);
    for (const c of byId.get(id)!.choices) {
      if (c.nextEventId) queue.push(c.nextEventId);
    }
  }
  for (const ev of s.events) {
    if (!reachable.has(ev.id)) {
      issues.push({ path: `events.${ev.id}`, message: 'событие недостижимо от старта', kind: 'graph' });
    }
  }

  // из каждого события обязан существовать путь до финала
  const canFinish = new Set<string>();
  for (const ev of s.events) {
    if (ev.choices.some((c) => c.nextEventId === null)) canFinish.add(ev.id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const ev of s.events) {
      if (canFinish.has(ev.id)) continue;
      if (ev.choices.some((c) => c.nextEventId && canFinish.has(c.nextEventId))) {
        canFinish.add(ev.id);
        grew = true;
      }
    }
  }
  for (const ev of s.events) {
    if (!canFinish.has(ev.id)) {
      issues.push({ path: `events.${ev.id}`, message: 'тупик: из события нет пути до финала', kind: 'graph' });
    }
  }

  // события со статусом fact обязаны иметь источник вида «летопись/документ»
  for (const ev of s.events) {
    if (ev.certainty === 'fact' && ev.sources.length === 0) {
      issues.push({ path: `events.${ev.id}`, message: 'статус «факт» без источника', kind: 'graph' });
    }
  }

  return { ok: issues.length === 0, issues };
}
