import { Link } from 'react-router-dom';
import { scenarios } from '@nevsky/core';
import KnowledgeChips from '../components/KnowledgeChips';
import { DIFFICULTY_LABEL } from '../lib/certainty';

export default function HomeScreen() {
  const scenario = scenarios[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm uppercase tracking-[0.18em] text-ink-soft">Июль 1240 года</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
        Вы — князь девятнадцати лет, и у вас есть одна ночь на решение
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-soft">
        Шведские суда вошли в Неву. Вы принимаете решения за Александра Ярославича: выступить
        или ждать, ударить или договориться. Каждое решение меняет войско, казну, авторитет
        и тревогу на двух границах. В конце вы увидите, что получилось — и что об этом
        известно на самом деле.
      </p>

      {scenario && (
        <div className="mt-8 rounded-xl border border-line bg-paper-2 p-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-serif text-2xl">{scenario.title}</h2>
            <span className="text-sm text-ink-soft">{scenario.year} год</span>
          </div>
          <p className="mt-2 text-ink-soft">{scenario.fullDescription}</p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            <li>событий: <b className="text-ink">{scenario.events.length}</b></li>
            <li>сложность: <b className="text-ink">{DIFFICULTY_LABEL[scenario.difficulty]}</b></li>
            <li>время: <b className="text-ink">~{scenario.estimatedMinutes} мин</b></li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/play"
              className="tappable inline-flex items-center rounded-lg bg-ink px-5 py-3 font-semibold text-paper transition-opacity hover:opacity-90"
            >
              Начать прохождение
            </Link>
            <Link
              to="/scenarios"
              className="tappable inline-flex items-center rounded-lg border border-line px-5 py-3 font-semibold text-ink transition-colors hover:bg-paper-3"
            >
              Все сценарии
            </Link>
          </div>
        </div>
      )}

      <section className="mt-12">
        <h2 className="font-serif text-2xl">Как читать карту</h2>
        <p className="mt-2 text-ink-soft">
          У каждого утверждения на карте есть статус: насколько твёрдо мы это знаем.
          Это не украшение — по этим статусам можно отфильтровать карту и увидеть,
          что известно твёрдо, а что додумано.
        </p>
        <div className="mt-4">
          <KnowledgeChips />
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-line p-5">
        <h2 className="font-serif text-2xl">Честно о карте</h2>
        <p className="mt-2 leading-relaxed text-ink-soft">
          Географических карт русских земель XIII века не существует: первые карты этих мест
          появляются в XVI веке. Поэтому карта в игре — не старинный документ, а реконструкция,
          собранная из летописей, археологии и палеогеографии. Там, где источники молчат —
          а это место шведского стана и точное место боя, — карта показывает не одну уверенную
          точку, а несколько возможных с зоной неопределённости.
        </p>
      </section>
    </div>
  );
}
