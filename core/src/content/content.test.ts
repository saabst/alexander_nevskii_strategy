import { describe, it, expect } from 'vitest';
import rawScenario from './scenarios/neva-1240.json';
import { RESOURCE_META, type Scenario, type Session } from '../types/scenario';
import { validateScenario } from '../validation/schema';
import { applyChoice, canShowChoice, ENDINGS, startSession } from '../engine';

const scenario = rawScenario as unknown as Scenario;

describe('валидация контента', () => {
  it('сценарий проходит схему и проверку графа', () => {
    const { ok, issues } = validateScenario(rawScenario);
    if (!ok) console.error(issues);
    expect(issues).toEqual([]);
    expect(ok).toBe(true);
  });

  it('у каждого события есть источник и минимум два варианта', () => {
    for (const ev of scenario.events) {
      expect(ev.sources.length, `событие ${ev.id}`).toBeGreaterThan(0);
      expect(ev.choices.length, `событие ${ev.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('объём сценария в рамках ТЗ: 10-15 событий', () => {
    expect(scenario.events.length).toBeGreaterThanOrEqual(10);
    expect(scenario.events.length).toBeLessThanOrEqual(15);
  });

  it('статусы знания расставлены по всем четырём видам', () => {
    const all = new Set<string>();
    for (const ev of scenario.events) {
      all.add(ev.certainty);
      for (const c of ev.choices) if (c.certainty) all.add(c.certainty);
    }
    for (const want of ['fact', 'recon', 'legend', 'guess']) {
      expect(all.has(want), `нет ни одного «${want}»`).toBe(true);
    }
  });

it('рассказ написан понятным русским, без архаизмов и дореформенных форм', () => {
    const ARCHAIC = ['свеи', 'свейск', 'толмач', 'бечев', 'кормчий', 'станом', 'зѣло', 'длань', 'перст'];
    const problems: string[] = [];
    for (const ev of scenario.events) {
      const narrative = [
        ev.title, ev.text,
        ...ev.advisors.map((a) => a.text),
        ...ev.choices.flatMap((c) => [c.title, c.description ?? '', c.outcomeText ?? '']),
      ].join(' ').toLowerCase();

      for (const w of ARCHAIC) {
        if (narrative.includes(w)) problems.push(`${ev.id}: «${w}» в рассказе`);
      }
      if (/[ѣѵі]|[А-Яа-яЁё]+ъ(?![а-яёА-ЯЁ])/.test(narrative)) {
        problems.push(`${ev.id}: дореформенная орфография в рассказе`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('термин летописи «свеи» объясняется там, где ему место — в источниках', () => {
    const all = JSON.stringify(scenario);
    expect(all).toContain('свеями');   // объяснение рядом с источником
  });

  it('подписи интерфейса написаны понятным русским — не только рассказ', () => {
    // Раньше проверялся один лишь рассказ, и архаизм «свеи» преспокойно жил
    // в подписи к угрозе с Запада, которую видит игрок. Проверяем и служебные
    // строки движка, а не только текст событий: класс ошибки, не один случай.
    const ARCHAIC = ['свеи', 'свейск', 'толмач', 'бечев', 'кормчий', 'станом', 'длань', 'перст'];
    const ui = JSON.stringify(RESOURCE_META).toLowerCase();
    const found = ARCHAIC.filter((w) => ui.includes(w));
    expect(found, `архаизмы в подписях интерфейса: ${found.join(', ')}`).toEqual([]);
  });

  it('координаты всех событий внутри рамки карты', () => {
    for (const ev of scenario.events) {
      if (!ev.location) continue;
      expect(ev.location.lat, ev.id).toBeGreaterThan(56);
      expect(ev.location.lat, ev.id).toBeLessThan(62);
      expect(ev.location.lon, ev.id).toBeGreaterThan(22);
      expect(ev.location.lon, ev.id).toBeLessThan(36);
    }
  });
});

describe('граф сценария целиком', () => {
  /** Обойти ВСЕ достижимые сочетания выборов и проверить инварианты. */
  function walkAll(): { paths: number; endings: Set<string>; visited: Set<string> } {
    const paths = { count: 0 };
    const endings = new Set<string>();
    const visited = new Set<string>();

    const step = (session: Session, depth: number) => {
      if (depth > 40) throw new Error('слишком длинный путь — похоже на цикл');
      const ev = scenario.events.find((e) => e.id === session.currentEventId)!;
      visited.add(ev.id);
      const available = ev.choices.filter((c) => canShowChoice(session, c));
      expect(available.length, `в ${ev.id} не осталось доступных вариантов`).toBeGreaterThan(0);
      for (const choice of available) {
        const r = applyChoice(session, scenario, choice.id);
        expect(r.rejected).toBe(false);
        for (const key of Object.keys(r.session.resources) as Array<keyof typeof r.session.resources>) {
          const v = r.session.resources[key];
          expect(v, `${key} вне шкалы в ${ev.id}/${choice.id}`).toBeGreaterThanOrEqual(0);
          expect(v, `${key} вне шкалы в ${ev.id}/${choice.id}`).toBeLessThanOrEqual(100);
        }
        if (r.session.status === 'finished') {
          paths.count += 1;
          endings.add(choice.id);
        } else {
          step(r.session, depth + 1);
        }
      }
    };

    step(startSession(scenario), 0);
    return { paths: paths.count, endings, visited };
  }

  it('все пути конечны, все события достижимы, шкалы не ломаются', () => {
    const { paths, visited } = walkAll();
    expect(paths).toBeGreaterThan(50);
    expect(visited.size).toBe(scenario.events.length);
    // Перебор всего графа идёт около 4,5 с и не укладывается в общий предел
    // в 5 с, когда тесты идут вперемешку и воркеры загружены. Тогда тест
    // падал не по существу, а по времени, и это выглядело как поломка
    // сценария. Предел поднят осознанно: работа здесь честная, её не
    // ускорить без потери полноты перебора.
  }, 20000);

  it('есть хотя бы одна развилка по условию (Копорье при малом войске)', () => {
    const weak = { ...startSession(scenario), currentEventId: 'neva-koporye',
      resources: { ...scenario.resources, army: 10 } };
    const ev = scenario.events.find((e) => e.id === 'neva-koporye')!;
    const available = ev.choices.filter((c) => canShowChoice(weak, c));
    expect(available.length).toBe(1);
    expect(available[0]!.id).toBe('postpone');
  });
});

describe('прошлое влияет на настоящее', () => {
  const choices = scenario.events.flatMap((e) => e.choices);

  /** Пометки, которые сценарий где-то ставит. */
  function writtenFlags(): Set<string> {
    const out = new Set<string>();
    for (const c of choices) {
      for (const e of c.effects) if (e.type === 'flag') out.add(e.key);
    }
    return out;
  }

  /**
   * Пометки, которые сценарий где-то читает: условия на дверях плюс правила
   * финала. Эпилог читает прошлое наравне с событиями — «вы выбрали не бой,
   * а работу» — и без этого страж считал бы такие пометки брошенными.
   */
  function readFlags(): Set<string> {
    const out = new Set<string>();
    for (const c of choices) {
      for (const k of c.conditions ?? []) {
        if (k.type === 'flag_true' || k.type === 'flag_false') out.add(k.key);
      }
    }
    for (const e of ENDINGS) for (const k of e.requires ?? []) out.add(k);
    return out;
  }

  it('каждая пометка из прошлого кем-то читается', () => {
    // Так уже было: четырнадцать пометок ставились — «послал сторожу»,
    // «обошёлся с ижорой грубо», «взял серебро в долг» — и ни одна не
    // управляла ни одной дверью. Игра превращалась в коридор, где прошлое
    // ничего не решает, а игрок чувствует не выбор, а перелистывание.
    const silent = [...writtenFlags()].filter((k) => !readFlags().has(k));
    expect(silent, `пометки ставятся, но ни на что не влияют: ${silent.join(', ')}`).toEqual([]);
  });

  it('условия ссылаются только на те пометки, которые кто-то ставит', () => {
    // Опечатка в имени пометки запирает дверь навсегда: условие не сбудется
    // никогда, и игрок увидит «недоступно» там, где должен был пройти.
    const written = writtenFlags();
    const unknown = [...readFlags()].filter((k) => !written.has(k));
    expect(unknown, `условия ждут пометок, которых никто не ставит: ${unknown.join(', ')}`).toEqual([]);
  });

  it('решений, зависящих от прошлого, не меньше десяти', () => {
    // Не ради числа: если условий снова станет одно на весь сценарий,
    // выбор опять выродится в перелистывание.
    const conditional = choices.filter((c) => c.conditions?.length);
    expect(conditional.length).toBeGreaterThanOrEqual(10);
  });

  it('у каждой закрытой двери есть объяснение, а не отговорка', () => {
    const vague: string[] = [];
    for (const e of scenario.events) {
      for (const c of e.choices) {
        for (const k of c.conditions ?? []) {
          if ((k.type === 'flag_true' || k.type === 'flag_false') && !k.note) {
            vague.push(`${e.id}/${c.id}: ${k.key}`);
          }
        }
      }
    }
    expect(vague, `двери без объяснения: ${vague.join(', ')}`).toEqual([]);
  });
});
