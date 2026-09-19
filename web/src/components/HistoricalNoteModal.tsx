import { useEffect, useRef } from 'react';
import type { ScenarioEvent } from '@nevsky/core';
import { CERTAINTY_META } from '../lib/certainty';
import Icon from './Icon';
import Illustration from './Illustration';

/**
 * Справка. Здесь честность продукта видна целиком: что говорит источник,
 * насколько твёрдо мы это знаем и где начинается наша реконструкция.
 */
export default function HistoricalNoteModal({
  event, onClose,
}: { event: ScenarioEvent; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const meta = CERTAINTY_META[event.certainty];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Что известно: ${event.title}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-2xl overflow-auto p-5 shadow-2xl sm:p-7"
        style={{
          background: 'var(--color-paper)',
          border: '2px solid #4a382624',
          borderRadius: '18px 7px 20px 8px',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="font-serif text-2xl">{event.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">Что об этом известно</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть справку"
            className="tappable bark-btn -mr-2 -mt-2 inline-flex items-center gap-1.5 px-3 py-2 text-sm text-ink-soft"
          >
            <Icon name="cross" size={16} />
            Закрыть
          </button>
        </div>

        {event.historicalNote && (
          <p className="mt-4 leading-relaxed">{event.historicalNote}</p>
        )}

        {/* Подлинник — в справке подробно: с автором, датой и лицензией.
            Здесь и только здесь их можно прочитать целиком. */}
        {event.illustration && <Illustration data={event.illustration} variant="note" />}

        <div
          className="mt-5 border-l-4 bg-paper-2 p-3"
          style={{ borderColor: meta.color, borderRadius: '14px 6px 13px 5px' }}
        >
          <div className="text-sm font-semibold" style={{ color: meta.color }}>
            {meta.label} — {meta.hint}
          </div>
          {event.certainty === 'legend' && (
            <p className="mt-1 text-sm text-ink-soft">
              Рассказ ведётся по житию — тексту, написанному, чтобы прославить князя.
              Событие было, а подробности принимать на веру целиком нельзя.
            </p>
          )}
          {event.certainty === 'guess' && (
            <p className="mt-1 text-sm text-ink-soft">
              Здесь источники молчат, и решение опирается на наше предположение.
              Возможен другой ответ — и мы это показываем, а не прячем.
            </p>
          )}
        </div>

        <div className="mt-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Icon name="list" size={16} />
            Откуда это известно
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            {event.sources.map((s) => (
              <li key={s} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-soft" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-sm text-ink-soft" style={{ borderTop: '2px dashed #4a38262e', paddingTop: '1rem' }}>
          Часть сведений о событиях 1240 года источники просто не описывают. Всё, что
          в игре опирается на предположение, помечено статусом «предание» или «догадка»
          — и это не недостаток, а то, что о том годе известно на самом деле.
        </p>
      </div>
    </div>
  );
}
