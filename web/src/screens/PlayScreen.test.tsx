import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { scenarios, startSession, type Session } from '@nevsky/core';
import PlayScreen from './PlayScreen';
import {
  CURRENT_SCENARIO, loadSavedSession, saveSession, useSessionStore,
} from '../state/session';

const scenario = scenarios[0]!;

const renderScreen = () =>
  render(
    <MemoryRouter>
      <PlayScreen />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().startOver();
});

describe('экран прохождения', () => {
  it('показывает первое событие, ресурсы и варианты', () => {
    renderScreen();
    expect(screen.getByRole('heading', { name: 'Тревожные вести' })).toBeInTheDocument();
    expect(screen.getByText('Что у вас есть')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Войско' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Выступить немедленно/i }).length).toBe(1);
  });

  it('объясняет шкалы давлений словами, а не только цифрой', () => {
    renderScreen();
    expect(screen.getByRole('meter', { name: 'Угроза с Запада' })).toBeInTheDocument();
    expect(screen.getAllByText(/тревожно|спокойно|опасно/).length).toBeGreaterThan(0);
  });

  it('выбор меняет ресурсы и переводит к следующему событию', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Выступить немедленно/i }));
    // между решением и следующим событием стоит разбор последствий
    await userEvent.click(screen.getByRole('button', { name: /Дальше/i }));

    expect(screen.getByRole('heading', { name: 'Ладога' })).toBeInTheDocument();
    const army = screen.getByRole('meter', { name: 'Войско' });
    expect(army).toHaveAttribute('aria-valuenow', '55');
    expect(screen.getByText('решений принято:')).toBeInTheDocument();
  });

  it('решение сохраняется и переживает перезагрузку страницы', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Выступить немедленно/i }));

    const saved = loadSavedSession(CURRENT_SCENARIO.id);
    expect(saved).not.toBeNull();
    expect(saved!.history).toHaveLength(1);
    expect(saved!.currentEventId).toBe('neva-ladoga');
  });

  it('недоступный вариант виден и объяснён', () => {
    const seeded: Session = {
      ...startSession(scenario),
      currentEventId: 'neva-koporye',
      resources: { ...scenario.resources, army: 10 },
    };
    saveSession(seeded);
    useSessionStore.setState({ session: seeded, resumable: null });
    renderScreen();

    expect(screen.getByRole('heading', { name: /Копорье/ })).toBeInTheDocument();
    expect(screen.getByText(/Недоступно: нужно войско не меньше 32/)).toBeInTheDocument();
  });

  it('справка открывается и показывает источник', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Что об этом известно/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Откуда это известно/i)).toBeInTheDocument();
    // источник указан дословно, а не общим упоминанием в тексте справки
    expect(
      screen.getByText('Новгородская первая летопись старшего извода (Синодальный список)'),
    ).toBeInTheDocument();
  });

  it('список решений показывает пройденное', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Выступить немедленно/i }));
    await userEvent.click(screen.getByRole('button', { name: /Дальше/i }));
    await userEvent.click(screen.getByRole('button', { name: /Мои решения/i }));
    expect(screen.getByText(/Тревожные вести/)).toBeInTheDocument();
  });

  it('предпросмотр не переживает смену события — шкала стоит там, где надо', async () => {
    // Пойманная ошибка: курсор наведён на вариант, вариант выбран, экран ушёл
    // вперёд — а панель продолжала показывать сдвиг от варианта, которого на
    // экране уже нет. Число врала не только подпись, но и сама шкала.
    renderScreen();
    const choice = screen.getByRole('button', { name: /Выступить немедленно/i });
    await userEvent.hover(choice);
    await userEvent.click(choice);
    await userEvent.click(screen.getByRole('button', { name: /Дальше/i }));

    const army = screen.getByRole('meter', { name: 'Войско' });
    expect(army).toHaveAttribute('aria-valuenow', '55');
    // две линии — основа и заполнение. Третья означала бы оставшуюся зарубку
    // предпросмотра, то есть обещание сдвига, которого уже не будет.
    expect(army.querySelectorAll('line')).toHaveLength(2);
  });
});

describe('экран последствий', () => {
  it('показывает, что решил игрок, что вышло и насколько сдвинулись шкалы', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Выступить немедленно/i }));

    expect(screen.getByRole('heading', { name: 'Что вы решили' })).toBeInTheDocument();
    expect(screen.getByText(/Выступить немедленно, не дожидаясь ополчения/)).toBeInTheDocument();
    expect(screen.getByText(/Ты велел трубить сбор/)).toBeInTheDocument();

    // сдвиг показан и словами, и числом: было 60, стало 55
    expect(screen.getByRole('meter', { name: 'Войско: было 60, стало 55' })).toBeInTheDocument();
    expect(screen.getByText('Что сдвинулось')).toBeInTheDocument();
  });

  it('объясняет, откуда взялось это решение, а не только показывает цифры', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Выступить немедленно/i }));

    // у варианта «выступить немедленно» статус — факт
    expect(screen.getByText('Этот ход источники описывают прямо.')).toBeInTheDocument();
  });

  it('решение не проваливается мимо разбора: без «Дальше» следующего события не видно', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Выступить немедленно/i }));

    expect(screen.queryByRole('heading', { name: 'Ладога' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Дальше/i }));
    expect(screen.getByRole('heading', { name: 'Ладога' })).toBeInTheDocument();
  });
});
