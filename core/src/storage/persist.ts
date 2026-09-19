/**
 * Сохранение прохождения между визитами.
 *
 * Правила, от которых нельзя отступать:
 *  - никогда не бросать исключение наружу: битый localStorage не должен ломать игру;
 *  - любое несовпадение (версия схемы, другой сценарий, мусор) — это «сохранения нет»,
 *    а не «игра падает»;
 *  - восстанавливать только те поля, которые мы сами записали.
 */
import type { Session } from '../types/scenario';
import { RESOURCE_KEYS } from '../types/scenario';

/** Меняем, когда правим структуру сессии: старое сохранение просто перестанет читаться. */
export const SESSION_SCHEMA_VERSION = 1;

export interface StoredSession {
  v: number;
  scenarioId: string;
  savedAt: string;
  session: Session;
}

export function serializeSession(
  session: Session,
  now: () => string = () => new Date().toISOString(),
): string {
  const payload: StoredSession = {
    v: SESSION_SCHEMA_VERSION,
    scenarioId: session.scenarioId,
    savedAt: now(),
    session,
  };
  return JSON.stringify(payload);
}

function looksLikeSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<Session>;
  if (typeof s.currentEventId !== 'string') return false;
  if (!Array.isArray(s.history)) return false;
  if (!s.resources || typeof s.resources !== 'object') return false;
  const res = s.resources as unknown as Record<string, unknown>;
  return RESOURCE_KEYS.every((k) => typeof res[k] === 'number');
}

/**
 * Читает сохранение. Возвращает сессию или null — и ничего больше:
 * вызывающий код сам решает, предложить продолжить или начать заново.
 */
export function deserializeSession(
  raw: string | null | undefined,
  expected?: { scenarioId?: string },
): Session | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Partial<StoredSession>;
  if (p.v !== SESSION_SCHEMA_VERSION) return null;
  if (!looksLikeSession(p.session)) return null;
  if (expected?.scenarioId && p.session.scenarioId !== expected.scenarioId) return null;
  return p.session;
}
