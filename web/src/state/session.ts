import { create } from 'zustand';
import {
  applyChoice, deserializeSession, getCurrentEvent, scenarios, serializeSession, startSession,
  type Choice, type Resources, type Scenario, type ScenarioEvent, type Session,
} from '@nevsky/core';

/** Пока кампания одна, сценарий берётся из пакета. Вторая кампания — этап 3. */
export const CURRENT_SCENARIO: Scenario = scenarios[0]!;

const storageKey = (scenarioId: string) => `nevsky.session.${scenarioId}`;

/** localStorage может быть недоступен (приватный режим) — тогда играем без сохранения. */
function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__nevsky_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): boolean {
  const st = safeStorage();
  if (!st) return false;
  try {
    st.setItem(storageKey(session.scenarioId), serializeSession(session));
    return true;
  } catch {
    return false;
  }
}

export function loadSavedSession(scenarioId: string): Session | null {
  const st = safeStorage();
  if (!st) return null;
  return deserializeSession(st.getItem(storageKey(scenarioId)), { scenarioId });
}

export function clearSavedSession(scenarioId: string): void {
  safeStorage()?.removeItem(storageKey(scenarioId));
}

/**
 * Последствие только что принятого решения.
 *
 * Зачем отдельная запись, а не просто «сессия поехала дальше»: решение не
 * должно проваливаться в следующий текст без следа. Игрок обязан увидеть,
 * что именно сдвинулось, — иначе выбор неотличим от нажатия «далее».
 * Здесь держим состояние ДО и ПОСЛЕ, чтобы показать разницу честно.
 */
export interface PendingOutcome {
  choice: Choice;
  event: ScenarioEvent;
  before: Resources;
  after: Resources;
}

interface SessionState {
  session: Session;
  /** Есть незаконченное сохранение — предложить продолжить, а не молча его потерять. */
  resumable: Session | null;
  /** Решение принято, последствия ещё не просмотрены. */
  pendingOutcome: PendingOutcome | null;
  lastError: string | null;
  choose: (choiceId: string) => void;
  /** Пролистать последствия и вернуться к следующему событию. */
  advance: () => void;
  resume: () => void;
  startOver: () => void;
  dismissResume: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: startSession(CURRENT_SCENARIO),
  resumable: loadSavedSession(CURRENT_SCENARIO.id),
  pendingOutcome: null,
  lastError: null,

  choose: (choiceId) => {
    const { session } = get();
    const event = getCurrentEvent(session, CURRENT_SCENARIO);
    const result = applyChoice(session, CURRENT_SCENARIO, choiceId);
    if (result.rejected) {
      set({ lastError: 'Этот вариант сейчас недоступен' });
      return;
    }
    saveSession(result.session);
    if (result.session.status === 'finished') clearSavedSession(CURRENT_SCENARIO.id);
    set({
      session: result.session,
      lastError: null,
      resumable: null,
      pendingOutcome: event
        ? {
            choice: result.choice,
            event,
            before: session.resources,
            after: result.session.resources,
          }
        : null,
    });
  },

  advance: () => set({ pendingOutcome: null }),

  resume: () => {
    const saved = get().resumable ?? loadSavedSession(CURRENT_SCENARIO.id);
    if (saved) set({ session: saved, resumable: null, pendingOutcome: null });
  },

  startOver: () => {
    clearSavedSession(CURRENT_SCENARIO.id);
    set({
      session: startSession(CURRENT_SCENARIO),
      resumable: null,
      lastError: null,
      pendingOutcome: null,
    });
  },

  dismissResume: () => set({ resumable: null }),
}));
