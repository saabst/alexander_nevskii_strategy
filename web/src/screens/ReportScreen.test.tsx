import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  applyChoice, canShowChoice, getCurrentEvent, scenarios, startSession,
  type Session,
} from '@nevsky/core';
import ReportScreen from './ReportScreen';
import { useSessionStore } from '../state/session';

const scenario = scenarios[0]!;

/** Пройти кампанию, беря ход князя там, где он известен. */
function walkAsPrince(): Session {
  let session = startSession(scenario);
  let guard = 0;
  while (session.status === 'active' && guard < 60) {
    guard += 1;
    const event = getCurrentEvent(session, scenario)!;
    const choice = event.choices.find((c) => c.canonical)
      ?? event.choices.find((c) => canShowChoice(session, c))!;
    session = applyChoice(session, scenario, choice.id).session;
  }
  return session;
}

function show(session: Session) {
  useSessionStore.setState({ session, pendingOutcome: null, resumable: null });
  return render(
    <MemoryRouter>
      <ReportScreen />
    </MemoryRouter>,
  );
}

describe('итоговый отчёт', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('перечисляет решения, а не прячет их за одну цифру', () => {
    show(walkAsPrince());
    expect(screen.getByRole('heading', { name: 'Итоговый отчёт' })).toBeDefined();
    expect(screen.getAllByText(/Тревожные вести/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Бой на Неве/).length).toBeGreaterThan(0);
  });

  it('по каждому решению отвечает «как у князя»', () => {
    show(walkAsPrince());
    expect(screen.getAllByText(/Так и было/).length).toBeGreaterThan(0);
    // Разбор родов ответа идёт итоговой строкой под списком.
    expect(screen.getByText(/так и было/)).toBeDefined();
  });

  it('не прячет решения, о которых источники молчат', () => {
    show(walkAsPrince());
    expect(screen.getAllByText(/молчит/).length).toBeGreaterThan(0);
  });

  it('не оставляет игрока без разбора «где мы честно не знаем»', () => {
    show(walkAsPrince());
    expect(screen.getByText('Где мы честно не знаем')).toBeDefined();
  });

  it('у идеального игрока счёт совпадений полный, а не «шесть из одиннадцати»', () => {
    show(walkAsPrince());
    expect(screen.getByText(/3 из 3|4 из 4|5 из 5|6 из 6|7 из 7/)).toBeDefined();
  });
});
