import type { Illustration as IllustrationData } from '@nevsky/core';
import { illustrationUrl } from '../lib/illustrations';
import Icon from './Icon';

/**
 * Подлинник с подписью.
 *
 * Картинка здесь — не украшение. Поэтому у неё всегда три части, и ни одну
 * нельзя выкинуть: сам предмет, что это такое, и откуда он взят (автор, дата,
 * лицензия, страница). Картинка без этих частей — это картинка из интернета,
 * за которую нельзя отвечать.
 *
 * Отдельно и заметно помечено, современна вещь событию или нет: миниатюра
 * XVI века о битве 1240 года — свидетельство о памяти, а не о битве, и
 * читатель обязан видеть разницу до того, как поверит.
 */
export default function Illustration({
  data, variant = 'card',
}: {
  data: IllustrationData;
  /** `card` — на карточке события, `note` — в справке, где подпись подробнее */
  variant?: 'card' | 'note';
}) {
  const url = illustrationUrl(data.file);
  if (!url) return null;

  // Обе пометки говорят об одном и том же: о самом свидетеле, а не о том,
  // как его сняли. Иначе «вещь» и «изображение» описывают разные вещи,
  // и читатель не понимает, что именно ему сообщили.
  const badge = data.contemporaneous
    ? { text: 'Свидетель той же эпохи', color: 'var(--color-fact)' }
    : { text: 'Свидетельство позднейших веков', color: 'var(--color-legend)' };

  return (
    <figure className="mt-4">
      <img
        src={url}
        alt={data.title}
        loading="lazy"
        className="w-full object-cover"
        style={{
          maxHeight: variant === 'card' ? '260px' : '340px',
          border: '1px solid #4a38262e',
          borderRadius: '14px 6px 13px 5px',
        }}
      />

      <figcaption className="mt-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className="bark-mark font-semibold"
            style={{ color: badge.color }}
          >
            {badge.text}
          </span>
          <span className="text-ink-soft">{data.title}</span>
        </p>

        {variant === 'note' ? (
          <>
            <p className="mt-1.5 text-sm leading-relaxed">{data.caption}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              {data.author} · {data.date} ·{' '}
              <a
                href={data.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
              >
                откуда взято
              </a>{' '}
              · лицензия{' '}
              <a
                href={data.licenseUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
              >
                {data.license}
              </a>
            </p>
          </>
        ) : (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
            <Icon name="book" size={13} />
            {data.date} · подробнее — в справке
          </p>
        )}
      </figcaption>
    </figure>
  );
}
