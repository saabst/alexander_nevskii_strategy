/**
 * Движок сценария. Работает БЕЗ ИИ и без сети, детерминированно:
 * один и тот же выбор всегда даёт один и тот же результат.
 *
 * Вся логика — здесь. Карта, интерфейс и аналитика только читают состояние сессии.
 */
import type {
  Choice, Condition, Effect, Outcome, Resources, ResourceKey,
  Scenario, ScenarioEvent, Session,
} from '../types/scenario';
import { RESOURCE_KEYS, RESOURCE_META } from '../types/scenario';

export const RESOURCE_MIN = 0;
export const RESOURCE_MAX = 100;

/** Единственное место, где ресурс приводится к шкале. */
export function clampResource(value: number): number {
  if (Number.isNaN(value)) return RESOURCE_MIN;
  return Math.max(RESOURCE_MIN, Math.min(RESOURCE_MAX, Math.round(value)));
}

export function makeId(prefix = 's'): string {
  // Без crypto.randomUUID: движок обязан работать и в старом браузере, и в тестах.
  const rnd = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

/** Условие выполнено? */
export function checkCondition(session: Session, cond: Condition): boolean {
  switch (cond.type) {
    case 'resource_min': return session.resources[cond.key] >= cond.value;
    case 'resource_max': return session.resources[cond.key] <= cond.value;
    case 'flag_true':    return session.flags[cond.key] === true;
    case 'flag_false':   return session.flags[cond.key] !== true;
    default: {
      const never: never = cond;
      throw new Error(`неизвестное условие: ${JSON.stringify(never)}`);
    }
  }
}

/** Показывать ли вариант игроку. */
export function canShowChoice(session: Session, choice: Choice): boolean {
  if (!choice.conditions || choice.conditions.length === 0) return true;
  return choice.conditions.every((c) => checkCondition(session, c));
}

export function startSession(scenario: Scenario, now: () => string = () => new Date().toISOString()): Session {
  return {
    id: makeId('sess'),
    scenarioId: scenario.id,
    startedAt: now(),
    currentEventId: scenario.startEventId,
    resources: { ...scenario.resources },
    flags: {},
    history: [],
    status: 'active',
    canonicalHits: 0,
    canonicalTotal: 0,
  };
}

export function getCurrentEvent(session: Session, scenario: Scenario): ScenarioEvent | null {
  if (session.status !== 'active') return null;
  return scenario.events.find((e) => e.id === session.currentEventId) ?? null;
}

/** Применить эффекты к копии состояния. Чистая функция. */
export function applyEffects(
  resources: Resources,
  flags: Record<string, boolean>,
  effects: Effect[],
): { resources: Resources; flags: Record<string, boolean> } {
  const nextResources: Resources = { ...resources };
  const nextFlags: Record<string, boolean> = { ...flags };
  for (const e of effects) {
    if (e.type === 'resource') {
      const key: ResourceKey = e.key;
      nextResources[key] = clampResource(nextResources[key] + e.value);
    } else if (e.type === 'flag') {
      nextFlags[e.key] = e.value;
    }
  }
  return { resources: nextResources, flags: nextFlags };
}

export interface ApplyResult {
  session: Session;
  choice: Choice;
  /** Вариант оказался недоступен по условиям — состояние не тронуто. */
  rejected: boolean;
}

/**
 * Применить выбор. Возвращает НОВУЮ сессию: старую можно безопасно
 * отправить в историю и сравнить «до/после».
 */
export function applyChoice(
  session: Session,
  scenario: Scenario,
  choiceId: string,
  now: () => string = () => new Date().toISOString(),
): ApplyResult {
  const event = getCurrentEvent(session, scenario);
  if (!event) throw new Error('сессия не активна');
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`в событии «${event.id}» нет варианта «${choiceId}»`);
  if (!canShowChoice(session, choice)) {
    return { session, choice, rejected: true };
  }

  const { resources, flags } = applyEffects(session.resources, session.flags, choice.effects);
  const record = {
    eventId: event.id,
    eventTitle: event.title,
    choiceId: choice.id,
    choiceTitle: choice.title,
    effects: choice.effects,
    canonical: choice.canonical ?? false,
    certainty: (choice.certainty ?? event.certainty),
    createdAt: now(),
  };

  const finished = choice.nextEventId === null;
  const next: Session = {
    ...session,
    resources,
    flags,
    history: [...session.history, record],
    currentEventId: choice.nextEventId ?? session.currentEventId,
    status: finished ? 'finished' : 'active',
    canonicalHits: session.canonicalHits + (choice.canonical ? 1 : 0),
    // Считаем только те решения, о которых источники вообще говорят. Иначе
    // в знаменателе оказывались бы события, где летопись молчит: игрок не мог
    // совпасть с ходом князя там, где хода князя никто не записал, — а счёт
    // показывал бы это как промах. Такой счёт нельзя выиграть, и толку в нём нет.
    canonicalTotal: session.canonicalTotal + (canonicalChoiceOf(event) ? 1 : 0),
    finishedAt: finished ? now() : session.finishedAt,
  };
  return { session: next, choice, rejected: false };
}

