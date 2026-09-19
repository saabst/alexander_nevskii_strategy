import { describe, expect, it } from 'vitest';
import { scenarios } from '@nevsky/core';
import { ILLUSTRATION_FILES, illustrationUrl } from './illustrations';

const scenario = scenarios[0]!;

describe('картинки: контент и файлы', () => {
  it('у каждого события картинка находится по имени из контента', () => {
    // Имя файла живёт в контенте строкой, а сам файл — в папке сборки.
    // Разойтись они могут молча: картинка просто не покажется, и никто
    // не узнает, что она должна была быть.
    for (const e of scenario.events) {
      if (!e.illustration) continue;
      expect(
        illustrationUrl(e.illustration.file),
        `${e.id}: файла «${e.illustration.file}» нет в сборке`,
      ).toBeTruthy();
    }
  });

  it('в сборке нет картинок, на которые никто не ссылается', () => {
    const used = new Set(
      scenario.events
        .map((e) => e.illustration?.file)
        .filter((f): f is string => Boolean(f)),
    );
    const orphans = ILLUSTRATION_FILES.filter((f) => !used.has(f));
    expect(orphans, `лишние файлы: ${orphans.join(', ')}`).toEqual([]);
  });

  it('картинки действительно нашлись, а не пустая папка', () => {
    expect(ILLUSTRATION_FILES.length).toBeGreaterThanOrEqual(10);
  });
});
