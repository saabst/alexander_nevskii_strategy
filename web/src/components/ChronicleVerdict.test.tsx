import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { scenarios } from '@nevsky/core';
import ChronicleVerdictBlock from './ChronicleVerdict';

const scenario = scenarios[0]!;
const byId = (id: string) => scenario.events.find((e) => e.id === id)!;

function src(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('знак «как у князя»', () => {
  it('на ход князя отвечает «так и было»', () => {
    render(<ChronicleVerdictBlock event={byId('neva-flot')} choiceId="attacknow" />);
    expect(screen.getByText('Так и было')).toBeDefined();
  });

  it('на чужой ход — «так не было» и назван ход князя', () => {
    render(<ChronicleVerdictBlock event={byId('neva-flot')} choiceId="waitmorning" />);
    expect(screen.getByText('Так не было')).toBeDefined();
    // Сказать «так не было» и не сказать, как было, — оставить игрока ни с чем.
    expect(screen.getByText('Ударить немедля, не дожидаясь рассвета')).toBeDefined();
  });

  it('где источники молчат, там и знак молчит — без приговора игроку', () => {
    render(<ChronicleVerdictBlock event={byId('neva-ladoga')} choiceId="byliver" />);
    expect(screen.getByText('Летопись об этом молчит')).toBeDefined();
    expect(screen.queryByText('Так не было')).toBeNull();
    expect(screen.getByText(/проверить его нечем/)).toBeDefined();
  });

  it('ответа нет на кнопках выбора — иначе выбирать станет нечего', () => {
    // Это не проверка разметки, а защита игры: стоит показать верный ход
    // до выбора, и от выбора останется чтение ответов.
    const choice = src('src/components/ChoiceButton.tsx');
    const play = src('src/screens/PlayScreen.tsx');
    for (const [name, text] of [['ChoiceButton', choice], ['PlayScreen', play]] as const) {
      expect(text, `${name}: вердикт просочился на экран выбора`)
        .not.toMatch(/ChronicleVerdictBlock|chronicleVerdict|canonicalChoiceOf/);
    }
  });

  it('вердикт показывается на экране последствий', () => {
    const outcome = src('src/components/OutcomePanel.tsx');
    expect(outcome).toMatch(/ChronicleVerdictBlock/);
  });
});
