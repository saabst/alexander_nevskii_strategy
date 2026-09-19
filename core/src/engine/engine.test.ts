import { describe, it, expect } from 'vitest';
import rawScenario from '../content/scenarios/neva-1240.json';
import type { Scenario, Resources, Session } from '../types/scenario';
import {
  applyChoice, applyEffects, calculateOutcome, canShowChoice, checkCondition,
  clampResource, ENDINGS, getCurrentEvent, replay, scoreOf, startSession, RESOURCE_MAX, RESOURCE_MIN,
} from './index';

const scenario = rawScenario as unknown as Scenario;

function res(over: Partial<Resources> = {}): Resources {
  return {
    army: 50, treasury: 50, authority: 50, stability: 50,
    westernThreat: 50, easternThreat: 50, ...over,
  };
}

describe('шкала ресурсов', () => {
  it('обрезает снизу и сверху', () => {
    expect(clampResource(-10)).toBe(RESOURCE_MIN);
    expect(clampResource(500)).toBe(RESOURCE_MAX);
    expect(clampResource(55.4)).toBe(55);
    expect(clampResource(55.6)).toBe(56);
  });

  it('число ресурсов не выходит за 0..100 даже при жёстких эффектах', () => {
    const { resources } = applyEffects(res({ army: 8 }), {}, [
      { type: 'resource', key: 'army', value: -50 },
      { type: 'resource', key: 'treasury', value: +500 },
    ]);
    expect(resources.army).toBe(0);
    expect(resources.treasury).toBe(100);
  });
});

describe('условия', () => {
  it('resource_min / resource_max', () => {
    const s = { resources: res({ army: 30 }) } as Session;
    expect(checkCondition(s, { type: 'resource_min', key: 'army', value: 30 })).toBe(true);
    expect(checkCondition(s, { type: 'resource_min', key: 'army', value: 31 })).toBe(false);
    expect(checkCondition(s, { type: 'resource_max', key: 'army', value: 30 })).toBe(true);
  });

  it('флаги: false и отсутствие флага — одно и то же', () => {
    const s = { resources: res(), flags: {} } as Session;
    expect(checkCondition(s, { type: 'flag_false', key: 'hitFirst' })).toBe(true);
    expect(checkCondition(s, { type: 'flag_true', key: 'hitFirst' })).toBe(false);
  });

  it('вариант Копорья скрыт при малом войске', () => {
    const strong = { resources: res({ army: 40 }), flags: {} } as Session;
    const weak = { resources: res({ army: 20 }), flags: {} } as Session;
    const koporye = scenario.events.find((e) => e.id === 'neva-koporye')!;
    const choice = koporye.choices.find((c) => c.id === 'takekoporye')!;
    expect(canShowChoice(strong, choice)).toBe(true);
    expect(canShowChoice(weak, choice)).toBe(false);
  });
});

