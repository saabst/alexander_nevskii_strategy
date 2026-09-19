import { describe, expect, it } from 'vitest';
import rawScenario from '../content/scenarios/neva-1240.json';
import type { Scenario } from '../types/scenario';
import { applyChoice, startSession } from '../engine';
import {
  SESSION_SCHEMA_VERSION, deserializeSession, serializeSession,
} from './persist';

const scenario = rawScenario as unknown as Scenario;

describe('сохранение сессии', () => {
  it('переживает круг туда и обратно без потерь', () => {
    const session = applyChoice(startSession(scenario), scenario, 'marchnow').session;
    const restored = deserializeSession(serializeSession(session));
    expect(restored).toEqual(session);
  });

  it('чужой сценарий не подхватывается', () => {
    const session = startSession(scenario);
    const raw = serializeSession(session);
    expect(deserializeSession(raw, { scenarioId: 'ice-battle' })).toBeNull();
    expect(deserializeSession(raw, { scenarioId: scenario.id })).not.toBeNull();
  });

  it('битый JSON — это «нет сохранения», а не ошибка', () => {
    expect(deserializeSession('{это не json')).toBeNull();
    expect(deserializeSession('')).toBeNull();
    expect(deserializeSession(null)).toBeNull();
    expect(deserializeSession(undefined)).toBeNull();
    expect(deserializeSession('"строка"')).toBeNull();
    expect(deserializeSession('[]')).toBeNull();
  });

  it('старая версия схемы не читается', () => {
    const session = startSession(scenario);
    const stale = JSON.stringify({ v: SESSION_SCHEMA_VERSION - 1, session });
    expect(deserializeSession(stale)).toBeNull();
  });

  it('усечённое сохранение без ресурсов отбрасывается', () => {
    const session = startSession(scenario) as unknown as Record<string, unknown>;
    delete session.resources;
    const raw = JSON.stringify({ v: SESSION_SCHEMA_VERSION, session });
    expect(deserializeSession(raw)).toBeNull();
  });
});
