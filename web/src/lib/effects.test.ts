import { describe, expect, it } from 'vitest';
import { scenarios, startSession, type Choice, type Session } from '@nevsky/core';
import { blockedReason, describeEffects, toneOf } from './effects';

const scenario = scenarios[0]!;

describe('человекочитаемые последствия', () => {
  it('эффекты описываются по-русски и со знаком', () => {
    const choice = scenario.events[0]!.choices[0]!;
    const parts = describeEffects(choice.effects);
    expect(parts).toContain('войско -5');
    expect(parts).toContain('авторитет +4');
  });

  it('флаги игроку не показываются', () => {
    const withFlag: Choice = {
      id: 'x', title: 'x', nextEventId: null,
      effects: [
        { type: 'flag', key: 'scoutsSent', value: true },
        { type: 'resource', key: 'army', value: -3 },
      ],
    };
    expect(describeEffects(withFlag.effects)).toEqual(['войско -3']);
  });
});

describe('причина недоступности', () => {
  it('называет ресурс, порог и текущее значение', () => {
    const session = { resources: { ...scenario.resources, army: 10 }, flags: {} } as Session;
    const koporye = scenario.events.find((e) => e.id === 'neva-koporye')!;
    const choice = koporye.choices.find((c) => c.id === 'takekoporye')!;
    const reason = blockedReason(session, choice);
    expect(reason).toContain('войско');
    expect(reason).toContain('32');
    expect(reason).toContain('10');
  });

  it('у доступного варианта причины нет', () => {
    const session = startSession(scenario);
    expect(blockedReason(session, scenario.events[0]!.choices[0]!)).toBeNull();
  });
});

describe('тон шкалы', () => {
  it('у давлений и у ресурсов логика противоположная', () => {
    expect(toneOf('army', 80)).toBe('good');
    expect(toneOf('army', 20)).toBe('bad');
    expect(toneOf('westernThreat', 20)).toBe('good');
    expect(toneOf('westernThreat', 80)).toBe('bad');
  });
});