describe('жизненный цикл сессии', () => {
  it('старт: копия ресурсов, пустая история, активна', () => {
    const s = startSession(scenario);
    expect(s.resources).toEqual(scenario.resources);
    expect(s.history).toEqual([]);
    expect(s.status).toBe('active');
    expect(s.currentEventId).toBe(scenario.startEventId);
  });

  it('выбор меняет ресурсы и ведёт дальше', () => {
    let s = startSession(scenario);
    const before = { ...s.resources };
    const r = applyChoice(s, scenario, 'marchnow');
    expect(r.rejected).toBe(false);
    s = r.session;
    expect(s.currentEventId).toBe('neva-ladoga');
    expect(s.resources.army).toBe(before.army - 5);
    expect(s.resources.authority).toBe(before.authority + 4);
    expect(s.history).toHaveLength(1);
    expect(s.canonicalHits).toBe(1);
  });

  it('движок не мутирует входную сессию', () => {
    const s = startSession(scenario);
    const snapshot = JSON.stringify(s);
    applyChoice(s, scenario, 'marchnow');
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('недоступный выбор отбрасывается и состояние не трогает', () => {
    let s = startSession(scenario);
    s = { ...s, currentEventId: 'neva-koporye', resources: res({ army: 10 }) };
    const r = applyChoice(s, scenario, 'takekoporye');
    expect(r.rejected).toBe(true);
    expect(r.session).toBe(s);
    expect(r.session.history).toHaveLength(0);
  });

  it('флаги пишутся и читаются в следующих событиях', () => {
    const s = replay(scenario, ['sendscouts', 'trust']);
    expect(s.flags.scoutsSent).toBe(true);
    expect(s.flags.izhoraGuides).toBe(true);
  });

  it('неизвестный вариант — это ошибка, а не тихий пропуск', () => {
    const s = startSession(scenario);
    expect(() => applyChoice(s, scenario, 'нет-такого')).toThrow();
  });
});

describe('итоговый отчёт', () => {
  const canonicalPath = [
    'marchnow', 'byriver', 'towline', 'ignoreeast', 'attacknow', 'infirstrank',
    'mercy', 'honor', 'takekoporye', 'treaty', 'writeplain',
  ];
  const CANON_KEY = canonicalPath.join('>');

  /**
   * Все прохождения целиком: финал, счёт состояния земель и историчность.
   * Перебор идёт около секунды, а нужен нескольким проверкам — считаем один
   * раз, и каждая ищет по нему своё.
   */
  const RUNS: Array<{ path: string[]; ending: string; score: number; historicity: number }> = (() => {
    const out: Array<{ path: string[]; ending: string; score: number; historicity: number }> = [];
    const step = (s: Session, path: string[]) => {
      const ev = scenario.events.find((e) => e.id === s.currentEventId)!;
      for (const c of ev.choices.filter((ch) => canShowChoice(s, ch))) {
        const r = applyChoice(s, scenario, c.id);
        const next = [...path, c.id];
        if (r.session.status === 'finished') {
          const o = calculateOutcome(r.session, scenario, scenario.resources);
          out.push({ path: next, ending: o.endingId ?? 'default', score: o.score, historicity: o.historicityScore });
        } else {
          step(r.session, next);
        }
      }
    };
    step(startSession(scenario), []);
    return out;
  })();

  it('канонический путь доходит до финала', () => {
    const s = replay(scenario, canonicalPath);
    expect(s.status).toBe('finished');
    expect(s.finishedAt).toBeTruthy();
    expect(getCurrentEvent(s, scenario)).toBeNull();
  });

  it('отчёт собирается и не врёт о завершении', () => {
    const s = replay(scenario, canonicalPath);
    const o = calculateOutcome(s, scenario, scenario.resources);
    expect(o.completed).toBe(true);
    expect(o.score).toBeGreaterThanOrEqual(0);
    expect(o.score).toBeLessThanOrEqual(100);
    expect(o.totalChoices).toBe(canonicalPath.length);
    expect(o.summaryText).toContain('из 100');
    expect(o.historicalNotes.length).toBeGreaterThan(3);
  });

  it('путь по летописи ведёт к лучшему финалу — но он не единственный', () => {
    const canon = calculateOutcome(replay(scenario, canonicalPath), scenario, scenario.resources);
    expect(canon.endingId).toBe('nevsky');
    // Путь ищем перебором, а не вписываем руками. Вписанный устаревает при
    // первой же правке контента — и его правят «чтобы прошло», вместо того
    // чтобы проверить само обещание: к лучшему финалу ведёт не одна дорога.
    const alt = RUNS.find((r) => r.ending === 'nevsky' && r.path.join('>') !== CANON_KEY);
    expect(alt, 'к лучшему финалу ведёт только летописный путь').toBeTruthy();
  });

  it('историчность считается отдельно от успеха', () => {
    const canon = calculateOutcome(replay(scenario, canonicalPath), scenario, scenario.resources);
    expect(canon.historicityScore).toBe(100);
    // Меры независимы, и это проверяется, а не подразумевается: лучшее
    // состояние земель достигается НЕ летописным путём. Иначе «поступать как
    // князь» и «получить сильные земли» слились бы в одно решение, и игра
    // стала бы тестом на один правильный ответ.
    const best = RUNS.reduce((a, b) => (b.score > a.score ? b : a));
    expect(best.historicity).toBeLessThan(canon.historicityScore);
    expect(best.path.join('>')).not.toBe(CANON_KEY);
  });

  it('каждый эпилог достижим хотя бы одной дорогой', () => {
    // Эпилог «Орда» был написан автором и недостижим: восточная угроза не
    // могла дойти до порога, и целый финал лежал мёртвым текстом, который
    // никто и никогда не увидел бы.
    // «default» — не рассказ, а сетка на случай, если ни одно правило не
    // подошло. Она может и не сработать ни разу: это не потерянный текст,
    // а страховка от падения. Требуем достижимости от всех остальных.
    const NETS = ['default'];
    const reached = new Set(RUNS.map((r) => r.ending));
    const missing = ENDINGS.map((e) => e.id)
      .filter((id) => !NETS.includes(id) && !reached.has(id));
    expect(missing, `эпилоги, которых никто не увидит: ${missing.join(', ')}`).toEqual([]);
  });

  it('отчёт называет места, где мы честно не знаем', () => {
    const s = replay(scenario, canonicalPath);
    const o = calculateOutcome(s, scenario, scenario.resources);
    expect(o.uncertaintyNotes.length).toBeGreaterThan(0);
    expect(o.uncertaintyNotes.join(' ')).toMatch(/жити|молч|точност/i);
  });

  it('оценка состояния земель считается по весам и объяснима', () => {
    expect(scoreOf(res({ authority: 100, stability: 100, army: 100, treasury: 100,
      westernThreat: 0, easternThreat: 0 }))).toBe(100);
    expect(scoreOf(res({ authority: 0, stability: 0, army: 0, treasury: 0,
      westernThreat: 100, easternThreat: 100 }))).toBe(0);
  });

  it('эпилоги различаются по состоянию, а не по последнему нажатию', () => {
    const win = calculateOutcome(
      { ...replay(scenario, canonicalPath), resources: res({ authority: 80, army: 60, westernThreat: 20 }) },
      scenario, scenario.resources);
    expect(win.endingId).toBe('nevsky');

    const horde = calculateOutcome(
      { ...replay(scenario, canonicalPath), resources: res({ easternThreat: 90 }) },
      scenario, scenario.resources);
    expect(horde.endingId).toBe('horde');

    const cautious = calculateOutcome(
      { ...replay(scenario, canonicalPath), resources: res({ authority: 30, stability: 30 }) },
      scenario, scenario.resources);
    expect(cautious.endingId).toBe('cautious');
  });
});
