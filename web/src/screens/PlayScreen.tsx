import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  calculateOutcome, getCurrentEvent, type Choice, type Resources,
} from '@nevsky/core';
import AdvisorPanel from '../components/AdvisorPanel';
import ChoiceButton from '../components/ChoiceButton';
import EventCard from '../components/EventCard';
import HistoricalNoteModal from '../components/HistoricalNoteModal';
import Icon from '../components/Icon';
import MapScroll from '../components/MapScroll';
import OutcomePanel from '../components/OutcomePanel';
import ResourcePanel from '../components/ResourcePanel';
import SessionBar from '../components/SessionBar';
import ThreatGauge from '../components/ThreatGauge';
import { describeEffects } from '../lib/effects';
import { CURRENT_SCENARIO, useSessionStore } from '../state/session';

/** Складывает эффекты варианта в предпросмотр «что станет со шкалами». */
function previewOf(choice: Choice | null): Partial<Resources> | undefined {
  if (!choice) return undefined;
  const out: Partial<Resources> = {};
  for (const e of choice.effects) {
    if (e.type === 'resource') out[e.key] = (out[e.key] ?? 0) + e.value;
  }
  return out;
}

export default function PlayScreen() {
  const { session, resumable, pendingOutcome, advance, choose, resume, startOver, dismissResume, lastError } =
    useSessionStore();
  const [hovered, setHovered] = useState<Choice | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const event = useMemo(() => getCurrentEvent(session, CURRENT_SCENARIO), [session]);

  // Наведение не должно пережить смену события. Иначе панель ресурсов
  // показывала бы предпросмотр от варианта, которого на экране уже нет,
  // и шкала стояла бы не там, где стоит на самом деле.
  useEffect(() => {
    setHovered(null);
  }, [session.currentEventId]);

  // Последствия идут первыми — в том числе когда решение завершило кампанию.
  // Решение не должно проваливаться в следующий экран без следа.
  if (pendingOutcome) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <OutcomePanel
          outcome={pendingOutcome}
          onNext={advance}
          nextLabel={session.status === 'finished' ? 'К итогу' : 'Дальше'}
        />
      </div>
    );
  }

  if (!event || session.status === 'finished') {
    const outcome = calculateOutcome(session, CURRENT_SCENARIO, CURRENT_SCENARIO.resources);
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-serif text-3xl">Прохождение завершено</h1>
        <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-soft">{outcome.summaryText}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/report"
            className="tappable bark-btn-primary inline-flex items-center gap-2 px-5 py-3 font-semibold"
          >
            <Icon name="book" size={17} />
            Итоговый отчёт
          </Link>
          <button
            type="button"
            onClick={startOver}
            className="tappable bark-btn inline-flex items-center gap-2 px-5 py-3 font-semibold"
          >
            <Icon name="refresh" size={17} />
            Пройти заново
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      {resumable && (
        <div className="bark-panel no-print mb-4 flex flex-wrap items-center gap-3 p-3 text-sm">
          <Icon name="clock" size={16} />
          <span>
            У вас есть незаконченное прохождение — <b>{resumable.history.length}</b> решений.
          </span>
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={resume}
              className="tappable bark-btn-primary px-3 py-2 font-semibold"
            >
              Продолжить
            </button>
            <button
              type="button"
              onClick={dismissResume}
              className="tappable bark-btn px-3 py-2"
            >
              Начать с начала
            </button>
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_310px] lg:gap-8">
        <div>
          <SessionBar
            decisions={session.history.length}
            historyOpen={historyOpen}
            onHistory={() => setHistoryOpen((v) => !v)}
            onRestart={startOver}
            onExit={() => setHistoryOpen(false)}
          />

          {historyOpen && (
            <ol className="bark-panel mt-4 space-y-2 p-3 text-sm">
              {session.history.length === 0 && (
                <li className="text-ink-soft">Пока ни одного решения.</li>
              )}
              {session.history.map((h, i) => (
                <li key={`${h.eventId}-${i}`} className="border-b border-line/60 pb-2 last:border-0">
                  <div className="text-ink-soft">{h.eventTitle}</div>
                  <div className="font-medium">{h.choiceTitle}</div>
                  {describeEffects(h.effects).length > 0 && (
                    <div className="text-xs text-ink-soft">{describeEffects(h.effects).join(' · ')}</div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {lastError && (
            <p className="bark-panel mt-4 flex items-center gap-2 p-3 text-sm">
              <Icon name="cross" size={15} style={{ color: 'var(--color-guess)' }} />
              {lastError}
            </p>
          )}

          <div className="mt-5">
            <EventCard event={event} onOpenNote={() => setNoteOpen(true)} />
          </div>

          {/* Карта идёт сразу за рассказом: она показывает то самое место,
              о котором текст, и путь, которым уже прошли. Карта — функция от
              хода игры: решения открывают на ней объекты. */}
          <MapScroll
            event={event}
            session={session}
            scenario={CURRENT_SCENARIO}
            className="mt-5"
          />

          <section className="mt-6">
            <h2 className="flex items-center gap-2 font-serif text-xl">
              <Icon name="list" size={18} />
              Советники
            </h2>
            <div className="mt-3">
              <AdvisorPanel advisors={event.advisors} />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="font-serif text-xl">Ваше решение</h2>
            <div className="mt-3 space-y-3">
              {event.choices.map((c) => (
                <ChoiceButton
                  key={c.id}
                  choice={c}
                  session={session}
                  onHover={setHovered}
                  onSelect={(ch) => {
                    setHovered(null);
                    choose(ch.id);
                  }}
                />
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="bark-panel p-4">
            <h2 className="flex items-center gap-2 font-serif text-lg">
              <Icon name="shield" size={17} />
              Что у вас есть
            </h2>
            <ResourcePanel resources={session.resources} preview={previewOf(hovered)} className="mt-3" />
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="flame" size={15} />
                Тревога на границах
              </h3>
              <ThreatGauge resources={session.resources} />
            </div>
          </div>

          {/* Заглушки здесь больше нет: карта стоит в основной колонке,
              сразу под рассказом. */}
        </aside>
      </div>

      {noteOpen && <HistoricalNoteModal event={event} onClose={() => setNoteOpen(false)} />}
    </div>
  );
}
