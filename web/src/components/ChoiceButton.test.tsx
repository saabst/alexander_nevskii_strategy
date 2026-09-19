import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { scenarios, startSession, type Session } from '@nevsky/core';
import ChoiceButton from './ChoiceButton';

const scenario = scenarios[0]!;

describe('вариант решения', () => {
  it('показывает последствия доступного варианта', () => {
    const choice = scenario.events[0]!.choices[0]!;
    render(<ChoiceButton choice={choice} session={startSession(scenario)} onSelect={() => {}} />);
    expect(screen.getByRole('button')).toBeEnabled();
    expect(screen.getByText('войско -5')).toBeInTheDocument();
    expect(screen.getByText('авторитет +4')).toBeInTheDocument();
  });

  it('недоступный вариант остаётся на экране с причиной', () => {
    const session = { ...startSession(scenario), resources: { ...scenario.resources, army: 10 } } as Session;
    const koporye = scenario.events.find((e) => e.id === 'neva-koporye')!;
    const choice = koporye.choices.find((c) => c.id === 'takekoporye')!;
    render(<ChoiceButton choice={choice} session={session} onSelect={() => {}} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    // причина написана для человека, а не кодом условия
    expect(screen.getByText(/Недоступно: нужно войско не меньше 32/)).toBeInTheDocument();
  });

  it('нажатие доступного варианта вызывает выбор', async () => {
    const choice = scenario.events[0]!.choices[0]!;
    const onSelect = vi.fn();
    render(<ChoiceButton choice={choice} session={startSession(scenario)} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(choice);
  });
});
