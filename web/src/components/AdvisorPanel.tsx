import type { Advisor } from '@nevsky/core';
import { CERTAINTY_META } from '../lib/certainty';

/** Советники. У каждой реплики виден статус знания: это совет, а не факт. */
export default function AdvisorPanel({ advisors }: { advisors: Advisor[] }) {
  if (!advisors.length) return null;
  return (
    <ul className="space-y-2.5">
      {advisors.map((a) => {
        const meta = CERTAINTY_META[a.certainty];
        // Реплика советника — помета на поле, а не карточка: так она
        // читается как запись писца, а не как ещё один блок интерфейса.
        return (
          <li key={a.id} className="border-l-2 border-dashed border-line py-2 pl-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-serif text-lg font-semibold">{a.name}</span>
              <span className="text-xs text-ink-soft">{a.role}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed">{a.text}</p>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: meta.color }}>
              <span aria-hidden className="h-2 w-2 rotate-45" style={{ background: meta.color }} />
              {meta.label}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
