import type { Certainty } from '@nevsky/core';

/**
 * Подписи статусов знания. Одна точка правды для всего интерфейса:
 * и карта, и карточки советников, и отчёт берут цвета отсюда.
 */
export const CERTAINTY_META: Record<Certainty, { label: string; hint: string; color: string }> = {
  fact: {
    label: 'Факт',
    hint: 'есть в летописи или документе',
    color: 'var(--color-fact)',
  },
  recon: {
    label: 'Реконструкция',
    hint: 'вывод историков и археологии',
    color: 'var(--color-recon)',
  },
  legend: {
    label: 'Предание',
    hint: 'житие и сказание, не документ',
    color: 'var(--color-legend)',
  },
  guess: {
    label: 'Догадка',
    hint: 'спорно, возможен иной ответ',
    color: 'var(--color-guess)',
  },
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'легко',
  medium: 'средне',
  hard: 'трудно',
};
