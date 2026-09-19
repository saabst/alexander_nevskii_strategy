import type { Choice, Session } from '@nevsky/core';
import { describeEffects, blockedReason } from '../lib/effects';
import Icon from './Icon';

/**
 * Вариант решения. Недоступный вариант остаётся на экране и объясняет причину:
 * спрятанный вариант игрок читает как поломку, а объяснённый — как правило игры.
 */
export default function ChoiceButton({
  choice, session, onHover, onSelect,
}: {
  choice: Choice;
  session: Session;
  onHover?: (choice: Choice | null) => void;
  onSelect: (choice: Choice) => void;
}) {
  const reason = blockedReason(session, choice);
  const blocked = reason !== null;
  const deltas = describeEffects(choice.effects);

  return (
    <button
      type="button"
      disabled={blocked}
      aria-disabled={blocked}
      onMouseEnter={() => !blocked && onHover?.(choice)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => !blocked && onHover?.(choice)}
      onBlur={() => onHover?.(null)}
      onClick={() => !blocked && onSelect(choice)}
      className={`tappable bark-choice w-full text-left ${blocked ? 'cursor-not-allowed opacity-70' : ''}`}
    >
      <div className="font-semibold leading-snug">{choice.title}</div>
      {choice.description && (
        <div className="mt-1 text-sm text-ink-soft">{choice.description}</div>
      )}

      {deltas.length > 0 && !blocked && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
          {deltas.map((d) => (
            <li key={d} className="bark-note tabular-nums">{d}</li>
          ))}
        </ul>
      )}

      {blocked && (
        <div className="mt-2 flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-guess)' }}>
          <Icon name="cross" size={15} />
          Недоступно: {reason}
        </div>
      )}
    </button>
  );
}
