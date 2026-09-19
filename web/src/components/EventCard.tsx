import type { ScenarioEvent } from '@nevsky/core';
import { CERTAINTY_META } from '../lib/certainty';
import Icon from './Icon';
import Illustration from './Illustration';

/**
 * Карточка события. Статус знания стоит рядом с заголовком, а не в сноске:
 * игрок должен видеть, читает он документ или житие, ещё до того как прочёл текст.
 */
export default function EventCard({
  event, onOpenNote,
}: { event: ScenarioEvent; onOpenNote: () => void }) {
  const meta = CERTAINTY_META[event.certainty];
  return (
    <article>
      <div className="flex flex-wrap items-center gap-2">
        <span className="bark-mark text-xs font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <span className="text-xs text-ink-soft">{meta.hint}</span>
      </div>

      <h1 className="mt-3 font-serif text-3xl leading-tight">{event.title}</h1>
      {event.location && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
          <Icon name="pin" size={15} />
          {event.location.name}
        </p>
      )}

      <p className="mt-4 text-lg leading-relaxed">{event.text}</p>

      {event.illustration && <Illustration data={event.illustration} />}

      <button
        type="button"
        onClick={onOpenNote}
        className="tappable bark-btn mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
      >
        <Icon name="book" size={16} />
        Что об этом известно
      </button>
    </article>
  );
}
