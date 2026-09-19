/**
 * Набор значков. Никаких иконочных библиотек и эмодзи: каждая иконка — простой
 * контур, который читается в мелком размере, и всегда рядом русская подпись.
 * У иконки aria-hidden — смысл несёт текст, а не картинка.
 */
export type IconName =
  | 'shield' | 'coins' | 'crown' | 'scales' | 'flame'
  | 'book' | 'magnifier' | 'play' | 'eyeOff' | 'refresh'
  | 'exit' | 'pin' | 'check' | 'cross' | 'clock' | 'flag' | 'list'
  | 'arrow';

interface Def { d: string[]; fill?: boolean }

const ICONS: Record<IconName, Def> = {
  shield:   { d: ['M12 3l7 3v6c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6z'] },
  coins:    { d: ['M4 8c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z',
                  'M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8',
                  'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'] },
  crown:    { d: ['M4 17h16l-1.4-8-4.1 3.2L12 6l-2.5 6.2L5.4 9z', 'M4 20h16'] },
  scales:   { d: ['M12 4v16', 'M7 20h10', 'M5 9h14',
                  'M5 9l-2.6 5.2a3 3 0 006 0z', 'M19 9l-2.6 5.2a3 3 0 01-6 0z'] },
  flame:    { d: ['M12 3c2.2 4 5 5.2 5 9a5 5 0 01-10 0c0-1.9.9-3.2 2-4.2.4 1.1 1.4 2.1 3 2.2 0-2.1-1-4.3 0-7z'] },
  book:     { d: ['M4 5h9a3 3 0 013 3v11H7a3 3 0 01-3-3z', 'M16 8h4v11H7'] },
  magnifier:{ d: ['M11 4a7 7 0 100 14 7 7 0 000-14z', 'M16.2 16.2L21 21'] },
  play:     { d: ['M8 5.5v13l11-6.5z'], fill: true },
  eyeOff:   { d: ['M3 3l18 18', 'M10.6 6.2A9.3 9.3 0 0112 6c5 0 9 6 9 6a18 18 0 01-3.1 3.7',
                  'M6.2 8.3A17.6 17.6 0 003 12s4 6 9 6a9 9 0 003.6-.7'] },
  refresh:  { d: ['M20 11a8 8 0 10-2.3 6', 'M20 5v6h-6'] },
  exit:     { d: ['M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4', 'M10 8l-4 4 4 4', 'M6 12h9'] },
  pin:      { d: ['M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z', 'M12 10a2 2 0 100-4 2 2 0 000 4z'] },
  check:    { d: ['M4 12.5l5 5L20 6.5'] },
  cross:    { d: ['M5 5l14 14', 'M19 5L5 19'] },
  clock:    { d: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 7.5V12l3.2 2'] },
  flag:     { d: ['M6 21V4', 'M6 5h11l-1.6 3.4L17 12H6'] },
  list:     { d: ['M4 6h16', 'M4 12h16', 'M4 18h10'] },
  arrow:    { d: ['M4 12h15', 'M13 6l6 6-6 6'] },
};

export default function Icon({
  name, size = 18, className = '', style,
}: { name: IconName; size?: number; className?: string; style?: React.CSSProperties }) {
  const def = ICONS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 ${className}`}
      fill={def.fill ? 'currentColor' : 'none'}
      stroke={def.fill ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {def.d.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
