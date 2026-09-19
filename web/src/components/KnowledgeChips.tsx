import { CERTAINTY_META } from '../lib/certainty';

/** Четыре статуса знания — единственная намеренно яркая часть интерфейса. */
export default function KnowledgeChips({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {Object.entries(CERTAINTY_META).map(([key, m]) => (
        <li key={key} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rotate-45"
            style={{ background: m.color }}
          />
          <span>
            <b className="font-semibold">{m.label}</b>
            {!compact && <span className="text-ink-soft"> — {m.hint}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
