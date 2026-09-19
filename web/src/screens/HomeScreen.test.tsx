import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { scenarios } from '@nevsky/core';
import HomeScreen from './HomeScreen';

describe('главный экран', () => {
  it('показывает данные сценария из пакета @nevsky/core', () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );

    const scenario = scenarios[0]!;
    expect(screen.getByRole('heading', { name: /князь девятнадцати лет/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: scenario.title })).toBeInTheDocument();
    // число событий берётся из контента, а не вписано в вёрстку
    expect(screen.getByText(String(scenario.events.length))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /начать прохождение/i })).toHaveAttribute('href', '/play');
  });

  it('объясняет четыре статуса знания', () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );
    for (const label of ['Факт', 'Реконструкция', 'Предание', 'Догадка']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