/** Веса для итоговой оценки. Вынесены наружу, чтобы историк мог их оспорить. */
export const SCORE_WEIGHTS: Record<ResourceKey, number> = {
  authority: 0.30,
  stability: 0.20,
  army: 0.15,
  treasury: 0.10,
  westernThreat: -0.125,
  easternThreat: -0.125,
};

export function scoreOf(resources: Resources): number {
  let acc = 0;
  for (const key of RESOURCE_KEYS) {
    const w = SCORE_WEIGHTS[key];
    const v = w < 0 ? (100 - resources[key]) : resources[key];
    acc += v * Math.abs(w);
  }
  return clampResource(acc);
}

/** Разбор, в котором мы честно расписываемся в незнании. */
export function uncertaintyOf(scenario: Scenario, session: Session): string[] {
  const notes = new Set<string>();
  for (const rec of session.history) {
    if (rec.certainty === 'guess') {
      notes.add(`«${rec.eventTitle}» — решение принималось в том, о чём источники молчат.`);
    }
    if (rec.certainty === 'legend') {
      notes.add(`«${rec.eventTitle}» — ход событий известен нам только по житию, не по документу.`);
    }
  }
  const ev = scenario.events.find((e) => e.id === session.currentEventId);
  if (ev?.map?.uncertaintyKm) {
    notes.add(`${ev.title}: место известно с точностью примерно ${ev.map.uncertaintyKm} км.`);
  }
  return [...notes];
}

/** Эпилог выбирается по состоянию, а не по последнему выбору. */
export interface Ending {
  id: string;
  title: string;
  text: string;
  /** Первое подходящее правило выигрывает; правила заданы от частного к общему. */
}

/**
 * Правила финала. Правило само объявляет, какие пометки из прошлого ему нужны
 * (`requires`), — иначе прочитать эту зависимость из кода нельзя, и проверка,
 * которая следит за судьбой каждой пометки, слепнет.
 */
export interface EndingRule {
  id: string;
  title: string;
  text: string;
  /** Пометки, без которых правило не срабатывает. */
  requires?: string[];
  when: (r: Resources, s: Session) => boolean;
}

export const ENDINGS: EndingRule[] = [
  {
    id: 'nevsky',
    title: 'Нева за нами, и это знают все',
    text:
      'Шведы ушли к устью, не добравшись до Ладоги. Новгород получил победу, о которой ' +
      'сложат повесть: она войдёт в житие князя, и в ней появится больше, чем было. ' +
      'Вы сохранили и войско, и разумную осторожность. Впереди — Копорье и Псков, ' +
      'и теперь у вас есть чем их взять.',
    when: (r, s) => r.westernThreat < 55 && r.authority >= 55 && r.army >= 35,
  },
  {
    id: 'bloody',
    title: 'Победа, за которую заплатили войском',
    text:
      'Побережье осталось за Новгородом, но дружина поредела так, что о новом походе ' +
      'в этом году нечего и думать. Немцы возьмут Копорье, пока вы будете считать раненых. ' +
      'Победу запишут в летопись, а цену её не запишет никто.',
    when: (r) => r.army < 30 && r.westernThreat < 70,
  },
  {
    id: 'cautious',
    title: 'Князь, который ждал',
    text:
      'Вы не проиграли — и не выиграли. Шведы постояли у Ижоры, разорили погост ' +
      'и ушли с добычей. Новгород заметит это быстрее, чем вы успеете объяснить свою правоту: ' +
      'в XII-XIII веках князя в Новгороде держали ровно до первой неудачи.',
    when: (r) => r.authority < 50 || r.stability < 45,
  },
  {
    id: 'horde',
    title: 'Два врага с двух сторон',
    text:
      'Нева прошла спокойно, но с востока пришла такая беда, что западные дела стали ' +
      'второстепенными. Поход Батыя уже прошёл по русским землям; следующая задача — ' +
      'не победа, а выживание. Таков 1240 год: он не про славу, а про счёт сил.',
    when: (r) => r.easternThreat >= 70,
  },
  {
    // Две последние пометки ставятся на выходе из Ливонии, и читать их больше
    // негде — только здесь. Без этих правил последнее решение игрока не значит
    // ровным счётом ничего: пометка ставилась и пропадала.
    id: 'diplomacy',
    title: 'Дело длинное, и оно только началось',
    text:
      'Вы выбрали не бой, а работу: грамоты, договоры, размен пленными, письма в Ригу ' +
      'и в Смоленск. Так добывают не победу, а мир, и в летопись такой мир попадает ' +
      'одной скупой строкой. Запад отступит не сразу — но погосты у Невы останутся целыми.',
    requires: ['diplomacyPath'],
    when: () => true,
  },
  {
    id: 'war',
    title: 'Впереди новый поход',
    text:
      'Вы не стали договариваться: дружина уже считает дни до весны, а Псков и Изборск ' +
      'стоят в списке первыми. Готовиться вы умеете — вопрос только в том, хватит ли ' +
      'серебра и людей, когда придёт время идти.',
    requires: ['warPath'],
    when: () => true,
  },
  {
    id: 'default',
    title: 'Кампания окончена',
    text:
      'Вы прошли 1240 год от тревожной вести до итога. Ни одна из сторон не решила дела ' +
      'окончательно — как и в настоящей истории, где всё решили следующие десять лет.',
    when: () => true,
  },
];

