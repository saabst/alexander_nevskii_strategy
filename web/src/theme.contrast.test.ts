import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Страж темы «береста».
 *
 * Читаемость здесь не «на глаз»: цвета подобраны численно под норму WCAG AA
 * и проверяются этим тестом. Смысл стража — не дать молча испортить контраст
 * при следующей правке палитры. Если тест упал, не подгоняйте порог: считайте
 * новый цвет (порядок счёта описан в комментариях index.css).
 *
 * Считаем по ХУДШЕМУ фону: один и тот же цвет ходит и по листу, и по подложке,
 * и по фону наведения, поэтому проверяются все три.
 *
 * CSS читается с диска, а не импортом: vitest заглушает CSS-модули, и «?raw»
 * вернул бы пустую строку — тест был бы зелёным и бесполезным.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'index.css'), 'utf8');

/** Достаём значения токенов прямо из @theme — единственного источника правды. */
function readColorTokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
    const name = m[1];
    const value = m[2];
    if (name && value) out[name] = value.toLowerCase();
  }
  return out;
}

function token(name: string): string {
  const value = readColorTokens()[name];
  if (!value) throw new Error(`в теме «береста» нет токена --color-${name}`);
  return value;
}

function channel(v: number): number {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Фоны, по которым реально ходят наши цвета. */
const BACKGROUNDS = ['paper', 'paper-2', 'paper-3'];

/** Всё, чем набирается текст. Норма AA для мелкого текста — 4,5:1. */
const TEXT_ROLES = [
  'ink',
  'ink-soft',
  'accent',
  'accent-2',
  'fact',
  'recon',
  'legend',
  'guess',
  'gold',
];

const TEXT_MIN = 4.5;
/** Границы кнопок и полей — элемент управления, норма 3:1. */
const NON_TEXT_MIN = 3;

describe('тема «береста»: палитра объявлена', () => {
  it('все нужные роли есть в теме', () => {
    const missing = [...TEXT_ROLES, ...BACKGROUNDS, 'line-strong'].filter((name) => {
      try {
        token(name);
        return false;
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });

  it('цвета заданы шестизначным hex', () => {
    for (const [name, value] of Object.entries(readColorTokens())) {
      expect(value, `токен ${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('тема «береста»: читаемость', () => {
  it(`текстовые роли проходят ${TEXT_MIN}:1 на всех фонах листа`, () => {
    const failures: string[] = [];
    for (const role of TEXT_ROLES) {
      for (const bg of BACKGROUNDS) {
        const ratio = contrast(token(role), token(bg));
        if (ratio < TEXT_MIN) failures.push(`${role} на ${bg} — ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it(`границы интерактивных элементов проходят ${NON_TEXT_MIN}:1`, () => {
    const failures = BACKGROUNDS.flatMap((bg) => {
      const ratio = contrast(token('line-strong'), token(bg));
      return ratio < NON_TEXT_MIN ? [`line-strong на ${bg} — ${ratio.toFixed(2)}:1`] : [];
    });
    expect(failures).toEqual([]);
  });

  it('основной текст заметно отличается от второстепенного, иначе иерархия слепая', () => {
    const main = contrast(token('ink'), token('paper'));
    const soft = contrast(token('ink-soft'), token('paper'));
    expect(main - soft).toBeGreaterThan(0.5);
  });

  it('каждый статус знания читается сам по себе, а не только подписью', () => {
    for (const s of ['fact', 'recon', 'legend', 'guess']) {
      expect(contrast(token(s), token('paper')), `статус ${s}`).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });
});

describe('тема «береста»: обязательства по весу и офлайну', () => {
  it('в стилях нет растровых картинок — фактура рисуется кодом', () => {
    const raster = css.match(/url\([^)]*\.(png|jpe?g|webp|gif)/gi);
    expect(raster, `найдены растровые текстуры: ${raster?.join(', ')}`).toBeNull();
  });

  it('ничего не тянется из сети — сборка обязана открываться с флешки', () => {
    const remote = css.match(/url\(\s*['"]?https?:\/\//gi);
    expect(remote, `внешние ресурсы: ${remote?.join(', ')}`).toBeNull();
  });

  it('шрифт подключён локальным woff2', () => {
    expect(css).toMatch(/@font-face/);
    expect(css).toMatch(/src:\s*url\(["']\.\/fonts\/[a-z0-9-]+\.woff2["']\)/);
  });

  it('в печать уходит белый фон без фактуры и без обводки', () => {
    const printBlock = css.slice(css.indexOf('@media print'));
    expect(printBlock).toContain('.grain-layer');
    expect(printBlock).toContain('display: none');
    expect(printBlock).toMatch(/-webkit-text-stroke:\s*0/);
    expect(printBlock).toContain('background: #fff');
  });

  it('лист не теряет материал: волокна коры и рваная кромка на месте', () => {
    // Пойманная ошибка: цвета и шрифт перенесли, а материал — нет, и продукт
    // стал «бежевым сайтом с рукописным шрифтом». Материал — часть языка,
    // поэтому за ним следим отдельно.
    const sheet = css.match(/\.bark-sheet\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(sheet, 'волокна коры').toMatch(/repeating-linear-gradient/);
    expect(sheet, 'рваная кромка').toMatch(/clip-path:\s*polygon/);
  });

  it('фактура лежит на листе и обрезается вместе с ним, а не поверх окна', () => {
    // Был fixed: шум вылезал за рваную кромку прямо на подложку.
    const grain = css.match(/\.grain-layer\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(grain).toMatch(/position:\s*absolute/);
    expect(grain).not.toMatch(/position:\s*fixed/);
  });

  it('цель нажатия пальцем объявлена не меньше 44 px', () => {
    expect(css).toMatch(/min-height:\s*44px/);
  });

  it('толщина письма стоит на самом body, а не отдельным классом', () => {
    // Пойманная ошибка: обводка была классом .carved, компоненты его не
    // получили — текст вышел худым, хотя в пробе был плотным. Толщина здесь
    // язык всего продукта, поэтому обязана висеть на body.
    const bodyBlock = css.match(/\nbody\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bodyBlock, 'тело документа').toMatch(/-webkit-text-stroke:\s*\.?\d/);
  });

  it('на мелком кегле обводка выключена — иначе буквы слипаются', () => {
    expect(css).toMatch(/\.text-xs\s*\{[^}]*-webkit-text-stroke:\s*0/);
  });
});
