import { Link } from 'react-router-dom';
import {
  RESOURCE_KEYS, RESOURCE_META, calculateOutcome, canonicalChoiceOf, chronicleVerdict,
  type ChronicleVerdict,
} from '@nevsky/core';
import Icon from '../components/Icon';
import { CHRONICLE_META } from '../lib/chronicle';
import { CURRENT_SCENARIO, useSessionStore } from '../state/session';

/**
 * Итоговый отчёт.
 *
 * Здесь кампания перестаёт быть игрой и становится разбором: каждое решение
 * показано рядом с тем, что об этом решении известно. Прежде этот экран был
 * заглушкой, и весь разбор — «а как было на самом деле» — пропадал: игрок
 * видел только число в конце.
 *
 * Порядок частей не случаен: сперва счёт, потом список решений с ответом
 * «как у князя или нет», затем то, что говорят источники, и в конце — то,
 * чего они не говорят. Молчание источника идёт последним, но идёт обязательно:
 * это не пустая графа, а половина того, что известно о 1240 годе.
 */
export default function ReportScreen() {
  const { session } = useSessionStore();
  const outcome = calculateOutcome(session, CURRENT_SCENARIO, CURRENT_SCENARIO.resources);

  const eventsById = new Map(CURRENT_SCENARIO.events.map((e) => [e.id, e]));
  const decisions = session.history.map((h) => {
    const event = eventsById.get(h.eventId);
    const verdict: ChronicleVerdict = event
      ? chronicleVerdict(event, h.choiceId)
      : 'silent';
    return { record: h, verdict, event };
  });

  const tally = decisions.reduce<Record<ChronicleVerdict, number>>(
    (acc, d) => ({ ...acc, [d.verdict]: acc[d.verdict] + 1 }),
    { 'as-prince': 0, 'not-as-prince': 0, silent: 0 },
  );

  const changed = RESOURCE_KEYS.filter(
    (k) => outcome.initialResources[k] !== outcome.finalResources[k],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs text-ink-soft">{CURRENT_SCENARIO.title}</p>
      <h1 className="mt-1 font-serif text-3xl">Итоговый отчёт</h1>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Score label="Состояние земель" value={outcome.score} />
        <Score
          label="Совпало с ходом князя"
          value={
            session.canonicalTotal > 0
              ? Math.round((session.canonicalHits / session.canonicalTotal) * 100)
              : 0
          }
          note={
            session.canonicalTotal > 0
              ? `${session.canonicalHits} из ${session.canonicalTotal}`
              : 'источники не говорят'
          }
        />
        <Score label="Решений принято" value={session.history.length} plain />
      </div>

      <p className="bark-panel mt-5 p-4 leading-relaxed">{outcome.summaryText}</p>

      {/* Главная часть отчёта: по каждому решению — что о нём известно. */}
      <section className="mt-7">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <Icon name="list" size={18} />
          Ваши решения и ход князя
        </h2>

        <p className="mt-2 text-sm text-ink-soft">
          Ответ на каждое решение даётся по источникам. «Так и было» — князь поступил
          так же. «Так не было» — поступил иначе. «Молчит» — о его ходе здесь
          не сказано ничего, и это не приговор вашему решению.
        </p>

        <ol className="mt-4 space-y-2">
          {decisions.map(({ record, verdict }, i) => {
            const meta = CHRONICLE_META[verdict];
            const asPrince = verdict === 'not-as-prince' && record.eventId
              ? canonicalChoiceOf(eventsById.get(record.eventId)!)
              : null;
            return (
              <li
                key={`${record.eventId}-${i}`}
                className="p-3"
                style={{
                  background: 'var(--color-paper-2)',
                  borderLeft: `4px solid ${meta.color}`,
                  borderRadius: '14px 6px 13px 5px',
                }}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs text-ink-soft">{i + 1}. {record.eventTitle}</span>
                  <span
                    className="bark-mark ml-auto text-xs font-semibold"
                    style={{ color: meta.color }}
                  >
                    {meta.mark} {meta.label}
                  </span>
                </div>
                <div className="mt-1 font-medium">{record.choiceTitle}</div>
                {asPrince && (
                  <div className="mt-1 text-sm">
                    <span className="text-ink-soft">У князя — </span>
                    <span>{asPrince.title}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <b style={{ color: CHRONICLE_META['as-prince'].color }}>✓ {tally['as-prince']}</b>
            {' — так и было'}
          </span>
          <span>
            <b style={{ color: CHRONICLE_META['not-as-prince'].color }}>✗ {tally['not-as-prince']}</b>
            {' — так не было'}
          </span>
          <span>
            <b style={{ color: CHRONICLE_META.silent.color }}>? {tally.silent}</b>
            {' — источники молчат'}
          </span>
        </p>
      </section>

      {changed.length > 0 && (
        <section className="mt-7">
          <h2 className="font-serif text-xl">Чем кончилось для земель</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {changed.map((k) => {
              const d = outcome.finalResources[k] - outcome.initialResources[k];
              return (
                <li key={k} className="flex items-baseline gap-2">
                  <span>{RESOURCE_META[k].label}</span>
                  <span className="text-ink-soft">было {outcome.initialResources[k]}</span>
                  <span className="ml-auto tabular-nums font-semibold">
                    {d > 0 ? '+' : '−'}{Math.abs(d)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {outcome.historicalNotes.length > 0 && (
        <section className="mt-7">
          <h2 className="flex items-center gap-2 font-serif text-xl">
            <Icon name="book" size={18} />
            Что говорит летопись
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            {outcome.historicalNotes.map((n) => (
              <li key={n} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-soft" />
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}

      {outcome.uncertaintyNotes.length > 0 && (
        <section className="mt-7">
          <h2 className="font-serif text-xl">Где мы честно не знаем</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
            {outcome.uncertaintyNotes.map((n) => (
              <li key={n} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-soft" />
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="no-print mt-8 flex flex-wrap gap-3">
        <Link to="/play" className="tappable bark-btn inline-flex items-center gap-2 px-5 py-3">
          <Icon name="arrow" size={17} />
          К прохождению
        </Link>
        <Link to="/sources" className="tappable bark-btn inline-flex items-center gap-2 px-5 py-3">
          <Icon name="book" size={17} />
          Источники
        </Link>
      </div>
    </div>
  );
}

/** Крупная цифра итога. `plain` — когда число не оценка, а счёт. */
function Score({
  label, value, note, plain = false,
}: { label: string; value: number; note?: string; plain?: boolean }) {
  return (
    <div className="bark-panel p-3">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-serif text-3xl tabular-nums">{value}</span>
        {!plain && <span className="text-sm text-ink-soft">из 100</span>}
      </div>
      {note && <div className="mt-0.5 text-xs text-ink-soft">{note}</div>}
    </div>
  );
}