export function calculateOutcome(
  session: Session,
  scenario: Scenario,
  initial: Resources,
): Outcome {
  const ending = ENDINGS.find(
    (e) => (e.requires ?? []).every((k) => session.flags[k] === true)
      && e.when(session.resources, session),
  )!;
  const score = scoreOf(session.resources);
  const historicityScore = session.canonicalTotal === 0
    ? 0
    : clampResource((session.canonicalHits / session.canonicalTotal) * 100);

  const changed: string[] = [];
  for (const key of RESOURCE_KEYS) {
    const d = session.resources[key] - initial[key];
    if (d !== 0) changed.push(`${RESOURCE_META[key].label} ${d > 0 ? '+' : '−'}${Math.abs(d)}`);
  }

  // Сколько решений пришлось на события, о которых источники молчат.
  // Это не «промахи»: там нельзя было угадать, потому что угадывать нечего.
  const silent = session.history.length - session.canonicalTotal;

  return {
    sessionId: session.id,
    completed: session.status === 'finished',
    finalResources: { ...session.resources },
    initialResources: { ...initial },
    totalChoices: session.history.length,
    keyDecisions: session.history.filter((h) => h.canonical || h.effects.length > 1),
    summaryText:
      `${ending.text}\n\nИтог состояния земель: ${score} из 100. ` +
      (session.canonicalTotal > 0
        ? `О ходе князя источники говорят в ${session.canonicalTotal} ваших решениях, `
          + `и совпало с ним ${session.canonicalHits}. `
        : 'Ни об одном из ваших решений источники прямо не говорят. ') +
      (silent > 0
        ? `Ещё ${silent} решений источники не описывают вовсе: там не «неверно», а «неизвестно». `
        : '') +
      (changed.length ? `\n\n${changed.join('; ')}.` : ''),
    historicalNotes: scenario.events
      .filter((e) => e.historicalNote)
      .map((e) => e.historicalNote!) as string[],
    uncertaintyNotes: uncertaintyOf(scenario, session),
    score,
    historicityScore,
    endingId: ending.id,
  };
}

/** Пройти сценарий по заранее заданной цепочке id — для тестов и демо-прогонов. */
export function replay(scenario: Scenario, choiceIds: string[]): Session {
  let s = startSession(scenario);
  for (const id of choiceIds) {
    const res = applyChoice(s, scenario, id);
    if (res.rejected) throw new Error(`вариант «${id}» недоступен по условиям`);
    s = res.session;
    if (s.status === 'finished') break;
  }
  return s;
}

/**
 * Как поступил князь — то, что в игре теряется легче всего.
 *
 * Три состояния, а не два, и это не придирка. Два было бы так: «поступил так»
 * и «поступил иначе». Но о шести событиях из тринадцати летопись не говорит
 * ничего, и объявить там «поступил иначе» значит выдать молчание источника
 * за знание. Игрок должен видеть разницу между «мы знаем, что было не так»
 * и «мы не знаем, как было».
 */
export type ChronicleVerdict =
  /** летопись говорит: князь поступил именно так */
  | 'as-prince'
  /** летопись говорит, что он поступил иначе — и мы знаем, как */
  | 'not-as-prince'
  /** о том, что делал князь, источники не говорят ничего */
  | 'silent';

/** Вариант, которым князь и поступил, — или null, если о том не сказано. */
export function canonicalChoiceOf(event: ScenarioEvent): Choice | null {
  return event.choices.find((c) => c.canonical) ?? null;
}

/**
 * Что известно о ходе князя в этом событии.
 *
 * `not-as-prince` ставится только тогда, когда в том же событии есть ход,
 * который князь всё-таки сделал: тогда «не так» опирается на источник.
 */
export function chronicleVerdict(
  event: ScenarioEvent,
  choiceId: string,
): ChronicleVerdict {
  const choice = event.choices.find((c) => c.id === choiceId);
  if (choice?.canonical) return 'as-prince';
  return canonicalChoiceOf(event) ? 'not-as-prince' : 'silent';
}
