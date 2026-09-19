import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Icon from './components/Icon';
import HomeScreen from './screens/HomeScreen';
import ScenariosScreen from './screens/ScenariosScreen';
import PlayScreen from './screens/PlayScreen';
import ReportScreen from './screens/ReportScreen';
import SourcesScreen from './screens/SourcesScreen';

const NAV = [
  { to: '/', label: 'Начало' },
  { to: '/scenarios', label: 'Сценарии' },
  { to: '/sources', label: 'Источники' },
];

export default function App() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-full sm:p-6">
      {/* Весь продукт — один лист коры: волокна, рваная кромка, фактура.
          Ширину ограничиваем, чтобы рваные боковые кромки были видны, а
          не уезжали за край окна. */}
      <div className="bark-sheet mx-auto flex min-h-full max-w-[1180px] flex-col">
        {/* Фактура коры поверх всего листа. Рисуется кодом, веса не добавляет. */}
        <div className="grain-layer" aria-hidden="true" />
        <header
          className="no-print relative flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 sm:px-10"
          style={{ borderBottom: '2px dashed #4a38262e' }}
        >
        <Link to="/" className="font-serif text-lg text-ink">
          Невский
          <span className="ml-2 text-xs text-ink-soft">Стратегия решений</span>
        </Link>
        <nav className="flex gap-1">
          {NAV.map((n) => {
            const on = n.to === '/' ? pathname === '/' : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`inline-flex min-h-11 items-center px-4 text-sm ${
                  on ? 'bark-btn-primary' : 'bark-btn text-ink-soft'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        {pathname.startsWith('/play') && (
          <Link
            to="/scenarios"
            className="bark-btn ml-auto inline-flex min-h-11 items-center gap-1.5 px-3 text-sm text-ink-soft"
          >
            <Icon name="exit" size={16} />
            Выйти из прохождения
          </Link>
        )}
        </header>

        <main className="relative flex-1">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/scenarios" element={<ScenariosScreen />} />
            <Route path="/play" element={<PlayScreen />} />
            <Route path="/report" element={<ReportScreen />} />
            <Route path="/sources" element={<SourcesScreen />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <footer
          className="no-print relative px-5 py-4 text-xs text-ink-soft sm:px-10"
          style={{ borderTop: '2px dashed #4a38262e' }}
        >
          Геометрия карты — Natural Earth 1:10 m, public domain. Тексты и реконструкции — наши;
          часть сведений источники не описывают, и в игре это помечено.
        </footer>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-serif text-3xl">Такой страницы нет</h1>
      <p className="mt-3 text-ink-soft">
        <Link to="/" className="underline">Вернуться к началу</Link>
      </p>
    </div>
  );
}
