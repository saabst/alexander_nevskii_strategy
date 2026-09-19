import Icon from './Icon';

/** Строка состояния прохождения: сколько решений позади и как выйти, не потеряв их. */
export default function SessionBar({
  decisions, onExit, onRestart, onHistory, historyOpen,
}: {
  decisions: number;
  onExit: () => void;
  onRestart: () => void;
  onHistory: () => void;
  historyOpen: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3 text-sm">
      <span className="flex items-center gap-1.5 text-ink-soft">
        <Icon name="check" size={15} />
        решений принято: <b className="text-ink">{decisions}</b>
      </span>

      <div className="ml-auto flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onHistory}
          aria-expanded={historyOpen}
          className="tappable bark-btn inline-flex items-center gap-1.5 min-h-11 px-3"
        >
          <Icon name="list" size={15} />
          Мои решения
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="tappable bark-btn inline-flex items-center gap-1.5 min-h-11 px-3"
        >
          <Icon name="refresh" size={15} />
          Начать заново
        </button>
        <button
          type="button"
          onClick={onExit}
          className="tappable bark-btn inline-flex items-center gap-1.5 min-h-11 px-3"
        >
          <Icon name="exit" size={15} />
          Выйти, сохранив
        </button>
      </div>
    </div>
  );
}
