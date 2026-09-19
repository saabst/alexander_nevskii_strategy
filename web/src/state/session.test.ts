import { beforeEach, describe, expect, it } from 'vitest';
import { scenarios, startSession } from '@nevsky/core';
import { useSessionStore } from './session';

const scenario = scenarios[0]!;

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().startOver();
});

describe('хранилище сессии: последствия решения', () => {
  it('после выбора остаётся запись о последствиях, а не только продвинутая сессия', () => {
    useSessionStore.getState().choose('marchnow');

    const pending = useSessionStore.getState().pendingOutcome;
    expect(pending).not.toBeNull();
    expect(pending?.choice.id).toBe('marchnow');
    // состояние ДО и ПОСЛЕ — иначе сдвиг по шкалам показать нечем
    expect(pending?.before.army).toBe(60);
    expect(pending?.after.army).toBe(55);
    expect(pending?.event.id).toBe('neva-vesti');
  });

  it('«дальше» убирает последствия, но сессию не откатывает', () => {
    useSessionStore.getState().choose('marchnow');
    useSessionStore.getState().advance();

    expect(useSessionStore.getState().pendingOutcome).toBeNull();
    expect(useSessionStore.getState().session.currentEventId).toBe('neva-ladoga');
    expect(useSessionStore.getState().session.history).toHaveLength(1);
  });

  it('недоступный вариант не оставляет последствий и объясняет причину', () => {
    const seeded = {
      ...startSession(scenario),
      currentEventId: 'neva-koporye',
      resources: { ...scenario.resources, army: 10 },
    };
    useSessionStore.setState({ session: seeded, resumable: null, pendingOutcome: null });

    useSessionStore.getState().choose('takekoporye');

    const state = useSessionStore.getState();
    expect(state.pendingOutcome).toBeNull();
    expect(state.lastError).toBeTruthy();
    expect(state.session.history).toHaveLength(0);
    expect(state.session.currentEventId).toBe('neva-koporye');
  });

  it('решение, завершившее кампанию, всё равно показывает последствия первыми', () => {
    // последнее событие сценария: выбор должен довести до конца, но запись
    // о последствиях обязана остаться, иначе финал «прыгнет» мимо разбора
    const last = scenario.events[scenario.events.length - 1]!;
    const finishingChoice = last.choices.find((c) => c.nextEventId === null);
    expect(finishingChoice, `в событии «${last.id}» нет завершающего варианта`).toBeDefined();

    useSessionStore.setState({
      session: { ...startSession(scenario), currentEventId: last.id },
      resumable: null,
      pendingOutcome: null,
    });
    useSessionStore.getState().choose(finishingChoice!.id);

    const state = useSessionStore.getState();
    expect(state.session.status).toBe('finished');
    expect(state.pendingOutcome).not.toBeNull();
  });

  it('начать заново убирает и последствия', () => {
    useSessionStore.getState().choose('marchnow');
    useSessionStore.getState().startOver();

    const state = useSessionStore.getState();
    expect(state.pendingOutcome).toBeNull();
    expect(state.session.history).toHaveLength(0);
    expect(state.session.currentEventId).toBe(scenario.startEventId);
  });
});
