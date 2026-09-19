import { describe, expect, it } from 'vitest';
import { applyChoice, getCurrentEvent, scenarios, startSession } from '@nevsky/core';

/**
 * Страховка от расхождения пакетов: интерфейс обязан получать рабочий движок,
 * а не пустую заглушку. Если этот тест упал — сломана связь core ↔ web.
 */
describe('связь web с движком @nevsky/core', () => {
  it('сценарий приходит из пакета и проходится на один шаг', () => {
    const scenario = scenarios[0]!;
    expect(scenario.events.length).toBeGreaterThanOrEqual(10);

    const start = startSession(scenario);
    expect(getCurrentEvent(start, scenario)?.id).toBe(scenario.startEventId);

    const first = getCurrentEvent(start, scenario)!;
    const next = applyChoice(start, scenario, first.choices[0]!.id).session;
    expect(next.history).toHaveLength(1);
    expect(next.currentEventId).not.toBe(start.currentEventId);
  });
});
