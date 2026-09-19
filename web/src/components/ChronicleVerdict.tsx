import { canonicalChoiceOf, chronicleVerdict, type ScenarioEvent } from '@nevsky/core';
import { CHRONICLE_META } from '../lib/chronicle';
import Icon from './Icon';

/**
 * Знак «как у князя» — главное, что игрок должен унести из решения.
 *
 * Ответ на вопрос «а так ли было» показывается ТОЛЬКО после выбора. Показать
 * его на кнопках значило бы превратить игру в чтение ответов: верный ход
 * виден, выбирать нечего. А после выбора это уже не подсказка, а урок.
 *
 * Когда князь поступил иначе, мы называем и его ход: сказать «так не было»
 * и не сказать, как было, — это оставить игрока ни с чем.
 */
export default function ChronicleVerdictBlock({
  event, choiceId,
}: {
  event: ScenarioEvent;
  choiceId: string;
}) {
  const verdict = chronicleVerdict(event, choiceId);
  const meta = CHRONICLE_META[verdict];
  const asPrince = canonicalChoiceOf(event);

  return (
    <div
      className="mt-4 p-3"
      style={{
        background: 'var(--color-paper-2)',
        borderLeft: `4px solid ${meta.color}`,
        borderRadius: '14px 6px 13px 5px',
      }}
    >
      <p className="flex items-center gap-2 font-semibold" style={{ color: meta.color }}>
        <span aria-hidden="true">{meta.mark}</span>
        {meta.label}
      </p>
      <p className="mt-1 text-sm">{meta.hint}.</p>

      {verdict === 'not-as-prince' && asPrince && (
        <p className="mt-2 text-sm">
          <span className="text-ink-soft">Князь поступил так: </span>
          <span className="font-medium">{asPrince.title}</span>
        </p>
      )}

      {verdict === 'silent' && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
          <Icon name="book" size={14} className="mt-0.5 shrink-0" />
          <span>
            Это не значит, что ход неверен: значит, что проверить его нечем.
            Проверить это можно в справке — там сказано, откуда мы взяли сам ход.
          </span>
        </p>
      )}
    </div>
  );
}
