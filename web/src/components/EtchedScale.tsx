import { TONE_COLOR, type Tone } from '../lib/effects';

/**
 * Шкала-насечка: линия процарапана в коре штрихами, а не залита краской.
 *
 * Один компонент на весь интерфейс намеренно. В языке берёсты шкала — это
 * резец, и если где-то она останется гладкой заливкой, язык рассыплется.
 *
 * Приспособлено так, чтобы смысл не зависел от картинки: роль meter и
 * значения остаются на обёртке, а сама графика спрятана от чтения с экрана.
 */
export default function EtchedScale({
  value,
  tone,
  label,
  valueText,
  /** Отметка «здесь было до решения» — вертикальная зарубка. */
  pinAt,
  className = '',
}: {
  value: number;
  tone: Tone;
  label: string;
  valueText?: string;
  pinAt?: number;
  className?: string;
}) {
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
      aria-valuetext={valueText}
      className={className}
      style={{ color: TONE_COLOR[tone] }}
    >
      <svg
        className="bark-scale"
        viewBox="0 0 100 13"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <line className="rail" x1="0" y1="6.5" x2="100" y2="6.5" />
        <line className="fill" x1="0" y1="6.5" x2={value} y2="6.5" />
        {pinAt !== undefined && (
          <line className="pin" x1={pinAt} y1="1.5" x2={pinAt} y2="11.5" />
        )}
      </svg>
    </div>
  );
}
