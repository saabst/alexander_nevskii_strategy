import { RESOURCE_KEYS, RESOURCE_META, type Certainty, type ResourceKey } from '@nevsky/core';
import EtchedScale from './EtchedScale';
import ChronicleVerdictBlock from './ChronicleVerdict';
import Icon, { type IconName } from './Icon';
import { CERTAINTY_META } from '../lib/certainty';
import { toneOf } from '../lib/effects';
import type { PendingOutcome } from '../state/session';

const ICON_OF: Partial<Record<ResourceKey, IconName>> = {
  army: 'shield',
  treasury: 'coins',
  authority: 'crown',
  stability: 'scales',
  westernThreat: 'flame',
  easternThreat: 'flame',
};

/**
 * Что значит этот статус знания именно для принятого решения.
 * Живёт рядом с экраном последствий, потому что здесь он читается иначе,
 * чем на карточке события: игрок уже сделал ход и вправе знать, откуда он взялся.
 */
const WHY: Record<Certainty, string> = {
  fact: 'Этот ход источники описывают прямо.',
  recon: 'Этот ход восстановлен по косвенным сведениям, а не описан дословно.',
  legend: 'Так рассказывает житие. Читать интересно, верить целиком нельзя.',
  guess: 'Этого хода в источниках нет: перед вами наша реконструкция.',
};

/** Шкала со сдвигом: зарубка остаётся там, где шкала стояла до решения. */
function Shift({ resourceKey, before, after }: { resourceKey: ResourceKey; before: number; after: number }) {
  const meta = RESOURCE_META[resourceKey];
  const delta = after - before;
  const icon: IconName = ICON_OF[resourceKey] ?? 'shield';

  return (
    <li>
      <div className="flex items-baseline gap-2">
        <Icon name={icon} size={16} className="text-ink-soft" />
        <span>{meta.label}</span>
        <span className="ml-auto tabular-nums text-ink-soft">{before}</span>
        <Icon name="arrow" size={14} className="text-ink-soft" />
        <span className="font-semibold tabular-nums">{after}</span>
        <span
          className="tabular-nums text-xs font-semibold"
          style={{ color: delta > 0 ? 'var(--color-fact)' : 'var(--color-guess)' }}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      </div>
      <EtchedScale
        value={after}
        pinAt={before}
        tone={toneOf(resourceKey, after)}
        label={`${meta.label}: было ${before}, стало ${after}`}
        className="mt-1"
      />
    </li>
  );
}

/**
 * Последствия решения. Показывается сразу после выбора и до следующего события.
 *
 * Смысл — не дать выбору пропасть: игрок видит свой ход, последствие, сдвиг
 * по шкалам и то, откуда это знание. Ничего не выдумываем: всё берём из
 * контента события и из состояния до/после.
 */
export default function OutcomePanel({
  outcome, onNext, nextLabel = 'Дальше',
}: {
  outcome: PendingOutcome;
  onNext: () => void;
  /** Если решение завершило кампанию, ведём не «дальше», а к итогу. */
  nextLabel?: string;
}) {
  const { choice, event, before, after } = outcome;
  const certainty = (choice.certainty ?? event.certainty) as Certainty;
  const meta = CERTAINTY_META[certainty];
  const changed = RESOURCE_KEYS.filter((k) => before[k] !== after[k]);

  return (
    <section aria-labelledby="outcome-heading">
      <p className="text-xs text-ink-soft">{event.title}</p>
      <h1 id="outcome-heading" className="mt-1 text-2xl leading-tight">
        Что вы решили
      </h1>
      <p className="mt-1 font-semibold leading-snug">{choice.title}</p>

      {/* Как поступил князь — сразу под своим ходом, а не в конце отчёта.
          Прежде это число жило только в итоговой строке, и за всю кампанию
          игрок ни разу не узнавал, чей ход он повторил, а чей — нет. */}
      <ChronicleVerdictBlock event={event} choiceId={choice.id} />

      {choice.outcomeText && (
        <p className="bark-panel mt-4 p-4 leading-relaxed">
          {choice.outcomeText}
        </p>
      )}

      <h2 className="mt-6 text-lg">Что сдвинулось</h2>
      {changed.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {changed.map((key) => (
            <Shift key={key} resourceKey={key} before={before[key]} after={after[key]} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-ink-soft">
          Запасы не изменились. Этот ход стоил не войска и не серебра.
        </p>
      )}

      <div
        className="mt-6 p-3"
        style={{
          background: 'var(--color-paper-2)',
          borderLeft: `4px solid ${meta.color}`,
          borderRadius: '14px 6px 13px 5px',
        }}
      >
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: meta.color }}>
          <span aria-hidden="true">◆</span>
          {meta.label}
          <span className="font-normal text-ink-soft">— {meta.hint}</span>
        </p>
        <p className="mt-1 text-sm">{WHY[certainty]}</p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="tappable bark-btn-primary mt-6 inline-flex items-center gap-2 px-5 py-3 font-semibold"
      >
        <Icon name="arrow" size={17} />
        {nextLabel}
      </button>
    </section>
  );
}
