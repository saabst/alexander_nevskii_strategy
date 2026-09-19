import { describe, expect, it } from 'vitest';
import {
  applyChoice, calculateOutcome, canonicalChoiceOf, canShowChoice, chronicleVerdict,
  getCurrentEvent, scoreOf, startSession,
  type Scenario, type Session,
} from '../index';
import { scenarios } from '../index';

const scenario = scenarios[0]!;

/** Пройти кампанию, беря ход князя там, где он известен. */
function walkAsPrince(s: Scenario): Session {
  let session = startSession(s);
  let guard = 0;
  while (session.status === 'active' && guard < 60) {
    guard += 1;
    const event = getCurrentEvent(session, s)!;
    const choice = canonicalChoiceOf(event)
      ?? event.choices.find((c) => canShowChoice(session, c))!;
    session = applyChoice(session, s, choice.id).session;
  }
  return session;
}

describe('как поступил князь', () => {
  it('ход, который есть в источниках, называется ходом князя', () => {
    const event = scenario.events.find((e) => e.id === 'neva-flot')!;
    expect(chronicleVerdict(event, 'attacknow')).toBe('as-prince');
  });

  it('другой ход в том же событии — это «так не было»', () => {
    const event = scenario.events.find((e) => e.id === 'neva-flot')!;
    // Летопись знает, что князь ударил немедля. Значит, про ожидание
    // до утра можно сказать прямо: так он не поступил.
    expect(chronicleVerdict(event, 'waitmorning')).toBe('not-as-prince');
  });

  it('где летопись молчит — молчит и вердикт', () => {
    const event = scenario.events.find((e) => e.id === 'neva-ladoga')!;
    // О том, как дружина шла к Ладоге — рекой или берегом, — источники
    // не говорят. Объявить здесь «так не было» значило бы выдумать знание.
    for (const c of event.choices) {
      expect(chronicleVerdict(event, c.id)).toBe('silent');
    }
  });

  it('в кампании есть и то, и другое, и третье', () => {
    const seen = new Set<string>();
    for (const e of scenario.events) {
      for (const c of e.choices) seen.add(chronicleVerdict(e, c.id));
    }
    expect([...seen].sort()).toEqual(['as-prince', 'not-as-prince', 'silent']);
  });
});

describe('счёт совпадений с ходом князя', () => {
  it('у идеального игрока выходит 100, а не «шесть из одиннадцати»', () => {
    // Прежде в знаменатель попадали решения, где источники молчат: их нельзя
    // было угадать, и счёт занижался всегда. Такой счёт нельзя выиграть.
    const session = walkAsPrince(scenario);
    const outcome = calculateOutcome(session, scenario, scenario.resources);
    expect(session.canonicalTotal).toBeGreaterThan(0);
    expect(session.canonicalHits).toBe(session.canonicalTotal);
    expect(outcome.historicityScore).toBe(100);
  });

  it('в знаменатель идут только события, о которых источники говорят', () => {
    const session = walkAsPrince(scenario);
    const spokenFor = scenario.events.filter((e) => canonicalChoiceOf(e)).length;
    expect(session.canonicalTotal).toBeLessThanOrEqual(spokenFor);
    expect(session.canonicalTotal).toBeLessThan(scenario.events.length);
  });

  it('игрок, обошедший князя стороной, видит это в счёте', () => {
    let session = startSession(scenario);
    let guard = 0;
    while (session.status === 'active' && guard < 60) {
      guard += 1;
      const event = getCurrentEvent(session, scenario)!;
      const asPrince = canonicalChoiceOf(event);
      const other = event.choices.find(
        (c) => c.id !== asPrince?.id && canShowChoice(session, c),
      ) ?? asPrince ?? event.choices[0]!;
      session = applyChoice(session, scenario, other.id).session;
    }
    expect(session.canonicalHits).toBe(0);
    expect(session.canonicalTotal).toBeGreaterThan(0);
  });
});

describe('итог не говорит с игроком именами из кода', () => {
  it('в тексте итога русские названия шкал, а не army и westernThreat', () => {
    const session = walkAsPrince(scenario);
    const outcome = calculateOutcome(session, scenario, scenario.resources);
    expect(outcome.summaryText).not.toMatch(
      /\b(army|treasury|authority|stability|westernThreat|easternThreat)\b/,
    );
    expect(outcome.summaryText).toContain('состояния земель');
    // И русские названия шкал вместо имён переменных.
    expect(outcome.summaryText).toMatch(/Войско|Казна|Авторитет|Стабильность|Угроза/);
  });

  it('итог прямо говорит, что часть решений проверить нечем', () => {
    const session = walkAsPrince(scenario);
    const outcome = calculateOutcome(session, scenario, scenario.resources);
    expect(outcome.summaryText).toMatch(/не описывают|неизвестно/);
  });

  it('состояние земель считается по шкалам', () => {
    const session = walkAsPrince(scenario);
    expect(scoreOf(session.resources)).toBeGreaterThan(0);
  });
});
